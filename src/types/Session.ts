import { Client } from 'whatsapp-web.js';

export interface Session {
  [key: string]: Client;
}

interface contactsTypes {
  number: string;
  name: string;
}

export interface createMessageTypes {
  sessionId: string;
  contacts: contactsTypes[];
  message: string;
}

export interface CustomSessionStore {
  sessionExists(options: { session: string }): Promise<boolean>;
  getSession(options: { session: string }): Promise<any>;
  save(options: { session: string; data: any }): Promise<void>;
  delete(options: { session: string }): Promise<void>;
  extract(session: any): any;
}
