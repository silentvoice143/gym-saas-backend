import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { MembershipsService } from './memberships.service.js';

import { CreateEnrollmentDto } from './dto/membership-enrollment.dto.ts/create-enrollment.dto.ts';

import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto.ts/update-membership-status.dto.ts.js';

import { JwtAuthGuard } from 'src/auth/gaurds/jwt-auth.gaurd';
import { RolesGuard } from 'src/auth/gaurds/role-auth.gaurd';
import { Roles } from 'src/auth/decorator/role.decorator';
import { UpdateMembershipDto } from './dto/update-membership.dto.ts/update-membership.dto.ts.js';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  // MEMBER → Request enrollment
  @Post('enroll')
  @UseGuards(JwtAuthGuard)
  async enroll(@Req() req: any, @Body() dto: CreateEnrollmentDto) {
    return this.membershipsService.createEnrollment(req.user.userId, dto);
  }

  // MEMBER / OWNER → Get memberships
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMemberships(@Req() req: any, @Query('status') status?: string) {
    return this.membershipsService.getMemberships(
      req.user.userId,
      req.user.role,
      status,
    );
  }

  // OWNER → Approve / Reject
  @Patch(':membershipId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async updateMembershipStatus(
    @Req() req: any,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipStatusDto,
  ) {
    return this.membershipsService.updateMembershipStatus(
      req.user.userId,
      membershipId,
      dto,
    );
  }

  // MEMBER -> Get particular gym membership detail
  @Get('gym/:gymId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  async getGymMembership(@Req() req: any, @Param('gymId') gymId: string) {
    return this.membershipsService.getGymMembership(req.user.userId, gymId);
  }

  // OWNER -> Update membership detail of a member
  @Patch(':membershipId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async updateMembership(
    @Req() req: any,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.membershipsService.updateMembership(
      req.user.userId,
      membershipId,
      dto,
    );
  }
}
