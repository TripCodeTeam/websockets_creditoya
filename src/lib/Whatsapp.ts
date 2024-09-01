import { Client, RemoteAuth, Store } from 'whatsapp-web.js';
import { Session } from '../types/Session';
import { Server, Socket } from 'socket.io';

class WhatsAppSessionManager {
  public allSessions: Session;
  public currentSession: string;
  private store: Store;

  /**
   * @param store
   */
  constructor(store: Store) {
    this.allSessions = {};
    this.store = store;
  }

  /**
   * Método para crear una nueva sesión de WhatsApp
   *
   * @param id
   * @param server
   * @param socket
   */
  public createSession(id: string, server: Server, socket: Socket): void {
    const client = new Client({
      puppeteer: {
        headless: false,
      },
      authStrategy: new RemoteAuth({
        clientId: id,
        store: this.store,
        backupSyncIntervalMs: 300000,
      }),
      webVersionCache: {
        type: 'remote',
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
    });

    client.on('qr', (qr) => {
      console.log('QR Received', qr);
      server.emit('[whatsapp]qr_obtained', { qr, message: 'Code QR Generate' });
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
      // Guardar la sesión en allSessions al estar lista
      this.allSessions[id] = client;
      server.emit('[whatsapp]isReady', { id, message: 'Client is ready' });
    });

    client.on('remote_session_saved', () => {
      console.log('remote_session_saved');
      server.emit('[whatsapp]remote_session_saved', { isRemoteAuth: true });
    });

    client.on('message', (msg) => {
      console.log(msg.body);
      if (msg.body === 'ping') {
        msg.reply('pong');
        const data = {
          author: msg.from,
          message: msg.body,
        };
        server.emit('newMessage', data);
      }
    });

    client.initialize();
  }

  /**
   * Método para obtener una sesión de WhatsApp
   *
   * @param id
   * @param server
   * @param socket
   */
  public getSession(id: string, server: Server, socket: Socket): void {
    const client = new Client({
      puppeteer: {
        headless: false,
      },
      authStrategy: new RemoteAuth({
        clientId: id,
        store: this.store,
        backupSyncIntervalMs: 300000,
      }),
      webVersionCache: {
        type: 'remote',
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
    });

    client.on('ready', () => {
      console.log('Client is ready');
      server.emit('ready', {
        id,
        message: 'Client is ready',
      });
    });

    client.on('qr', (qr) => {
      server.emit('qr', {
        qr,
        message: 'Code QR Generated',
      });
    });

    client.initialize();
  }

  /**
   * Método para obtener la lista de sesiones
   *
   * @returns
   */
  public getAllSessions(): Session {
    return this.allSessions;
  }

  /**
   * Método para obtener una sesión por su ID
   *
   * @param id
   * @returns
   */
  public getSessionById(id: string): Client | null {
    const session = this.allSessions[id] || null;
    console.log(session);
    return session;
  }
}

export default WhatsAppSessionManager;
