import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway()
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // constructor(private readonly whatsappService: WhatsappService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('[whatsapp]create_session')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    this.server
      .to(client.id)
      .emit('[whatsapp]session_created', { message: 'Session created', data });
  }

  @SubscribeMessage('[whatsapp]get_obtained')
  async handleGetSession(
    @MessageBody() data: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server
      .to(client.id)
      .emit('[whatsapp]session_obtained', {
        message: 'Session Obtenida',
        data,
      });
  }
}
