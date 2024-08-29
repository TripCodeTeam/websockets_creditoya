import { Injectable } from '@nestjs/common';
import WhatsAppSessionManager from 'src/lib/Whatsapp';
import { WebsocketGateway } from 'src/websockets/websocket.gateway';
import store from 'src/lib/MongoStore';

@Injectable()
export class WhatsappService {
  private sessionManager: WhatsAppSessionManager;

  constructor(private readonly webSocketGateWay: WebsocketGateway) {
    this.sessionManager = new WhatsAppSessionManager(store);
  }

  async createSession(id: string): Promise<void> {
    this.sessionManager.createSession(id, this.webSocketGateWay.server);
  }

  async getSession(id: string): Promise<any> {
    const session = this.sessionManager.getSession(
      id,
      this.webSocketGateWay.server,
    );

    return session;
  }
}
