import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from 'src/database/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';

import { CreateEnrollmentDto } from './dto/membership-enrollment.dto.ts/create-enrollment.dto.ts';
import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto.ts/update-membership-status.dto.ts';

import {
  MembershipNotificationType,
  MembershipStatus,
  MembershipPaymentStatus,
} from 'src/generated/prisma/enums';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ============================================================
  // HELPERS
  // ============================================================

  private getMembershipDurationDays(): number {
    const days = Number(process.env.MEMBERSHIP_DURATION_DAYS);

    if (!Number.isInteger(days) || days <= 0) {
      throw new Error('Invalid MEMBERSHIP_DURATION_DAYS configuration');
    }

    return days;
  }

  private getPaymentGracePeriodDays(): number {
    const days = Number(process.env.MEMBERSHIP_PAYMENT_GRACE_PERIOD_DAYS);

    if (!Number.isInteger(days) || days <= 0) {
      throw new Error(
        'Invalid MEMBERSHIP_PAYMENT_GRACE_PERIOD_DAYS configuration',
      );
    }

    return days;
  }

  private calculateEndDate(startDate: Date): Date {
    const durationDays = this.getMembershipDurationDays();

    return new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  // ============================================================
  // CREATE ENROLLMENT
  // ============================================================

  async createEnrollment(userId: string, dto: CreateEnrollmentDto) {
    const member = await this.prisma.member.findUnique({
      where: {
        userId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

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

    if (gym.ownerId === userId) {
      throw new ForbiddenException('You cannot enroll in your own gym');
    }

    // Only check pending membership in THIS gym.
    const pendingMembership = await this.prisma.membership.findFirst({
      where: {
        memberId: member.id,
        gymId: gym.id,
        status: 'PENDING',
      },
    });

    if (pendingMembership) {
      throw new ConflictException('Enrollment request is already pending');
    }

    // Only check active membership in THIS gym.
    //
    // A member is allowed to have ACTIVE memberships
    // in other gyms.
    const activeMembership = await this.prisma.membership.findFirst({
      where: {
        memberId: member.id,
        gymId: gym.id,
        status: 'ACTIVE',
      },

      select: {
        id: true,
      },
    });

    if (activeMembership) {
      throw new ConflictException(
        'You already have an active membership in this gym',
      );
    }

    const membership = await this.prisma.membership.create({
      data: {
        memberId: member.id,
        gymId: gym.id,

        status: 'PENDING',

        // New membership starts unpaid.
        paymentStatus: 'DUE',

        startDate: null,
        endDate: null,
      },
    });

    return {
      message: 'Enrollment request sent successfully',

      membership: {
        id: membership.id,
        status: membership.status,
        paymentStatus: membership.paymentStatus,

        gym: {
          id: gym.id,
          name: gym.name,
        },
      },
    };
  }

  // ============================================================
  // GET GYM MEMBERSHIPS
  // ============================================================

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

    // ==========================================================
    // MEMBER
    // ==========================================================

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

    // ==========================================================
    // OWNER
    // ==========================================================

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

  // ============================================================
  // OWNER → UPDATE MEMBERSHIP STATUS
  // ============================================================

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
      throw new NotFoundException('Membership not found');
    }

    // Owner must own THIS gym.
    if (membership.gym.ownerId !== ownerId) {
      throw new ForbiddenException('You are not the owner of this gym');
    }

    // ==========================================================
    // PENDING → REJECTED
    // ==========================================================

    if (membership.status === 'PENDING' && dto.status === 'REJECTED') {
      const updated = await this.prisma.membership.update({
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
          id: updated.id,
          status: updated.status,
          paymentStatus: updated.paymentStatus,

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

    // ==========================================================
    // PENDING → ACTIVE
    // ==========================================================

    if (membership.status === 'PENDING' && dto.status === 'ACTIVE') {
      // Check ONLY this gym.
      const existingActive = await this.prisma.membership.findFirst({
        where: {
          memberId: membership.memberId,
          gymId: membership.gymId,
          status: 'ACTIVE',
        },

        select: {
          id: true,
        },
      });

      if (existingActive) {
        throw new ConflictException(
          'Member already has an active membership in this gym',
        );
      }

      const startDate = new Date();
      const endDate = this.calculateEndDate(startDate);

      const updated = await this.prisma.membership.update({
        where: {
          id: membership.id,
        },

        data: {
          status: 'ACTIVE',

          // Owner must explicitly mark payment as PAID.
          paymentStatus: 'DUE',

          startDate,
          endDate,
        },
      });

      return {
        message: 'Enrollment approved successfully',

        membership: {
          id: updated.id,
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          startDate: updated.startDate,
          endDate: updated.endDate,

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

    // ==========================================================
    // REVOKED → ACTIVE
    //
    // Two different cases:
    //
    // 1. Period has NOT ended:
    //       Restore SAME membership.
    //
    // 2. Period HAS ended:
    //       Create NEW membership.
    // ==========================================================

    if (membership.status === 'REVOKED' && dto.status === 'ACTIVE') {
      const now = new Date();

      // --------------------------------------------------------
      // CASE 1:
      // Existing revoked membership is still within its period.
      // --------------------------------------------------------

      if (membership.endDate && membership.endDate > now) {
        // Check ONLY this gym.
        const existingActive = await this.prisma.membership.findFirst({
          where: {
            memberId: membership.memberId,
            gymId: membership.gymId,
            status: 'ACTIVE',
            id: {
              not: membership.id,
            },
          },

          select: {
            id: true,
          },
        });

        if (existingActive) {
          throw new ConflictException(
            'Member already has an active membership in this gym',
          );
        }

        const updated = await this.prisma.membership.update({
          where: {
            id: membership.id,
          },

          data: {
            status: 'ACTIVE',
          },
        });

        return {
          message: 'Membership restored successfully',

          membership: {
            id: updated.id,
            status: updated.status,
            paymentStatus: updated.paymentStatus,
            startDate: updated.startDate,
            endDate: updated.endDate,

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

      // --------------------------------------------------------
      // CASE 2:
      // Revoked membership period has already ended.
      //
      // DO NOT restore the old membership.
      // Create a completely NEW membership.
      // --------------------------------------------------------

      const existingActive = await this.prisma.membership.findFirst({
        where: {
          memberId: membership.memberId,
          gymId: membership.gymId,
          status: 'ACTIVE',
        },

        select: {
          id: true,
        },
      });

      if (existingActive) {
        throw new ConflictException(
          'Member already has an active membership in this gym',
        );
      }

      const startDate = now;
      const endDate = this.calculateEndDate(startDate);

      const newMembership = await this.prisma.membership.create({
        data: {
          memberId: membership.memberId,
          gymId: membership.gymId,

          status: 'ACTIVE',

          // New period starts unpaid.
          paymentStatus: 'DUE',

          startDate,
          endDate,
        },
      });

      return {
        message: 'New membership created successfully',

        membership: {
          id: newMembership.id,
          status: newMembership.status,
          paymentStatus: newMembership.paymentStatus,
          startDate: newMembership.startDate,
          endDate: newMembership.endDate,

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

    // ==========================================================
    // ACTIVE → REVOKED
    // ==========================================================

    if (membership.status === 'ACTIVE' && dto.status === 'REVOKED') {
      const updated = await this.prisma.membership.update({
        where: {
          id: membership.id,
        },

        data: {
          status: 'REVOKED',
        },
      });

      return {
        message: 'Membership revoked successfully',

        membership: {
          id: updated.id,
          status: updated.status,
          paymentStatus: updated.paymentStatus,

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

    // ==========================================================
    // ACTIVE → ACTIVE
    // ==========================================================

    if (membership.status === 'ACTIVE' && dto.status === 'ACTIVE') {
      throw new ConflictException('Membership is already active');
    }

    // ==========================================================
    // INVALID TRANSITION
    // ==========================================================

    throw new ConflictException(
      `Cannot change membership from ${membership.status} to ${dto.status}`,
    );
  }

  // ============================================================
  // MEMBER → CANCEL MEMBERSHIP
  // ============================================================

  async cancelMembership(userId: string, membershipId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        id: membershipId,
      },

      include: {
        member: {
          select: {
            userId: true,
          },
        },

        gym: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.member.userId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to cancel this membership',
      );
    }

    if (membership.status === 'CANCELLED') {
      throw new ConflictException('Membership is already cancelled');
    }

    const updated = await this.prisma.membership.update({
      where: {
        id: membership.id,
      },

      data: {
        status: 'CANCELLED',
      },
    });

    return {
      message: 'Membership cancelled successfully',

      membership: {
        id: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,

        gym: {
          id: membership.gym.id,
          name: membership.gym.name,
        },
      },
    };
  }

  // ============================================================
  // OWNER → UPDATE PAYMENT STATUS
  // ============================================================

  async updatePaymentStatus(
    ownerId: string,
    membershipId: string,
    paymentStatus: MembershipPaymentStatus,
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
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.gym.ownerId !== ownerId) {
      throw new ForbiddenException('You are not the owner of this gym');
    }

    if (membership.status !== 'ACTIVE') {
      throw new ConflictException(
        'Only active memberships can have their payment status changed',
      );
    }

    const updated = await this.prisma.membership.update({
      where: {
        id: membership.id,
      },

      data: {
        paymentStatus,
      },
    });

    return {
      message: `Payment status changed to ${paymentStatus}`,

      membership: {
        id: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
      },
    };
  }

  // ============================================================
  // PAYMENT NOTIFICATION
  // ============================================================

  private async sendPaymentNotification(
    membership: any,
    type: MembershipNotificationType,
    title: string,
    message: string,
  ) {
    const existing = await this.prisma.membershipNotification.findUnique({
      where: {
        membershipId_type: {
          membershipId: membership.id,
          type,
        },
      },
    });

    if (existing) {
      return;
    }

    await this.notificationsService.notifyUser({
      gymId: membership.gymId,
      userId: membership.member.userId,
      title,
      message,
      data: {
        type: 'MEMBERSHIP_PAYMENT',
        membershipId: membership.id,
      },
    });

    await this.prisma.membershipNotification.create({
      data: {
        membershipId: membership.id,
        type,
      },
    });
  }

  // ============================================================
  // PAYMENT REMINDERS
  // ============================================================

  async sendPaymentReminders() {
    const now = new Date();

    const memberships = await this.prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        paymentStatus: 'DUE',

        endDate: {
          not: null,
        },
      },

      include: {
        member: {
          select: {
            userId: true,
          },
        },

        gym: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const gracePeriodDays = this.getPaymentGracePeriodDays();

    for (const membership of memberships) {
      if (!membership.endDate) {
        continue;
      }

      const endDate = membership.endDate;

      const differenceMs = endDate.getTime() - now.getTime();

      const daysUntilEnd = Math.ceil(differenceMs / (24 * 60 * 60 * 1000));

      // ========================================================
      // 5 → 1 DAYS BEFORE PAYMENT PERIOD ENDS
      // ========================================================

      if (daysUntilEnd >= 1 && daysUntilEnd <= 5) {
        const notificationTypes = {
          5: MembershipNotificationType.PAYMENT_DUE_5_DAYS,
          4: MembershipNotificationType.PAYMENT_DUE_4_DAYS,
          3: MembershipNotificationType.PAYMENT_DUE_3_DAYS,
          2: MembershipNotificationType.PAYMENT_DUE_2_DAYS,
          1: MembershipNotificationType.PAYMENT_DUE_1_DAY,
        };

        const type = notificationTypes[daysUntilEnd as 1 | 2 | 3 | 4 | 5];

        const message =
          daysUntilEnd === 1
            ? `Your monthly payment for ${membership.gym.name} is due tomorrow.`
            : `Your monthly payment for ${membership.gym.name} is due in ${daysUntilEnd} days.`;

        await this.sendPaymentNotification(
          membership,
          type,
          'Payment Due',
          message,
        );
      }

      // ========================================================
      // PAYMENT GRACE PERIOD
      // ========================================================

      if (differenceMs <= 0) {
        const elapsedMs = now.getTime() - endDate.getTime();

        const graceDay = Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1;

        if (graceDay >= 1 && graceDay <= gracePeriodDays) {
          const graceTypes = [
            MembershipNotificationType.PAYMENT_GRACE_DAY_1,
            MembershipNotificationType.PAYMENT_GRACE_DAY_2,
            MembershipNotificationType.PAYMENT_GRACE_DAY_3,
            MembershipNotificationType.PAYMENT_GRACE_DAY_4,
            MembershipNotificationType.PAYMENT_GRACE_DAY_5,
          ];

          const type = graceTypes[graceDay - 1];

          if (!type) {
            continue;
          }

          const remainingDays = gracePeriodDays - graceDay + 1;

          const message =
            remainingDays === 1
              ? `Your payment for ${membership.gym.name} is overdue. This is the final payment reminder for this period.`
              : `Your payment for ${membership.gym.name} is overdue. You have ${remainingDays} days remaining in the payment reminder period.`;

          await this.sendPaymentNotification(
            membership,
            type,
            'Payment Overdue',
            message,
          );
        }
      }
    }
  }

  // ============================================================
  // AUTOMATIC MONTHLY MEMBERSHIP CREATION
  // ============================================================

  async createNextMonthlyMemberships() {
    const now = new Date();

    const memberships = await this.prisma.membership.findMany({
      where: {
        status: 'ACTIVE',

        endDate: {
          not: null,
          lte: now,
        },
      },

      include: {
        member: {
          select: {
            userId: true,
          },
        },

        gym: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let createdCount = 0;

    for (const membership of memberships) {
      if (!membership.endDate) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        // Re-read inside transaction.
        const current = await tx.membership.findUnique({
          where: {
            id: membership.id,
          },
        });

        if (
          !current ||
          current.status !== 'ACTIVE' ||
          !current.endDate ||
          current.endDate > now
        ) {
          return;
        }

        // Only look for the next membership
        // belonging to THIS member + THIS gym.
        const existingNext = await tx.membership.findFirst({
          where: {
            memberId: current.memberId,
            gymId: current.gymId,

            startDate: current.endDate,

            status: 'ACTIVE',
          },
        });

        if (existingNext) {
          return;
        }

        const nextStartDate = current.endDate;

        const nextEndDate = this.calculateEndDate(nextStartDate);

        // Old monthly period becomes historical.
        await tx.membership.update({
          where: {
            id: current.id,
          },

          data: {
            status: 'EXPIRED',
          },
        });

        // Create next monthly period.
        //
        // New month starts DUE.
        const newMembership = await tx.membership.create({
          data: {
            memberId: current.memberId,
            gymId: current.gymId,

            status: 'ACTIVE',

            paymentStatus: 'DUE',

            startDate: nextStartDate,
            endDate: nextEndDate,
          },
        });

        if (newMembership) {
          createdCount++;
        }
      });
    }

    return createdCount;
  }

  // ============================================================
  // HOURLY MEMBERSHIP BILLING JOB
  // ============================================================

  @Cron(CronExpression.EVERY_HOUR)
  async handleMembershipBilling() {
    // 1. Send payment reminders.
    //
    // Only ACTIVE + DUE memberships are considered.
    await this.sendPaymentReminders();

    // 2. Close completed monthly periods and
    //    create the next monthly membership.
    const createdCount = await this.createNextMonthlyMemberships();

    if (createdCount > 0) {
      console.log(`Created ${createdCount} new monthly memberships`);
    }
  }
}
