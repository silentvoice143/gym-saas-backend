import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/database/database.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
})
export class MembershipsModule {}
