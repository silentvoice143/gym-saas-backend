import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';
import { DateTime } from 'luxon';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async markAttendance(userId: string, gymId: string) {
    // 1. Find member
    const member = await this.prisma.member.findUnique({
      where: {
        userId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    // 2. Find active membership for selected gym
    const membership = await this.prisma.membership.findFirst({
      where: {
        memberId: member.id,
        gymId,
        status: 'ACTIVE',
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have an active membership in this gym',
      );
    }

    // 3. Check membership expiry
    const now = new Date();

    const gymNow = DateTime.now().setZone(membership.gym.timezone);

    const startOfDay = gymNow.startOf('day').toUTC().toJSDate();

    const endOfDay = gymNow.plus({ days: 1 }).startOf('day').toUTC().toJSDate();

    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        membershipId: membership.id,
        checkedInAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (existingAttendance) {
      throw new ConflictException('Attendance already marked for today');
    }

    if (membership.endDate && membership.endDate < now) {
      throw new ForbiddenException('Your membership has expired');
    }

    // 5. Create attendance
    const attendance = await this.prisma.attendance.create({
      data: {
        membershipId: membership.id,
        checkedInAt: now,
      },
    });

    return {
      message: 'Attendance marked successfully',

      attendance: {
        id: attendance.id,
        checkedInAt: attendance.checkedInAt,
      },

      gym: {
        id: membership.gym.id,
        name: membership.gym.name,
      },
    };
  }

  async getMyAttendance(userId: string, gymId: string, month?: string) {
    if (!gymId) {
      throw new BadRequestException('gymId is required');
    }

    // 1. Find member
    const member = await this.prisma.member.findUnique({
      where: {
        userId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    // 2. Find active membership for selected gym
    const membership = await this.prisma.membership.findFirst({
      where: {
        memberId: member.id,
        gymId,
        status: 'ACTIVE',
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have an active membership in this gym',
      );
    }

    // 3. Get gym timezone
    const timezone = membership.gym.timezone;

    // 4. Determine requested month
    const targetMonth =
      month ?? DateTime.now().setZone(timezone).toFormat('yyyy-MM');

    // 5. Validate month
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      throw new BadRequestException('Invalid month. Use YYYY-MM format');
    }

    // 6. Create month boundaries in gym timezone
    const start = DateTime.fromISO(`${targetMonth}-01`, {
      zone: timezone,
    }).startOf('month');

    const end = start.plus({
      months: 1,
    });

    // 7. Convert boundaries to UTC
    const startUtc = start.toUTC().toJSDate();

    const endUtc = end.toUTC().toJSDate();

    // 8. Get attendance
    const attendance = await this.prisma.attendance.findMany({
      where: {
        membershipId: membership.id,
        checkedInAt: {
          gte: startUtc,
          lt: endUtc,
        },
      },
      orderBy: {
        checkedInAt: 'asc',
      },
    });

    // 9. Return
    return {
      gym: {
        id: membership.gym.id,
        name: membership.gym.name,
        timezone: membership.gym.timezone,
      },

      membership: {
        id: membership.id,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
      },

      month: targetMonth,

      attendedDates: attendance.map((record) => {
        const localDate = DateTime.fromJSDate(record.checkedInAt).setZone(
          timezone,
        );

        return {
          date: localDate.toFormat('yyyy-MM-dd'),
          checkedInAt: record.checkedInAt,
        };
      }),
    };
  }

  async getGymAttendance(
    ownerId: string,
    gymId: string,
    date?: string,
    month?: string,
  ) {
    if (!gymId) {
      throw new BadRequestException('gymId is required');
    }

    if (date && month) {
      throw new BadRequestException('Provide either date or month, not both');
    }

    // 1. Verify gym belongs to owner
    const gym = await this.prisma.gym.findFirst({
      where: {
        id: gymId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        timezone: true,
      },
    });

    if (!gym) {
      throw new ForbiddenException('You do not have access to this gym');
    }

    const timezone = gym.timezone;

    let start: DateTime;
    let end: DateTime;

    // -------------------------
    // DAILY ATTENDANCE
    // -------------------------
    if (date) {
      if (!/^\d{4}-(0[1-9]|[12]\d|3[01])$/.test(date)) {
        throw new BadRequestException('Invalid date. Use YYYY-MM-DD');
      }

      start = DateTime.fromISO(date, {
        zone: timezone,
      }).startOf('day');

      end = start.plus({ days: 1 });
    }

    // -------------------------
    // MONTHLY ATTENDANCE
    // -------------------------
    else {
      const targetMonth =
        month ?? DateTime.now().setZone(timezone).toFormat('yyyy-MM');

      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
        throw new BadRequestException('Invalid month. Use YYYY-MM');
      }

      start = DateTime.fromISO(`${targetMonth}-01`, {
        zone: timezone,
      }).startOf('month');

      end = start.plus({ months: 1 });
    }

    // Convert local boundaries to UTC
    const startUtc = start.toUTC().toJSDate();
    const endUtc = end.toUTC().toJSDate();

    const attendance = await this.prisma.attendance.findMany({
      where: {
        membership: {
          gymId,
        },
        checkedInAt: {
          gte: startUtc,
          lt: endUtc,
        },
      },
      include: {
        membership: {
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
        },
      },
      orderBy: {
        checkedInAt: 'asc',
      },
    });

    return {
      gym: {
        id: gym.id,
        name: gym.name,
        timezone: gym.timezone,
      },

      date: date ?? null,
      month: date ? null : (month ?? null),

      attendance: attendance.map((record) => ({
        id: record.id,
        checkedInAt: record.checkedInAt,

        member: {
          id: record.membership.member.id,
          name: record.membership.member.user.name,
          email: record.membership.member.user.email,
        },

        membershipId: record.membershipId,
      })),
    };
  }

  async getMemberAttendance(
    ownerId: string,
    memberId: string,
    gymId: string,
    month?: string,
  ) {
    if (!gymId) {
      throw new BadRequestException('gymId is required');
    }

    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Verify member belongs to this gym
    // and owner owns this gym
    const membership = await this.prisma.membership.findFirst({
      where: {
        memberId,
        gymId,
        gym: {
          ownerId,
        },
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('This member does not belong to your gym');
    }

    // -------------------------
    // MONTH
    // -------------------------

    const timezone = membership.gym.timezone;

    const targetMonth =
      month ?? DateTime.now().setZone(timezone).toFormat('yyyy-MM');

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      throw new BadRequestException('Invalid month. Use YYYY-MM');
    }

    const start = DateTime.fromISO(`${targetMonth}-01`, {
      zone: timezone,
    }).startOf('month');

    const end = start.plus({
      months: 1,
    });

    const startUtc = start.toUTC().toJSDate();

    const endUtc = end.toUTC().toJSDate();

    // -------------------------
    // ATTENDANCE
    // -------------------------

    const attendance = await this.prisma.attendance.findMany({
      where: {
        membershipId: membership.id,

        checkedInAt: {
          gte: startUtc,
          lt: endUtc,
        },
      },

      orderBy: {
        checkedInAt: 'asc',
      },
    });

    return {
      member: {
        id: member.id,
        name: member.user.name,
        email: member.user.email,
      },

      gym: {
        id: membership.gym.id,
        name: membership.gym.name,
      },

      membership: {
        id: membership.id,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
      },

      month: targetMonth,

      attendance: attendance.map((record) => ({
        id: record.id,
        checkedInAt: record.checkedInAt,
      })),
    };
  }

  async markMemberAttendance(ownerId: string, memberId: string, gymId: string) {
    if (!gymId) {
      throw new BadRequestException('gymId is required');
    }

    // 1. Verify gym belongs to owner
    const gym = await this.prisma.gym.findFirst({
      where: {
        id: gymId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        timezone: true,
      },
    });

    if (!gym) {
      throw new ForbiddenException('You do not have access to this gym');
    }

    // 2. Find active membership
    const membership = await this.prisma.membership.findFirst({
      where: {
        memberId,
        gymId,
        status: 'ACTIVE',
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
    });

    if (!membership) {
      throw new NotFoundException('Active membership not found for this gym');
    }

    const now = new Date();

    // 3. Check membership expiry
    if (membership.endDate && membership.endDate < now) {
      throw new ForbiddenException('Member membership has expired');
    }

    // 4. Get current day according to gym timezone
    const gymNow = DateTime.now().setZone(gym.timezone);

    const startOfDay = gymNow.startOf('day').toUTC().toJSDate();

    const endOfDay = gymNow.plus({ days: 1 }).startOf('day').toUTC().toJSDate();

    // 5. Prevent duplicate attendance
    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        membershipId: membership.id,
        checkedInAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (existingAttendance) {
      throw new ConflictException('Attendance already marked for today');
    }

    // 6. Create attendance
    const attendance = await this.prisma.attendance.create({
      data: {
        membershipId: membership.id,
        checkedInAt: now,
      },
    });

    return {
      message: 'Member attendance marked successfully',

      attendance: {
        id: attendance.id,
        checkedInAt: attendance.checkedInAt,
      },

      member: {
        id: membership.member.id,
        name: membership.member.user.name,
        email: membership.member.user.email,
      },

      gym: {
        id: gym.id,
        name: gym.name,
      },
    };
  }
}
