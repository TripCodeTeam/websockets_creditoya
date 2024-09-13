import { Client, NoAuth } from 'whatsapp-web.js';
import { Server } from 'socket.io';

class WhatsAppSessionManager {
  public allSessions: Record<string, Client> = {};
  private sessionDirectory: string;

  constructor() {
    console.log('WhatsAppSessionManager initialized');
  }

  public async createSession(id: string, server: Server): Promise<void> {
    console.log(`Attempting to create session with ID: ${id}`);

    // Verifica si la sesión ya existe para evitar duplicados
    if (this.allSessions[id]) {
      console.log(`Session with ID ${id} already exists`);
      return;
    }

    try {
      const client = new Client({
        puppeteer: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        authStrategy: new NoAuth(), // Usando NoAuth, sin persistencia
      });

      // Guarda el cliente en las sesiones
      this.allSessions[id] = client;

      client.on('qr', (qr) => {
        console.log('QR Received', qr);
        server.emit('[whatsapp]qr_obtained', {
          qr,
          message: 'QR obtenido, escanéalo desde la aplicación de WhatsApp',
        });
      });

      client.on('authenticated', () => {
        console.log('AUTHENTICATED');
        server.emit('[whatsapp]isAuth', { isAuth: true });
      });

      client.on('auth_failure', (msg) => {
        console.error('AUTHENTICATION FAILURE', msg);
        server.emit('[whatsapp]isAuth', { isAuth: false });
      });

      client.on('ready', () => {
        console.log('Client is ready');

        // Asegúrate de que la sesión esté guardada en memoria
        if (!this.allSessions[id]) {
          this.allSessions[id] = client;
          console.log('Sesión guardada:', this.allSessions);
        }

        server.emit('[whatsapp]isReady', {
          id,
          message: 'La sesión está lista',
        });
      });

      client.on('message', (msg) => {
        if (msg.body === 'ping') {
          msg.reply('pong');
          const data = {
            author: msg.from,
            message: msg.body,
          };
          server.emit('newMessage', data);
        }
      });

      // Inicializa el cliente de WhatsApp
      await client.initialize();
    } catch (error) {
      console.error('Error initializing client:', error);

      // Limpia la sesión si falla la inicialización
      if (this.allSessions[id]) {
        delete this.allSessions[id];
      }

      // Notifica al cliente sobre el error
      server.emit('[whatsapp]error', {
        id,
        message: `Error initializing session: ${error.message}`,
      });
    }
  }

  public getSessionById(id: string): Client | null {
    const session = this.allSessions[id];
    if (session) {
      console.log(`Session ${id} found in memory`);
    } else {
      console.error(`Session ${id} not found in memory`);
    }
    return session || null;
  }

  public async delete(options: { session: string }): Promise<void> {
    if (this.allSessions[options.session]) {
      delete this.allSessions[options.session];
      console.log(`Session ${options.session} deleted from memory`);
    }
  }

  // public saveSession(id: string, client: Client): void {
  //   this.allSessions[id] = client;
  //   console.log(`Session ${id} saved in memory`);
  // }

  // public async loadSessions(): Promise<void> {
  //   // Ruta de sesiones
  //   const sessionDir = path.resolve('/usr/src/app/session');

  //   try {
  //     if (!fs.existsSync(sessionDir)) {
  //       fs.mkdirSync(sessionDir, { recursive: true });
  //     }

  //     console.log('Session Directory:', sessionDir);

  //     // Carga las sesiones en memoria (LocalAuth cargará las sesiones automáticamente)
  //     console.log('Sessions loaded into memory:', this.allSessions);
  //   } catch (error) {
  //     console.error('Error loading sessions:', error);
  //   }
  // }

  // public async reconnectSession(id: string, server: Server): Promise<void> {
  //   // Ruta de sesiones
  //   const sessionDir = path.resolve('/usr/src/app/session');

  //   try {
  //     if (!fs.existsSync(sessionDir)) {
  //       fs.mkdirSync(sessionDir, { recursive: true });
  //     }

  //     console.log('Session Directory:', sessionDir);

  //     const client = new Client({
  //       puppeteer: {
  //         args: [
  //           '--no-sandbox',
  //           '--disable-setuid-sandbox',
  //         ],
  //       },
  //       authStrategy: new LocalAuth({
  //         clientId: id,
  //         dataPath: sessionDir, // Almacena las sesiones localmente
  //       }),
  //     });

  //     this.allSessions[id] = client;

  //     client.on('ready', () => {
  //       console.log(`Reconnected to session: ${id}`);
  //       server.emit('[whatsapp]isReady', {
  //         id,
  //         message: 'Reconnected to session',
  //       });
  //     });

  //     client.on('qr', (qr) => {
  //       server.emit('[whatsapp]qr_obtained', { qr });
  //     });

  //     await client.initialize();
  //   } catch (error) {
  //     console.error('Error reconnecting session:', error);
  //   }
  // }

  // public async sessionExists(options: { session: string }): Promise<boolean> {
  //   return this.allSessions[options.session] ? true : false;
  // }

  // public async getSession(options: { session: string }): Promise<any> {
  //   return this.allSessions[options.session] || null;
  // }
}

export default WhatsAppSessionManager;
