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
import { MjmlService } from 'src/lib/mjmlToHtml';
import { MailService } from 'src/lib/transporter';
import WhatsAppSessionManager from 'src/lib/Whatsapp';
import { ActiveAccountMail } from 'src/templates/InfoMail';
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

  constructor(
    private readonly mailService: MailService,
    private readonly mjmlService: MjmlService,
  ) {
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

  @SubscribeMessage('deleteSession')
  async handleDeleteSession(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;

    if (!this.whatsappSessionManager) {
      client.emit('error', 'WhatsAppSessionManager is not initialized');
      console.error('WhatsAppSessionManager is not initialized');
      return;
    }

    try {
      await this.whatsappSessionManager.delete(sessionId);
      client.emit('sessionDeleted', { success: true });
      console.log(`Session deleted with ID: ${sessionId}`);
    } catch (error) {
      console.error(`Error deleting session with ID: ${sessionId}`, error);
      client.emit('error', `Failed to delete session with ID: ${sessionId}`);
    }
  }

  @SubscribeMessage('[whatsapp_client]entryNumbersPhone')
  async ReceivedPhones(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    console.log(data);

    if (
      !data ||
      !data.sessionId ||
      !Array.isArray(data.phones) ||
      !Array.isArray(data.names) ||
      !Array.isArray(data.files) ||
      !Array.isArray(data.emails)
    ) {
      const errorMessage = 'Datos incompletos o formato incorrecto.';
      console.error(errorMessage, data);
      client.emit('[whatsapp]sendVerifyPhones', {
        send: false,
        message: errorMessage,
      });
      return;
    }

    const { sessionId, phones, names, message, files, emails } = data;

    console.log(sessionId);
    console.log(phones);
    console.log(names);
    console.log(message);
    console.log(files);
    console.log(emails);

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

    const validPhones = phones
      .map((phoneNumber: string) =>
        phoneNumber.replace(/\s+/g, '').startsWith('+57')
          ? phoneNumber
          : `+57${phoneNumber}`,
      )
      .map((phoneNumber) => `${phoneNumber.replace('+', '')}@c.us`);

    const sendFile = async (
      file: { name: string; type: string; data: string },
      phoneNumber: string,
    ) => {
      try {
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

    const sendMessageAndFiles = async (
      phoneNumber: string,
      name: string,
      email: string,
    ) => {
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
          await Promise.all(files.map((file) => sendFile(file, phoneNumber)));
        }

        const mjmlContent = ActiveAccountMail({ completeName: name, message });
        const htmlContent = await this.mjmlService.convertToHTML(mjmlContent);

        // Enviar correo electrónico usando MailService
        await this.mailService.sendMail({
          from: email, // Email desde donde se envía
          to: email, // Email del destinatario
          subject: 'Credito Ya te ha enviado una informacion',
          html: htmlContent,
          // text: `Hola ${name},\n\n${message || ''}`,
          attachments: files.map((file) => ({
            filename: file.name,
            content: Buffer.from(file.data, 'base64'),
            encoding: 'base64',
          })),
        });
        console.log(`Correo enviado a: ${email}`);
      } catch (error) {
        console.error(`Error al enviar el mensaje a: ${phoneNumber}`, error);
        client.emit('[whatsapp]sendVerifyPhones', {
          send: false,
          message: `Error al enviar el mensaje a: ${phoneNumber}: ${error.message}`,
        });
      }
    };

    await Promise.all(
      validPhones.map((phoneNumber, index) =>
        sendMessageAndFiles(
          phoneNumber,
          names[index] || '',
          emails[index] || '',
        ),
      ),
    );

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
}
