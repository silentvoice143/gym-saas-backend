import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

import { CreateEnrollmentDto } from './dto/membership-enrollment.dto.ts/create-enrollment.dto.ts';
import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto.ts/update-membership-status.dto.ts';
import { MembershipStatus } from 'src/generated/prisma/enums';
import { UpdateMembershipDto } from './dto/update-membership.dto.ts/update-membership.dto.ts';

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

  async getGymMemberships(
    userId: string,
    role: string,
    gymId: string,
    status?: MembershipStatus,
    limit = 20,
    cursor?: string,
  ) {
    if (!gymId) {
      throw new BadRequestException('gymId is required');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    // 1. Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: {
        id: gymId,
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

    // =========================
    // MEMBER
    // =========================

    if (role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({
        where: {
          userId,
        },
      });

      if (!member) {
        throw new NotFoundException('Member profile not found');
      }

      const membership = await this.prisma.membership.findFirst({
        where: {
          memberId: member.id,
          gymId,

          ...(status
            ? {
                status,
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
        gym: {
          id: gym.id,
          name: gym.name,
        },

        membership,
      };
    }

    // =========================
    // OWNER
    // =========================

    if (role === 'OWNER') {
      if (gym.ownerId !== userId) {
        throw new ForbiddenException('You do not own this gym');
      }

      const memberships = await this.prisma.membership.findMany({
        where: {
          gymId,

          ...(status
            ? {
                status,
              }
            : {}),
        },

        include: {
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

        take: limit + 1,

        ...(cursor
          ? {
              cursor: {
                id: cursor,
              },
              skip: 1,
            }
          : {}),
      });

      const hasNextPage = memberships.length > limit;

      const results = hasNextPage ? memberships.slice(0, limit) : memberships;

      const nextCursor = hasNextPage ? results[results.length - 1].id : null;

      return {
        gym: {
          id: gym.id,
          name: gym.name,
        },

        memberships: results,

        pagination: {
          limit,
          hasNextPage,
          nextCursor,
        },
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
}
