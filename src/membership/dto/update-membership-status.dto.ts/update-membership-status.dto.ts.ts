import { IsEnum } from 'class-validator';

export enum MembershipAction {
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
}

export class UpdateMembershipStatusDto {
  @IsEnum(MembershipAction)
  status!: MembershipAction;
}
