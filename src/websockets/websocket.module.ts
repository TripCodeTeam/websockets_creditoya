import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { ConfigModule } from '@nestjs/config';
import { MailService } from 'src/lib/transporter';
import { MjmlService } from 'src/lib/mjmlToHtml';

@Module({
  providers: [WebsocketGateway, MailService, MjmlService],
  exports: [WebsocketGateway],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class SocketModule {}
