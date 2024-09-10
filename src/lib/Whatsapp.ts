import { Client, RemoteAuth } from 'whatsapp-web.js';
import { Server } from 'socket.io';
import { CustomSessionStore } from './CustoMongoStore'; // Ajusta la ruta si es necesario
import SessionModel from './session.model';
import * as path from 'path';
import * as fs from 'fs';

class WhatsAppSessionManager implements CustomSessionStore {
  public allSessions: Record<string, Client> = {};
  private store: CustomSessionStore;

  constructor(store: CustomSessionStore) {
    this.store = store;
    this.loadSessions();
  }

  public async createSession(
    id: string,
    server: Server,
  ): Promise<void> {
    // Resuelve la ruta absoluta para el directorio de sesiones
    const sessionDirectory = path.resolve(__dirname, '../../sessions');

    console.log('Session Directory:', sessionDirectory);

    try {
      // Verifica si el directorio existe
      if (!fs.existsSync(sessionDirectory)) {
        // Crea el directorio si no existe
        fs.mkdirSync(sessionDirectory, { recursive: true });
        console.log('Session directory created');
      } else {
        console.log('Session directory already exists');
      }
    } catch (error) {
      console.error('Error creating session directory:', error);
      return;
    }

    const client = new Client({
      puppeteer: {
        headless: true,
      },
      authStrategy: new RemoteAuth({
        clientId: id,
        store: this.store,
        dataPath: sessionDirectory,
        backupSyncIntervalMs: 300000,
      }),
    });

    this.allSessions[id] = client;

    client.on('qr', (qr) => {
      console.log('QR Received', qr);
      server.emit('[whatsapp]qr_obtained', {
        qr,
        message: 'Qr obtenido, escanéalo desde la aplicación de WhatsApp',
      });
    });

    client.on('authenticated', async () => {
      console.log('AUTHENTICATED');
      try {
        await this.store.save({
          session: id,
          data: client.getState(), // O cualquier dato relevante que quieras guardar
        });
        console.log(`Session ${id} saved successfully`);
      } catch (error) {
        console.error('Error saving session on authenticated event:', error);
      }
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

    client.on('remote_session_saved', () => {
      console.log('Remote session saved');

      // Verifica si el archivo .zip se ha creado
      const zipFilePath = path.join(sessionDirectory, `${id}.zip`);
      if (fs.existsSync(zipFilePath)) {
        console.log(`Session zip file exists at: ${zipFilePath}`);
      } else {
        console.error(`Session zip file not found at: ${zipFilePath}`);
      }
    });

    client.on('message', (msg) => {
      // console.log(msg.body);
      if (msg.body === 'ping') {
        msg.reply('pong');
        const data = {
          author: msg.from,
          message: msg.body,
        };
        server.emit('newMessage', data);
      }
    });

    try {
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
    try {
      const sessions = await SessionModel.find({}).exec();

      // Define el directorio de las sesiones
      const sessionDir = path.join(__dirname, 'sessions');

      // Verifica si el directorio existe, si no, lo crea
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      console.log('Session Directory:', sessionDir);

      // Carga las sesiones en memoria
      for (const session of sessions) {
        const client = new Client({
          puppeteer: {
            headless: true,
          },
          authStrategy: new RemoteAuth({
            clientId: session.clientId,
            store: this.store,
            dataPath: sessionDir, // Usa sessionDir
            backupSyncIntervalMs: 300000,
          }),
        });

        // Asegúrate de que el cliente se cargue correctamente
        this.allSessions[session.clientId] = client;

        client.on('ready', () => {
          console.log(`Client ${session.clientId} is ready.`);
        });

        client.on('auth_failure', (msg) => {
          console.error(
            `Authentication failed for ${session.clientId}: ${msg}`,
          );
        });

        await client.initialize();
      }

      console.log('Sessions loaded into memory:', this.allSessions);
    } catch (error) {
      console.error('Error loading sessions from MongoDB:', error);
    }
  }

  public async reconnectSession(id: string, server: Server): Promise<void> {
    try {
      // Define el directorio de las sesiones
      const sessionDir = path.join(__dirname, 'sessions');

      // Verifica si el directorio existe, si no, lo crea
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      console.log('Session Directory:', sessionDir);

      const exists = await this.store.sessionExists({ session: id });

      if (exists) {
        console.log(`Session ${id} exists. Initializing client...`);

        const client = new Client({
          puppeteer: {
            headless: true,
          },
          authStrategy: new RemoteAuth({
            clientId: id,
            store: this.store,
            backupSyncIntervalMs: 300000,
            dataPath: sessionDir,
          }),
          webVersionCache: {
            type: 'remote',
            remotePath:
              'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
          },
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
      } else {
        console.error(`Session ${id} not found in MongoDB`);
      }
    } catch (error) {
      console.error('Error reconnecting session:', error);
    }
  }

  public async sessionExists(options: { session: string }): Promise<boolean> {
    try {
      if (this.allSessions[options.session]) {
        console.log(`Session ${options.session} found in memory`);
        return true;
      }

      const count = await SessionModel.countDocuments({
        clientId: options.session,
      }).exec();
      const exists = count > 0;
      console.log(`Session ${options.session} found in MongoDB: ${exists}`);
      return exists;
    } catch (error) {
      console.error('Error checking session existence:', error);
      return false;
    }
  }

  public async getSession(options: { session: string }): Promise<any> {
    return this.allSessions[options.session] || null;
  }

  public async save(options: { session: string; data: any }): Promise<void> {
    try {
      const client = this.allSessions[options.session];
      if (client) {
        const sessionData = {
          clientId: options.session,
          // Puedes agregar más datos de la sesión aquí si es necesario
        };

        await SessionModel.updateOne(
          { clientId: options.session },
          { $set: sessionData },
          { upsert: true },
        );
        console.log(`Session ${options.session} saved to MongoDB`);
      } else {
        console.error(`Client ${options.session} not found in memory`);
      }
    } catch (error) {
      console.error('Error saving session to MongoDB:', error);
    }
  }

  public async delete(options: { session: string }): Promise<void> {
    try {
      if (this.allSessions[options.session]) {
        delete this.allSessions[options.session];
        console.log(`Session ${options.session} deleted from memory`);
      } else {
        console.error(`Session ${options.session} not found in memory`);
      }

      await SessionModel.deleteOne({ clientId: options.session });
      console.log(`Session ${options.session} deleted from MongoDB`);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  public extract(session: any): any {
    return session;
  }
}

export default WhatsAppSessionManager;
