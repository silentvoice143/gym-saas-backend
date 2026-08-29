import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

import { CreateEnrollmentDto } from './dto/membership-enrollment.dto.ts/create-enrollment.dto.ts';
import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto.ts/update-membership-status.dto.ts.js';
import { MembershipStatus } from 'src/generated/prisma/enums.js';
import { UpdateMembershipDto } from './dto/update-membership.dto.ts/update-membership.dto.ts.js';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEnrollment(userId: string, dto: CreateEnrollmentDto) {
    // 1. Find member profile
    const member = await this.prisma.member.findUnique({
      where: {
        userId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    // 2. Check whether gym exists
    const gym = await this.prisma.gym.findUnique({
      where: {
        id: dto.gymId,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // 3. Prevent owner from enrolling in their own gym
    if (gym.ownerId === userId) {
      throw new ForbiddenException('You cannot enroll in your own gym');
    }

    // 4. Check existing membership
    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        memberId: member.id,
        gymId: gym.id,
      },
    });

    // 5. Handle existing membership
    if (existingMembership) {
      // Already waiting for approval
      if (existingMembership.status === 'PENDING') {
        throw new ConflictException('Enrollment request is already pending');
      }

      // Already enrolled
      if (existingMembership.status === 'ACTIVE') {
        throw new ConflictException('You are already enrolled in this gym');
      }

      // Previously rejected → allow another request
      if (existingMembership.status === 'REJECTED') {
        const membership = await this.prisma.membership.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            status: 'PENDING',
            startDate: null,
            endDate: null,
          },
        });

        return {
          message: 'Enrollment request sent successfully',

          membership: {
            id: membership.id,
            status: membership.status,

            gym: {
              id: gym.id,
              name: gym.name,
            },
          },
        };
      }
    }

    // 6. Create new enrollment request
    const membership = await this.prisma.membership.create({
      data: {
        memberId: member.id,
        gymId: gym.id,
        status: 'PENDING',
        startDate: null,
        endDate: null,
      },
    });

    return {
      message: 'Enrollment request sent successfully',

      membership: {
        id: membership.id,
        status: membership.status,

        gym: {
          id: gym.id,
          name: gym.name,
        },
      },
    };
  }
  async getMemberships(userId: string, role: string, status?: string) {
    if (role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({
        where: {
          userId,
        },
      });

      if (!member) {
        throw new NotFoundException('Member profile not found');
      }

      const memberships = await this.prisma.membership.findMany({
        where: {
          memberId: member.id,
          ...(status
            ? {
                status: status as any,
              }
            : {}),
        },
        include: {
          gym: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        memberships,
      };
    }

    if (role === 'OWNER') {
      const memberships = await this.prisma.membership.findMany({
        where: {
          gym: {
            ownerId: userId,
          },
          ...(status
            ? {
                status: status as any,
              }
            : {}),
        },
        include: {
          gym: {
            select: {
              id: true,
              name: true,
            },
          },
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        memberships,
      };
    }

    throw new ForbiddenException('You are not allowed to access memberships');
  }

  async updateMembershipStatus(
    ownerId: string,
    membershipId: string,
    dto: UpdateMembershipStatusDto,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership request not found');
    }

    // Make sure owner owns this gym
    if (membership.gym.ownerId !== ownerId) {
      throw new ForbiddenException('You are not the owner of this gym');
    }

    // Only pending requests can be approved/rejected
    if (membership.status !== 'PENDING') {
      throw new ConflictException(`Membership is already ${membership.status}`);
    }

    // REJECT
    if (dto.status === 'REJECTED') {
      const updatedMembership = await this.prisma.membership.update({
        where: {
          id: membership.id,
        },
        data: {
          status: 'REJECTED',
        },
      });

      return {
        message: 'Enrollment rejected successfully',

        membership: {
          id: updatedMembership.id,
          status: updatedMembership.status,

          gym: {
            id: membership.gym.id,
            name: membership.gym.name,
          },

          member: {
            id: membership.member.id,
            name: membership.member.user.name,
            email: membership.member.user.email,
          },
        },
      };
    }

    // APPROVE
    const startDate = new Date();

    const membershipDurationDays = Number(process.env.MEMBERSHIP_DURATION_DAYS);

    if (
      !Number.isInteger(membershipDurationDays) ||
      membershipDurationDays <= 0
    ) {
      throw new Error('Invalid MEMBERSHIP_DURATION_DAYS configuration');
    }

    const endDate = new Date(
      startDate.getTime() + membershipDurationDays * 24 * 60 * 60 * 1000,
    );

    const updatedMembership = await this.prisma.membership.update({
      where: {
        id: membership.id,
      },
      data: {
        status: 'ACTIVE',
        startDate,
        endDate,
      },
    });

    return {
      message: 'Enrollment approved successfully',

      membership: {
        id: updatedMembership.id,
        status: updatedMembership.status,
        startDate: updatedMembership.startDate,
        endDate: updatedMembership.endDate,

        gym: {
          id: membership.gym.id,
          name: membership.gym.name,
        },

        member: {
          id: membership.member.id,
          name: membership.member.user.name,
          email: membership.member.user.email,
        },
      },
    };
  }

  async getGymMembership(userId: string, gymId: string) {
    // 1. Find member
    const member = await this.prisma.member.findUnique({
      where: {
        userId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    // 2. Find membership for this member + gym
    const membership = await this.prisma.membership.findFirst({
      where: {
        memberId: member.id,
        gymId,
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found for this gym');
    }

    return {
      membership: {
        id: membership.id,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,

        gym: {
          id: membership.gym.id,
          name: membership.gym.name,
        },

        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
    };
  }

  //Update Membership
  async updateMembership(
    ownerId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    // 1. Find membership
    const membership = await this.prisma.membership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // 2. Make sure owner owns the gym
    if (membership.gym.ownerId !== ownerId) {
      throw new ForbiddenException('You are not the owner of this gym');
    }

    // 3. Validate dates
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : membership.startDate;

    const endDate = dto.endDate ? new Date(dto.endDate) : membership.endDate;

    if (startDate && endDate && startDate >= endDate) {
      throw new ConflictException('Start date must be before end date');
    }

    // 4. Build update data
    const updateData: {
      startDate?: Date | null;
      endDate?: Date | null;
      status?: MembershipStatus;
    } = {};

    if (dto.startDate !== undefined) {
      updateData.startDate = new Date(dto.startDate);
    }

    if (dto.endDate !== undefined) {
      updateData.endDate = new Date(dto.endDate);
    }

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    // 5. Update membership
    const updatedMembership = await this.prisma.membership.update({
      where: {
        id: membershipId,
      },
      data: updateData,
    });

    return {
      message: 'Membership updated successfully',

      membership: {
        id: updatedMembership.id,
        status: updatedMembership.status,
        startDate: updatedMembership.startDate,
        endDate: updatedMembership.endDate,

        gym: {
          id: membership.gym.id,
          name: membership.gym.name,
        },

        member: {
          id: membership.member.id,
          name: membership.member.user.name,
          email: membership.member.user.email,
        },
      },
    };
  }
}
