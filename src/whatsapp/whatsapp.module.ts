import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { SocketModule } from 'src/websockets/websocket.module';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
  imports: [SocketModule],
})
export class WhatsappModule {}
