import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { HealthModule } from './health/health.module';
import { UserModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OtpModule } from './common/otp/otp.module';
import { EmailModule } from './common/email/email.module';
import { MembershipsModule } from './membership/memberships.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DatabaseModule,
    HealthModule,
    UserModule,
    AuthModule,
    OtpModule,
    EmailModule,
    MembershipsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
