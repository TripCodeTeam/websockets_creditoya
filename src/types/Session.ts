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
