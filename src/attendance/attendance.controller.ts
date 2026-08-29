import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AttendanceService } from './attendance.service';

import { JwtAuthGuard } from 'src/auth/gaurds/jwt-auth.gaurd';
import { Roles } from 'src/auth/decorator/role.decorator';
import { RolesGuard } from 'src/auth/gaurds/role-auth.gaurd';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ManualAttendanceDto } from './dto/manual-attendance';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  async markAttendance(@Req() req: any, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markAttendance(req.user.userId, dto.gymId);
  }

  // Member → own attendance
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  async getMyAttendance(
    @Req() req: any,
    @Query('gymId') gymId: string,
    @Query('month') month?: string,
  ) {
    return this.attendanceService.getMyAttendance(
      req.user.userId,
      gymId,
      month,
    );
  }

  // OWNER - daily/monthly gym attendance
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async getGymAttendance(
    @Req() req: any,
    @Query('gymId') gymId: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
  ) {
    return this.attendanceService.getGymAttendance(
      req.user.userId,
      gymId,
      date,
      month,
    );
  }

  // OWNER - specific member history
  @Get('member/:memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async getMemberAttendance(
    @Req() req: any,
    @Param('memberId') memberId: string,
    @Query('gymId') gymId: string,
    @Query('month') month?: string,
  ) {
    return this.attendanceService.getMemberAttendance(
      req.user.userId,
      memberId,
      gymId,
      month,
    );
  }

  // OWNER - manually mark attendance
  @Post('member/:memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async markMemberAttendance(
    @Req() req: any,
    @Param('memberId') memberId: string,
    @Body() dto: ManualAttendanceDto,
  ) {
    return this.attendanceService.markMemberAttendance(
      req.user.userId,
      memberId,
      dto.gymId,
    );
  }
}
