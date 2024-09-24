import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SentMessageInfo } from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter<SentMessageInfo>;

  constructor(private configService: ConfigService) {

    // load .env with method of nestjs
    // const email = this.configService.get<string>('GOOGLE_EMAIL');
    // const pass = this.configService.get<string>('GOOGLE_APP_KEY');

    const email = process.env.GOOGLE_EMAIL as string;
    const pass = process.env.GOOGLE_APP_KEY as string;

    if (!email || !pass) {
      throw new Error('Email and password must be defined');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email,
        pass,
      },
    });
  }

  async sendMail(mailOptions: nodemailer.SendMailOptions) {
    return await this.transporter.sendMail(mailOptions);
  }
}
