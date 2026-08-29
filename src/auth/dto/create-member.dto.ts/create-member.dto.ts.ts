import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
