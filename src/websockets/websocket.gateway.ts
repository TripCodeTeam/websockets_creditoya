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
import WhatsAppSessionManager from 'src/lib/Whatsapp';
import { exec } from 'child_process';

@WebSocketGateway()
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  socket: Socket;

  private whatsappSessionManager: WhatsAppSessionManager | null = null;

  constructor() {
    this.initialize()
      .then(() => {
        console.log('WhatsAppSessionManager initialized');
      })
      .catch((error) => {
        console.error('Error initializing WhatsAppSessionManager:', error);
      });
  }

  async initialize() {
    try {
      this.whatsappSessionManager = new WhatsAppSessionManager();
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
  async handleCreateSession(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('createSession event received:', data);
    if (!this.whatsappSessionManager) {
      client.emit('error', 'WhatsAppSessionManager is not initialized');
      console.error('WhatsAppSessionManager is not initialized');
      return;
    }

    const { id } = data;

    if (!id) {
      client.emit('error', 'No session ID provided');
      return;
    }

    try {
      await this.whatsappSessionManager.createSession(id, this.server);
      console.log(`Session created with ID: ${id}`);
    } catch (error) {
      console.error(`Error creating session with ID: ${id}`, error);
      client.emit('error', `Failed to create session with ID: ${id}`);
    }
  }

  @SubscribeMessage('[whatsapp_client]entryNumbersPhone')
  async ReceivedPhones(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(data);

    // Validar que `data` tenga la estructura esperada
    if (!data || !data.sessionId || !data.phones) {
      console.error('Datos incompletos recibidos:', data);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: 'Datos incompletos recibidos.',
      });
      return;
    }

    const { sessionId, phones } = data;

    // Verificar que `phones` sea un array
    if (!Array.isArray(phones)) {
      console.error(
        'El formato de los números de teléfono no es correcto',
        phones,
      );
      console.log('Números de teléfono recibidos:', phones);

      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: 'El formato de los números de teléfono no es correcto',
      });
      return;
    }

    // Obtener la sesión por ID
    const session = this.whatsappSessionManager.getSessionById(sessionId);
    if (!session) {
      console.error('Sesión no encontrada:', sessionId);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: 'Sesión no encontrada.',
      });
      return;
    }

    // Verificar si el cliente está listo
    if (!session.info || !session.pupPage) {
      console.error('El cliente de la sesión no está listo:', sessionId);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: 'El cliente de la sesión no está listo.',
      });
      return;
    }

    const validPhones = phones
      .map((phoneNumber: any) =>
        typeof phoneNumber === 'string'
          ? phoneNumber.replace(/\s+/g, '') // Eliminar espacios
          : null,
      )
      .filter((phoneNumber: string | null) => phoneNumber !== null)
      .map((phoneNumber) => {
        // Formatear números como +57XXXXXXXXX@c.us
        if (!phoneNumber.startsWith('+57')) {
          phoneNumber = `+57${phoneNumber}`;
        }
        return `${phoneNumber.replace('+', '')}@c.us`; // Reemplazar '+' y agregar @c.us
      });

    // Luego, en la lógica de envío de mensajes
    for (const phoneNumber of validPhones) {
      try {
        // Verificar si el usuario está registrado en WhatsApp
        const isRegistered = await session.isRegisteredUser(phoneNumber);
        if (!isRegistered) {
          console.error(`Número no registrado en WhatsApp: ${phoneNumber}`);
          client.emit('[whatsapp]sendVerifyPhones', {
            send: false,
            message: `El número ${phoneNumber} no está registrado en WhatsApp.`,
          });
          continue;
        }

        // Enviar el mensaje
        await session.sendMessage(
          phoneNumber,
          'Hola mensaje de prueba desde el servidor',
        );
        console.log(`Mensaje enviado a: ${phoneNumber}`);
      } catch (error) {
        console.error(`Error al enviar el mensaje a: ${phoneNumber}`, error);
        client.emit('[whatsapp]sendVerifyPhones', {
          send: false,
          message: `Error al enviar el mensaje a: ${phoneNumber}: ${error.message}`,
        });
      }
    }

    // Emitir confirmación de mensajes enviados
    client.emit('[whatsapp]sendVerifyPhones', {
      send: true,
      message: 'Mensajes enviados',
    });
  }

  @SubscribeMessage('[client]newLoan')
  async NewLoan(@MessageBody() data: any, @ConnectedSocket() Client: Socket) {}

  @SubscribeMessage('[client]newIssues')
  async newIssues(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { sessionId, titleIssue, descriptionIssue, ticketId } = data;

    const session = this.whatsappSessionManager.getSessionById(sessionId);

    // El número específico al que se enviará el mensaje
    const phoneNumber = '3176051319';
    const formattedPhone = `57${phoneNumber}@c.us`; // Formatear el número como +57XXXXXXXXX@c.us

    try {
      // Verificar si el usuario está registrado en WhatsApp
      const isRegistered = await session.isRegisteredUser(formattedPhone);
      if (!isRegistered) {
        console.error(`Número no registrado en WhatsApp: ${formattedPhone}`);
        client.emit('[whatsapp]sendVerifyPhones', {
          send: false,
          message: `El número ${formattedPhone} no está registrado en WhatsApp.`,
        });
        return;
      }

      // Organizar el mensaje con los datos recibidos
      const message = `📌 *Nuevo Ticket*\n\n*Título:* ${titleIssue}\n*Descripción:* ${descriptionIssue}\n*ID del Ticket:* ${ticketId}`;

      // Enviar el mensaje
      await session.sendMessage(formattedPhone, message);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: true,
        message: `Mensaje enviado exitosamente a ${formattedPhone}.`,
      });
    } catch (error) {
      console.error(`Error al enviar el mensaje a: ${formattedPhone}`, error);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: `Error al enviar el mensaje a ${formattedPhone}: ${error.message}`,
      });
    }
  }

  // Evento para reiniciar el servidor
  @SubscribeMessage('restartServer')
  async handleRestartServer(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('Reinicio solicitado por el cliente:', data);

    // Aquí emitimos una respuesta al cliente antes de proceder con el reinicio
    client.emit('serverRestarting', {
      message: 'El servidor se está reiniciando...',
    });

    // Ejecutar un comando para reiniciar el proceso de Node.js
    exec('pm2 restart all', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error reiniciando el servidor: ${error.message}`);
        client.emit('error', 'Error al intentar reiniciar el servidor');
        return;
      }

      console.log(`Servidor reiniciado con éxito: ${stdout}`);
    });
  }
}
