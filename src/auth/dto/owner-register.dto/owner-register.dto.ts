import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class OwnerRegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  gymName!: string;
}
