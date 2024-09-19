import { Module } from '@nestjs/common';
import { SocketModule } from './websockets/websocket.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    SocketModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
})
export class AppModule {}
