import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/gaurds/jwt-auth.gaurd';
import { UserService } from './users.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: { userId: string } }) {
    return this.userService.findById(req.user.userId);
  }
}
