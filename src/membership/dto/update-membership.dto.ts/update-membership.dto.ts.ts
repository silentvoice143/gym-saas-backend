import { IsDateString, IsEnum, IsOptional } from 'class-validator';

import { MembershipStatus } from 'src/generated/prisma/client';
enum MembershipUpdateStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(MembershipUpdateStatus)
  status?: MembershipStatus;
}
