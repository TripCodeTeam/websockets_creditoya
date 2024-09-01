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
import initializeMongoStore from 'src/lib/MongoStore';
import WhatsAppSessionManager from 'src/lib/Whatsapp';

@WebSocketGateway()
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  socket: Socket;

  private whatsappSessionManager: WhatsAppSessionManager;

  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      const store = await initializeMongoStore();
      this.whatsappSessionManager = new WhatsAppSessionManager(store);
    } catch (error) {
      console.error('Error initializing MongoStore:', error);
    }
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('connect')
  async Client_isConnect(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(client);
    console.log(data);
  }

  @SubscribeMessage('createSession')
  async CreateSession(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(data);
    this.whatsappSessionManager.createSession(data.id, this.server, client);
  }

  @SubscribeMessage('createMessages')
  async SendMessage(
    @MessageBody()
    data: string,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Convierte la cadena JSON en un objeto JavaScript
      const parsedData = JSON.parse(data);

      console.log('SendMessage event received:', parsedData);

      // Verifica si los contactos están definidos y son un arreglo
      if (!parsedData.contacts || !Array.isArray(parsedData.contacts)) {
        console.error(
          'Contacts are not defined or not an array:',
          parsedData.contacts,
        );
        return client.emit('[whatsapp]error', {
          message: 'Invalid contacts data',
        });
      }

      const session = this.whatsappSessionManager.getSessionById(
        parsedData.sessionId,
      );
      if (session) {
        parsedData.contacts.forEach((contact) => {
          let formattedNumber = contact.number;
          if (contact.number.startsWith('3') && contact.number.length === 10) {
            formattedNumber = `57${contact.number}`;
          }
          session
            .sendMessage(
              `${formattedNumber}@c.us`,
              `Hola ${contact.name}\n${parsedData.message}`,
            )
            .then((response) => {
              console.log(`Message sent to ${contact.number}`, response);
              client.emit('[whatsapp]messageSent', {
                to: contact.number,
                message: parsedData.message,
              });
            })
            .catch((error) => {
              console.log(`Failed to send message to ${contact.number}`, error);
            });
        });
      } else {
        console.error('Session not found:', parsedData.sessionId);
      }
    } catch (error) {
      console.error('Failed to parse data:', error);
      client.emit('[whatsapp]error', { message: 'Invalid JSON format' });
    }
  }

  /* Connections from client */

  @SubscribeMessage('[whatsapp_client]entryNumbersPhone')
  async ReceivedPhones(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(data);
    const sessionId = data.sessionId;
    const phones = data.phones;
    // const message = data.message;

    // Obtener la sesión por ID utilizando el método getSessionById
    const session = this.whatsappSessionManager.getSessionById(sessionId);

    if (session) {
      // Filtrar los números que comienzan con "3" (válidos para Colombia)
      const validPhones = phones.filter((phoneNumber: string) =>
        phoneNumber.startsWith('3'),
      );

      if (validPhones.length > 0) {
        // Enviar mensajes a los números válidos
        for (const phoneNumber of validPhones) {
          try {
            await session.sendMessage(
              phoneNumber,
              'Hola mensaje de prueba desde el servidor',
            ); // Envía el mensaje a cada número válido
            console.log(`Mensaje enviado a: ${phoneNumber}`);
          } catch (error) {
            console.error(
              `Error al enviar el mensaje a: ${phoneNumber}`,
              error,
            );
          }
        }
      } else {
        console.log('No hay números válidos para enviar mensajes.');
      }
    } else {
      console.log('Sesión no encontrada.');
    }

    // Enviar una respuesta al cliente para confirmar que se recibieron los números
    client.emit('[whatsapp]sendVerifyPhones', { message: 'received' });
  }
}
