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
import { CreateMemberDto } from './dto/create-member.dto.ts/create-member.dto.ts';

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

  async registerMember(dto: CreateMemberDto) {
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
          name: registration.gymName!,
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

  async verifyMemberEmail(dto: VerifyEmailOtpDto) {
    const registration = await this.otpService.verifyRegistrationOtp(
      dto.email,
      dto.otp,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: registration.name,
          email: registration.email,
          passwordHash: registration.passwordHash,
          role: 'MEMBER',
        },
      });

      const member = await tx.member.create({
        data: {
          userId: user.id,
          qrToken: crypto.randomUUID(),
        },
      });

      return {
        user,
        member,
      };
    });

    return {
      message: 'Email verified and member registered successfully',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      member: {
        id: result.member.id,
        qrToken: result.member.qrToken,
      },
    };
  }

  async loginUser(dto: LoginUserDto) {
    // 1. Find user
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Check password
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Generate access token
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // 4. Role-specific data
    let gyms: any[] = [];
    let memberships: any[] = [];

    // OWNER
    if (user.role === 'OWNER') {
      const ownerGyms = await this.prisma.gym.findMany({
        where: {
          ownerId: user.id,
        },
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
        orderBy: {
          createdAt: 'desc',
        },
      });

      gyms = ownerGyms.map((gym) => {
        const subscription = gym.subscriptions[0];

        return {
          id: gym.id,
          name: gym.name,

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
      });
    }

    // MEMBER
    if (user.role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({
        where: {
          userId: user.id,
        },
        include: {
          memberships: {
            where: {
              status: 'ACTIVE',
            },
            orderBy: {
              createdAt: 'desc',
            },
            include: {
              gym: {
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
          },
        },
      });

      memberships =
        member?.memberships.map((membership) => {
          const subscription = membership.gym.subscriptions[0];

          return {
            id: membership.id,
            status: membership.status,

            gym: {
              id: membership.gym.id,
              name: membership.gym.name,
            },

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
        }) ?? [];
    }

    // 5. Return response
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

      gyms: user.role === 'OWNER' ? gyms : undefined,

      memberships: user.role === 'MEMBER' ? memberships : undefined,
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
