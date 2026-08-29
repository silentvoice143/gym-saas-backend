import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly databaseService: PrismaService) {}

  async findById(userId: string) {
    return this.databaseService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,

        gyms: {
          select: {
            id: true,
            name: true,
            createdAt: true,

            subscriptions: {
              select: {
                id: true,
                provider: true,
                status: true,
                startDate: true,
                endDate: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });
  }
}
