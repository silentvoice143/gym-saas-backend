import { IsNotEmpty, IsString } from 'class-validator';

export class ManualAttendanceDto {
  @IsString()
  @IsNotEmpty()
  gymId!: string;
}
