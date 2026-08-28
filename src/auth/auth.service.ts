import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../database/prisma.service';
import { OwnerRegisterDto } from './dto/owner-register.dto/owner-register.dto';
import { LoginUserDto } from './dto/login-user.dto/login-user.dto';
import { OtpService } from 'src/common/otp/otp.service';
import { EmailService } from 'src/common/email/email.service';
import { VerifyEmailOtpDto } from './dto/email-verify.dto/email-verify.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto.ts/forgot-password.dto.ts';
import { ChangePasswordDto } from './dto/change-password.dto.ts/change-password.dto.ts';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  private generateTemporaryPassword(): string {
    return randomBytes(8).toString('base64url');
  }

  // async registerOwner(dto: OwnerRegisterDto) {
  //   const existingUser = await this.prisma.user.findUnique({
  //     where: {
  //       email: dto.email,
  //     },
  //   });

  //   if (existingUser) {
  //     throw new ConflictException('Email already registered');
  //   }

  //   const passwordHash = await bcrypt.hash(dto.password, 12);

  //   const result = await this.prisma.$transaction(async (tx) => {
  //     const user = await tx.user.create({
  //       data: {
  //         name: dto.name,
  //         email: dto.email,
  //         passwordHash,
  //         role: 'OWNER',
  //       },
  //     });

  //     const gym = await tx.gym.create({
  //       data: {
  //         name: dto.gymName,
  //         ownerId: user.id,
  //       },
  //     });

  //     const trialDurationDays = Number(process.env.TRIAL_DURATION_DAYS);

  //     if (!Number.isInteger(trialDurationDays) || trialDurationDays <= 0) {
  //       throw new Error('Invalid TRIAL_DURATION_DAYS configuration');
  //     }

  //     const startDate = new Date();
  //     const endDate = new Date(
  //       startDate.getTime() + trialDurationDays * 24 * 60 * 60 * 1000,
  //     );

  //     const subscription = await tx.subscription.create({
  //       data: {
  //         gymId: gym.id,
  //         provider: 'TRIAL',
  //         status: 'TRIAL',
  //         startDate,
  //         endDate,
  //       },
  //     });

  //     return {
  //       user,
  //       gym,
  //       subscription,
  //     };
  //   });

  //   return {
  //     message: 'Owner registered successfully',
  //     user: {
  //       id: result.user.id,
  //       name: result.user.name,
  //       email: result.user.email,
  //       role: result.user.role,
  //     },
  //     gym: {
  //       id: result.gym.id,
  //       name: result.gym.name,
  //     },
  //     subscription: {
  //       id: result.subscription.id,
  //       status: result.subscription.status,
  //       startDate: result.subscription.startDate,
  //       endDate: result.subscription.endDate,
  //     },
  //   };
  // }
  async registerOwner(dto: OwnerRegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const otp = await this.otpService.generate();

    await this.otpService.storeRegistration(dto.email, {
      name: dto.name,
      email: dto.email,
      gymName: dto.gymName,
      passwordHash,
      otp,
    });

    await this.emailService.sendVerificationOtp(dto.email, otp);

    return {
      message: 'Verification OTP sent to your email',
    };
  }
  async verifyOwnerEmail(dto: VerifyEmailOtpDto) {
    const registration = await this.otpService.verifyRegistrationOtp(
      dto.email,
      dto.otp,
    );

    const trialDurationDays = Number(process.env.TRIAL_DURATION_DAYS);

    if (!Number.isInteger(trialDurationDays) || trialDurationDays <= 0) {
      throw new Error('Invalid TRIAL_DURATION_DAYS configuration');
    }

    const startDate = new Date();

    const endDate = new Date(
      startDate.getTime() + trialDurationDays * 24 * 60 * 60 * 1000,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: registration.name,
          email: registration.email,
          passwordHash: registration.passwordHash,
          role: 'OWNER',
        },
      });

      const gym = await tx.gym.create({
        data: {
          name: registration.gymName,
          ownerId: user.id,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          gymId: gym.id,
          provider: 'TRIAL',
          status: 'TRIAL',
          startDate,
          endDate,
        },
      });

      return {
        user,
        gym,
        subscription,
      };
    });

    return {
      message: 'Email verified and owner registered successfully',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      gym: {
        id: result.gym.id,
        name: result.gym.name,
      },
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        startDate: result.subscription.startDate,
        endDate: result.subscription.endDate,
      },
    };
  }

  async loginUser(dto: LoginUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
      include: {
        gyms: {
          include: {
            subscriptions: {
              where: {
                status: {
                  in: ['TRIAL', 'ACTIVE'],
                },
              },
              orderBy: {
                endDate: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const gym = user.gyms[0];

    const subscription = gym?.subscriptions[0];

    return {
      message: 'Login successful',

      accessToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },

      gym: gym
        ? {
            id: gym.id,
            name: gym.name,
          }
        : null,

      subscription: subscription
        ? {
            id: subscription.id,
            provider: subscription.provider,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
          }
        : null,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    // Don't reveal whether the email exists.
    if (!user) {
      return {
        message:
          'If the email is registered, a temporary password has been sent',
      };
    }

    const temporaryPassword = this.generateTemporaryPassword();

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    await this.emailService.sendTemporaryPassword(
      user.email,
      temporaryPassword,
    );

    return {
      message: 'If the email is registered, a temporary password has been sent',
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return {
      message: 'Password changed successfully',
    };
  }
}
