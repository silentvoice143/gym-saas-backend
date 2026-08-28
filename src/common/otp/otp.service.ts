import { Injectable, UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';

interface PendingRegistration {
  name: string;
  email: string;
  gymName: string;
  passwordHash: string;
  otpHash: string;
}

@Injectable()
export class OtpService {
  private readonly redis: Redis;
  private readonly OTP_EXPIRY_SECONDS = 10 * 60;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL is not configured');
    }

    this.redis = new Redis(redisUrl);
  }

  generate(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async storeRegistration(
    email: string,
    registration: {
      name: string;
      email: string;
      gymName: string;
      passwordHash: string;
      otp: string;
    },
  ): Promise<void> {
    const otpHash = await bcrypt.hash(registration.otp, 10);

    const data: PendingRegistration = {
      name: registration.name,
      email: registration.email,
      gymName: registration.gymName,
      passwordHash: registration.passwordHash,
      otpHash,
    };

    await this.redis.set(
      this.getRegistrationKey(email),
      JSON.stringify(data),
      'EX',
      this.OTP_EXPIRY_SECONDS,
    );
  }

  async getRegistration(email: string): Promise<PendingRegistration | null> {
    const data = await this.redis.get(this.getRegistrationKey(email));

    if (!data) {
      return null;
    }

    return JSON.parse(data) as PendingRegistration;
  }

  async verifyRegistrationOtp(
    email: string,
    otp: string,
  ): Promise<PendingRegistration> {
    const registration = await this.getRegistration(email);

    if (!registration) {
      throw new UnauthorizedException('OTP is invalid or has expired');
    }

    const isValid = await bcrypt.compare(otp, registration.otpHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.redis.del(this.getRegistrationKey(email));

    return registration;
  }

  private getRegistrationKey(email: string): string {
    return `otp:registration:${email.toLowerCase()}`;
  }
}
