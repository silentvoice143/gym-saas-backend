import { IsNotEmpty, IsString } from 'class-validator';

export class MarkAttendanceDto {
  @IsString()
  @IsNotEmpty()
  gymId!: string;
}
