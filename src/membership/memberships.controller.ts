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

import { MembershipsService } from './memberships.service';

import { CreateEnrollmentDto } from './dto/membership-enrollment.dto.ts/create-enrollment.dto.ts';

import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto.ts/update-membership-status.dto.ts';

import { JwtAuthGuard } from 'src/auth/gaurds/jwt-auth.gaurd';

import { RolesGuard } from 'src/auth/gaurds/role-auth.gaurd';

import { Roles } from 'src/auth/decorator/role.decorator';

import { MembershipStatus } from 'src/generated/prisma/enums';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  // ─────────────────────────────────────────────
  // MEMBER → Request enrollment
  // ─────────────────────────────────────────────

  @Post('enroll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  async enroll(@Req() req: any, @Body() dto: CreateEnrollmentDto) {
    return this.membershipsService.createEnrollment(req.user.userId, dto);
  }

  // ─────────────────────────────────────────────
  // MEMBER / OWNER → Get memberships for gym
  // ─────────────────────────────────────────────

  @Get('gym/:gymId')
  @UseGuards(JwtAuthGuard)
  async getGymMemberships(
    @Req() req: any,
    @Param('gymId') gymId: string,
    @Query('status') status?: MembershipStatus,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.membershipsService.getGymMemberships(
      req.user.userId,
      req.user.role,
      gymId,
      status,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  // ─────────────────────────────────────────────
  // OWNER → Approve / Reject enrollment
  // ─────────────────────────────────────────────

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
}
