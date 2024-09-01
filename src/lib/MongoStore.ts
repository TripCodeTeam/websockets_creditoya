import mongoose from 'mongoose';
import { MongoStore } from 'wwebjs-mongo';
import { ConfigService } from '@nestjs/config';

export async function initializeMongoStore(): Promise<typeof MongoStore> {
  const configService = new ConfigService();

  const mongoUri = configService.get<string>('URI_MONGODB');
  // console.log(mongoUri);

  if (!mongoUri)
    throw new Error('MongoDB URI is not defined in environment variables');

  // Configura Mongoose
  mongoose.connect(mongoUri);

  // Define un esquema para las sesiones de WhatsApp
  const sessionSchema = new mongoose.Schema(
    {
      id: { type: String, required: true },
      data: { type: String, required: true },
    },
    { timestamps: true },
  );

  const SessionModel = mongoose.model('Session', sessionSchema);

  // Configura MongoStore para usar Mongoose
  const store = new MongoStore({
    collectionName: 'sessions', // Nombre de la colección para guardar sesiones
    model: SessionModel,
    mongoose,
  });

  return store;
}

export default initializeMongoStore;
