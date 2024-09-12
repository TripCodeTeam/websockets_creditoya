import { Client, LocalAuth } from 'whatsapp-web.js';
import { Server } from 'socket.io';
import { CustomSessionStore } from './CustoMongoStore'; // Ajusta la ruta si es necesario
import * as path from 'path';
import * as fs from 'fs';

class WhatsAppSessionManager {
  public allSessions: Record<string, Client> = {};
  private store: CustomSessionStore;
  private sessionDirectory: string;

  constructor(store: CustomSessionStore) {
    this.store = store;

    // Determinar el directorio de sesiones basado en el entorno
    const isProduction = process.env.NODE_ENV === 'production';

    this.sessionDirectory = isProduction
      ? path.resolve(__dirname, '../../sessions')
      : path.resolve(process.cwd(), 'sessions'); // En desarrollo
    this.loadSessions();
  }

  public async createSession(id: string, server: Server): Promise<void> {
    // Ruta de sesiones
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const sessionDirectory = isDevelopment
      ? path.resolve(__dirname, '../../sessions') // Desarrollo
      : path.resolve(__dirname, '../sessions'); // Producción

    console.log('Session Directory Path:', sessionDirectory);

    try {
      const client = new Client({
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        authStrategy: new LocalAuth({
          clientId: id,
          dataPath: sessionDirectory, // Almacena las sesiones localmente
        }),
      });

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

      client.on('auth_failure', () => {
        console.error('AUTHENTICATION FAILURE');
        server.emit('[whatsapp]isAuth', { isAuth: false });
      });

      client.on('ready', () => {
        console.log('Client is ready');
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

      await client.initialize();
    } catch (error) {
      console.error('Error initializing client:', error);
    }
  }

  public saveSession(id: string, client: Client): void {
    this.allSessions[id] = client;
    console.log(`Session ${id} saved in memory`);
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

  public async loadSessions(): Promise<void> {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const sessionDir = isDevelopment
      ? path.resolve(__dirname, '../../sessions') // Desarrollo
      : path.resolve(__dirname, '../sessions'); // Producción

    try {
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      console.log('Session Directory:', sessionDir);

      // Carga las sesiones en memoria (LocalAuth cargará las sesiones automáticamente)
      console.log('Sessions loaded into memory:', this.allSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  public async reconnectSession(id: string, server: Server): Promise<void> {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const sessionDir = isDevelopment
      ? path.resolve(__dirname, '../../sessions') // Desarrollo
      : path.resolve(__dirname, '../sessions'); // Producción

    try {
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      console.log('Session Directory:', sessionDir);

      const client = new Client({
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        authStrategy: new LocalAuth({
          clientId: id,
          dataPath: sessionDir, // Almacena las sesiones localmente
        }),
      });

      this.allSessions[id] = client;

      client.on('ready', () => {
        console.log(`Reconnected to session: ${id}`);
        server.emit('[whatsapp]isReady', {
          id,
          message: 'Reconnected to session',
        });
      });

      client.on('qr', (qr) => {
        server.emit('[whatsapp]qr_obtained', { qr });
      });

      await client.initialize();
    } catch (error) {
      console.error('Error reconnecting session:', error);
    }
  }

  public async sessionExists(options: { session: string }): Promise<boolean> {
    return this.allSessions[options.session] ? true : false;
  }

  public async getSession(options: { session: string }): Promise<any> {
    return this.allSessions[options.session] || null;
  }

  public async delete(options: { session: string }): Promise<void> {
    if (this.allSessions[options.session]) {
      delete this.allSessions[options.session];
      console.log(`Session ${options.session} deleted from memory`);
    }
  }
}

export default WhatsAppSessionManager;
