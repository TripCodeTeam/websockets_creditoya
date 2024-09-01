import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class SocketModule {}
