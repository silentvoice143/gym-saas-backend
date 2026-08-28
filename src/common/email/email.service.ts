import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendVerificationOtp(email: string, otp: string) {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify your Gym account',
      text: `Your verification OTP is ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
          <h2>Verify your Gym account</h2>

          <p>Use the following OTP to verify your email address:</p>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 24px 0;
          ">
            ${otp}
          </div>

          <p>This OTP will expire in 10 minutes.</p>

          <p>
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  }
  async sendTemporaryPassword(email: string, temporaryPassword: string) {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Your temporary Gym App password',
      text: `
Your temporary password is:

${temporaryPassword}

Please login using this password and change it immediately.

If you did not request a password reset, please contact support.
    `,
      html: `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 500px;
          margin: 0 auto;
          padding: 24px;
        "
      >
        <h2>Password Reset</h2>

        <p>
          We received a request to reset your Gym App password.
        </p>

        <p>Your temporary password is:</p>

        <div
          style="
            background: #f5f5f5;
            padding: 16px;
            border-radius: 8px;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            letter-spacing: 2px;
            margin: 20px 0;
          "
        >
          ${temporaryPassword}
        </div>

        <p>
          Use this password to login to the mobile app.
        </p>

        <p>
          You will be required to change your password after login.
        </p>

        <p>
          If you did not request this password reset,
          please contact support.
        </p>
      </div>
    `,
    });
  }
}
