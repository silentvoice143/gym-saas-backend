import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';
import { FcmProvider } from './providers/fcm.provider';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmProvider: FcmProvider,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async registerDevice(userId: string, fcmToken: string) {
    const device = await this.prisma.userDevice.upsert({
      where: {
        fcmToken,
      },

      update: {
        userId,
        updatedAt: new Date(),
      },

      create: {
        userId,
        fcmToken,
      },
    });

    return {
      message: 'Device registered successfully',

      device: {
        id: device.id,
        fcmToken: device.fcmToken,
      },
    };
  }

  async notifyUser({
    gymId,
    userId,
    title,
    message,
    data,
  }: {
    gymId: string;
    userId: string;
    title: string;
    message: string;
    data?: Record<string, string>;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        gymId,
        title,
        message,
        status: 'PENDING',

        recipients: {
          create: {
            userId,
            status: 'PENDING',
          },
        },
      },

      include: {
        recipients: true,
      },
    });

    await this.notificationQueue.add(
      'send-user-notification',
      {
        notificationId: notification.id,
        userId,
        title,
        message,
        data,
      },
      {
        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 5000,
        },

        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return {
      message: 'Notification queued successfully',

      notification: {
        id: notification.id,
        status: notification.status,
      },
    };
  }

  async getMyNotifications(userId: string, limit = 20, cursor?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    const recipients = await this.prisma.notificationRecipient.findMany({
      where: {
        userId,
      },

      include: {
        notification: {
          select: {
            id: true,
            gymId: true,
            title: true,
            message: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: limit + 1,

      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1,
      }),
    });

    const hasNextPage = recipients.length > limit;

    const results = hasNextPage ? recipients.slice(0, limit) : recipients;

    const nextCursor = hasNextPage ? results[results.length - 1].id : null;

    return {
      notifications: results.map((recipient) => ({
        id: recipient.notification.id,
        gymId: recipient.notification.gymId,
        title: recipient.notification.title,
        message: recipient.notification.message,

        status: recipient.status,

        isRead: recipient.readAt !== null,
        readAt: recipient.readAt,
        sentAt: recipient.sentAt,

        createdAt: recipient.notification.createdAt,
      })),

      pagination: {
        limit,
        hasNextPage,
        nextCursor,
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const recipient = await this.prisma.notificationRecipient.findUnique({
      where: {
        notificationId_userId: {
          notificationId,
          userId,
        },
      },
    });

    if (!recipient) {
      throw new NotFoundException('Notification not found');
    }

    if (recipient.readAt) {
      return {
        message: 'Notification already marked as read',
      };
    }

    const updatedRecipient = await this.prisma.notificationRecipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      message: 'Notification marked as read',

      notification: {
        id: notificationId,
        status: updatedRecipient.status,
        readAt: updatedRecipient.readAt,
      },
    };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const recipient = await this.prisma.notificationRecipient.findUnique({
      where: {
        notificationId_userId: {
          notificationId,
          userId,
        },
      },
    });

    if (!recipient) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notificationRecipient.delete({
      where: {
        id: recipient.id,
      },
    });

    return {
      message: 'Notification deleted successfully',
    };
  }

  async getGymNotifications(
    ownerId: string,
    gymId: string,
    limit = 20,
    cursor?: string,
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    // 1. Verify owner owns the gym
    const gym = await this.prisma.gym.findFirst({
      where: {
        id: gymId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found or you are not the owner');
    }

    // 2. Fetch one extra record
    const notifications = await this.prisma.notification.findMany({
      where: {
        gymId,
      },

      include: {
        recipients: {
          select: {
            id: true,
            userId: true,
            status: true,
            sentAt: true,
            readAt: true,
            createdAt: true,

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

      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1,
      }),
    });

    // 3. Determine if another page exists
    const hasNextPage = notifications.length > limit;

    const results = hasNextPage ? notifications.slice(0, limit) : notifications;

    // 4. Cursor for next request
    const nextCursor = hasNextPage ? results[results.length - 1].id : null;

    return {
      gym,

      notifications: results.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        status: notification.status,
        createdAt: notification.createdAt,

        recipients: notification.recipients.map((recipient) => ({
          id: recipient.id,
          userId: recipient.userId,
          status: recipient.status,
          sentAt: recipient.sentAt,
          readAt: recipient.readAt,
          isRead: recipient.readAt !== null,

          user: recipient.user,
        })),
      })),

      pagination: {
        limit,
        hasNextPage,
        nextCursor,
      },
    };
  }
}
