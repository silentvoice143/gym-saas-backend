import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OwnerRegisterDto } from './dto/owner-register.dto/owner-register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('owner/register')
  registerOwner(@Body() dto: OwnerRegisterDto) {
    return this.authService.registerOwner(dto);
  }
}
