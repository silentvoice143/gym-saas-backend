import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../database/prisma.service';
import { OwnerRegisterDto } from './dto/owner-register.dto/owner-register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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

    // We'll add the transaction next.
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: 'OWNER',
        },
      });

      const gym = await tx.gym.create({
        data: {
          name: dto.gymName,
          ownerId: user.id,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          gymId: gym.id,
          provider: 'TRIAL',
          status: 'TRIAL',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        user,
        gym,
        subscription,
      };
    });

    return {
      message: 'Owner registered successfully',
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
}
