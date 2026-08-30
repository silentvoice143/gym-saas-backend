import { IsEnum } from 'class-validator';
import { MembershipPaymentStatus } from 'src/generated/prisma/enums';

export class UpdateMembershipPaymentStatusDto {
  @IsEnum(MembershipPaymentStatus)
  paymentStatus!: MembershipPaymentStatus;
}
