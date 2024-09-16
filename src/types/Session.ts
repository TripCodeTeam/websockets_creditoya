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

export type messageReq = {
  sessionId: string;
  phones: [x: string];
  names: string;
  message: string;
  files: string[];
};
