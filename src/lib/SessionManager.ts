import { CustomSessionStore } from './CustoMongoStore'; // Asegúrate de que esta sea la ruta correcta
import mongoose from 'mongoose';

export class SessionManager implements CustomSessionStore {
  private sessionModel: mongoose.Model<any>;

  constructor() {
    this.sessionModel = mongoose.model(
      'Session',
      new mongoose.Schema({
        cliendId: String,
      }),
    );
  }

  public async sessionExists(options: { session: string }): Promise<boolean> {
    try {
      const count = await this.sessionModel
        .countDocuments({ clientId: options.session })
        .exec();
      return count > 0;
    } catch (error) {
      console.error('Error checking session existence:', error);
      return false;
    }
  }

  public async save(options: { session: string; data: any }): Promise<void> {
    try {
      await this.sessionModel.updateOne(
        { clientId: options.session },
        { $set: options.data },
        { upsert: true },
      );
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  public async getSession(options: { session: string }): Promise<any> {
    try {
      const session = await this.sessionModel
        .findOne({ clientId: options.session })
        .exec();
      return session || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  public async delete(options: { session: string }): Promise<void> {
    try {
      await this.sessionModel.deleteOne({ clientId: options.session }).exec();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  public extract(session: any): any {
    return session;
  }
}
