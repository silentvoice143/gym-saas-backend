import { Injectable } from '@nestjs/common';

import { Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { PrismaService } from 'src/database/prisma.service';

import { FcmProvider } from './providers/fcm.provider';

@Processor('notifications', {
  concurrency: 5,
})
@Injectable()
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmProvider: FcmProvider,
  ) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case 'send-user-notification':
        return this.sendUserNotification(job);

      default:
        throw new Error(`Unknown notification job: ${job.name}`);
    }
  }

  private async sendUserNotification(job: Job) {
    const { notificationId, userId, title, message, data } = job.data;

    const recipient = await this.prisma.notificationRecipient.findUnique({
      where: {
        notificationId_userId: {
          notificationId,
          userId,
        },
      },
    });

    if (!recipient) {
      throw new Error('Notification recipient not found');
    }

    const devices = await this.prisma.userDevice.findMany({
      where: {
        userId,
      },
    });

    if (devices.length === 0) {
      await this.prisma.notificationRecipient.update({
        where: {
          id: recipient.id,
        },
        data: {
          status: 'FAILED',
        },
      });

      throw new Error('User has no registered devices');
    }

    let sent = 0;

    for (const device of devices) {
      try {
        await this.fcmProvider.sendToToken(
          device.fcmToken,
          title,
          message,
          data,
        );

        sent++;
      } catch (error) {
        console.error(`FCM failed for device ${device.id}`, error);
      }
    }

    if (sent === 0) {
      await this.prisma.notificationRecipient.update({
        where: {
          id: recipient.id,
        },
        data: {
          status: 'FAILED',
        },
      });

      throw new Error('Failed to send notification to all devices');
    }

    await this.prisma.notificationRecipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    await this.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        status: 'SENT',
      },
    });

    return {
      sent,
    };
  }
}
