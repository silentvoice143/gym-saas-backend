import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from './auth.service';

import { OwnerRegisterDto } from './dto/owner-register.dto/owner-register.dto';
import { VerifyEmailOtpDto } from './dto/email-verify.dto/email-verify.dto';
import { LoginUserDto } from './dto/login-user.dto/login-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto.ts/forgot-password.dto.ts';
import { CreateMemberDto } from './dto/create-member.dto.ts/create-member.dto.ts';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('owner/register')
  registerOwner(@Body() dto: OwnerRegisterDto) {
    return this.authService.registerOwner(dto);
  }

  @Post('owner/verify')
  verifyOwnerEmail(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyOwnerEmail(dto);
  }

  @Post('login')
  loginUser(@Body() dto: LoginUserDto) {
    return this.authService.loginUser(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('register-member')
  async registerMember(@Body() dto: CreateMemberDto) {
    return this.authService.registerMember(dto);
  }

  @Post('member/verify')
  async verifyMemberEmail(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyMemberEmail(dto);
  }
}
