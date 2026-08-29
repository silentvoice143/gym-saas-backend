import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';

import { RegisterDeviceDto } from './dto/register-device.dto';

import { JwtAuthGuard } from 'src/auth/gaurds/jwt-auth.gaurd';
import { Roles } from 'src/auth/decorator/role.decorator';
import { RolesGuard } from 'src/auth/gaurds/role-auth.gaurd';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Register FCM device
  @Post('devices')
  @UseGuards(JwtAuthGuard)
  async registerDevice(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    return this.notificationsService.registerDevice(
      req.user.userId,
      dto.fcmToken,
    );
  }

  // Get my notifications
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyNotifications(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      req.user.userId,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  // Mark notification as read
  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Req() req: any, @Param('id') notificationId: string) {
    return this.notificationsService.markAsRead(
      req.user.userId,
      notificationId,
    );
  }

  // Delete my notification
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteNotification(
    @Req() req: any,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.deleteNotification(
      req.user.userId,
      notificationId,
    );
  }

  @Get('gym/:gymId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async getGymNotifications(
    @Req() req: any,
    @Param('gymId') gymId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.getGymNotifications(
      req.user.userId,
      gymId,
      limit ? Number(limit) : 20,
      cursor,
    );
  }
}
