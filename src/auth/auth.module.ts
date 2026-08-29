import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt-strategy';

import { DatabaseModule } from 'src/database/database.module';
import { EmailModule } from '../common/email/email.module';
import { OtpModule } from '../common/otp/otp.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    OtpModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),

        signOptions: {
          expiresIn: '7d',
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
