import mongoose from 'mongoose';
import { Store } from 'whatsapp-web.js';

// Definir el esquema de sesión para MongoDB
const sessionSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  sessionData: { type: mongoose.Schema.Types.Mixed, required: true },
});

const SessionModel = mongoose.model('Session', sessionSchema);

// Implementar la clase CustomSessionStore
export class CustomSessionStore implements Store {
  // Verificar si la sesión existe
  public async sessionExists(options: { session: string }): Promise<boolean> {
    try {
      const count = await SessionModel.countDocuments({
        clientId: options.session,
      }).exec();
      return count > 0;
    } catch (error) {
      console.error('Error checking session existence:', error);
      return false;
    }
  }

  // Obtener una sesión específica
  public async getSession(options: { session: string }): Promise<any> {
    const result = await SessionModel.findOne({
      clientId: options.session,
    }).exec();
    return result ? result.sessionData : null;
  }

  // Guardar una sesión
  public async save(options: { session: string; data: any }): Promise<void> {
    try {
      await SessionModel.updateOne(
        { clientId: options.session },
        { clientId: options.session, sessionData: options.data },
        { upsert: true, runValidators: true },
      );
      console.log(`Session ${options.session} saved successfully`);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  // Eliminar una sesión
  public async delete(options: { session: string }): Promise<void> {
    await SessionModel.deleteOne({ clientId: options.session }).exec();
  }

  // Método para extraer los datos de la sesión (para 'Store')
  public async extract(options: { session: string }): Promise<any> {
    const result = await SessionModel.findOne({
      clientId: options.session,
    }).exec();
    return result ? result.sessionData : null;
  }
}
