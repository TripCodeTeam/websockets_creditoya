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
import { MessageMedia } from 'whatsapp-web.js';

@WebSocketGateway()
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  socket: Socket;

  private qrGenerationAttemps = 0;
  private readonly MAX_QR_ATTEMPS = 10;

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

    if (this.qrGenerationAttemps >= this.MAX_QR_ATTEMPS) {
      client.emit('error', 'QR code generation limit reached');
      console.error('QR code generation limit reached');
      return;
    }

    try {
      await this.whatsappSessionManager.createSession(id, this.server);
      this.qrGenerationAttemps++;
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
    if (
      !data ||
      !data.sessionId ||
      !Array.isArray(data.phones) ||
      !Array.isArray(data.names) ||
      !Array.isArray(data.files) // Asegúrate de validar que `files` es un array
    ) {
      const errorMessage = 'Datos incompletos o formato incorrecto.';
      console.error(errorMessage, data);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: errorMessage,
      });
      return;
    }

    const {
      sessionId,
      phones,
      names,
      message,
      files, // `files` será un array de archivos en formato base64
    }: {
      sessionId: string;
      phones: string[];
      names: string[];
      message?: string;
      files: { name: string; type: string; data: string }[]; // Archivos en formato base64
    } = data;

    console.log(sessionId);
    console.log(phones);
    console.log(names);
    console.log(message);
    console.log(files);

    // Obtener la sesión por ID
    const session = this.whatsappSessionManager.getSessionById(sessionId);
    if (!session || !session.info || !session.pupPage) {
      const sessionError = !session
        ? 'Sesión no encontrada.'
        : 'El cliente de la sesión no está listo.';
      console.error(sessionError, sessionId);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: sessionError,
      });
      return;
    }

    // Normalizar y validar números de teléfono
    const validPhones = phones
      .map((phoneNumber: string) =>
        phoneNumber.replace(/\s+/g, '').startsWith('+57')
          ? phoneNumber
          : `+57${phoneNumber}`,
      )
      .map((phoneNumber) => `${phoneNumber.replace('+', '')}@c.us`);

    const sendFile = async (
      file: { name: string; type: string; data: string }, // Tipo compatible
      phoneNumber: string,
    ) => {
      try {
        // Convertir base64 a Buffer
        const buffer = Buffer.from(file.data, 'base64');
        const media = new MessageMedia(
          file.type,
          buffer.toString('base64'),
          file.name,
        );
        await session.sendMessage(phoneNumber, '', { media });
        console.log(`Archivo enviado a: ${phoneNumber}`);
      } catch (error) {
        console.error(`Error al enviar el archivo a: ${phoneNumber}`, error);
        client.emit('[whatsapp]sendVerifyPhones', {
          send: false,
          message: `Error al enviar el archivo a: ${phoneNumber}: ${error.message}`,
        });
      }
    };

    const sendMessageAndFiles = async (phoneNumber: string, name: string) => {
      try {
        if (!(await session.isRegisteredUser(phoneNumber))) {
          console.error(`Número no registrado en WhatsApp: ${phoneNumber}`);
          client.emit('[whatsapp]sendVerifyPhones', {
            send: false,
            message: `El número ${phoneNumber} no está registrado en WhatsApp.`,
          });
          return;
        }

        const messageText = `Estimado/a ${name}\n\n${message || ''}`;
        await session.sendMessage(phoneNumber, messageText);
        console.log(`Mensaje enviado a: ${phoneNumber}`);

        if (files && files.length > 0) {
          await Promise.all(files.map((file) => sendFile(file, phoneNumber))); // Enviar archivos en paralelo
        }
      } catch (error) {
        console.error(`Error al enviar el mensaje a: ${phoneNumber}`, error);
        client.emit('[whatsapp]sendVerifyPhones', {
          send: false,
          message: `Error al enviar el mensaje a: ${phoneNumber}: ${error.message}`,
        });
      }
    };

    // Enviar mensajes y archivos a cada número de teléfono con su respectivo nombre
    await Promise.all(
      validPhones.map((phoneNumber, index) =>
        sendMessageAndFiles(phoneNumber, names[index] || ''),
      ),
    );

    // Emitir confirmación de mensajes enviados
    client.emit('[whatsapp]sendVerifyPhones', {
      send: true,
      message: 'Mensajes y archivos enviados',
    });
  }

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

    // Ejecutar un comando para reiniciar el proceso de Node.js usando PM2
    exec('pm2 restart all', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error reiniciando el servidor: ${error.message}`);
        client.emit('error', 'Error al intentar reiniciar el servidor');
        return;
      }

      client.emit('successRestartServer', {
        message: 'Servidor reiniciado con éxito',
      });
      console.log(`Servidor reiniciado con éxito: ${stdout}`);
    });
  }
}
