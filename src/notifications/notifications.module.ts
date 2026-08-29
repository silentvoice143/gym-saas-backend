import { Module } from '@nestjs/common';

import { FcmProvider } from './providers/fcm.provider';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsProcessor } from './notifications.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'notifications',

      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),
  ],

  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor, FcmProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
