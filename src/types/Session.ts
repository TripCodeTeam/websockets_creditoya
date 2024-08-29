import { Client } from "whatsapp-web.js";

export interface Session {
  [key: string]: Client;
}
