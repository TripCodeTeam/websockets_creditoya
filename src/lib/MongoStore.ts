import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import { CustomSessionStore } from './CustoMongoStore';

export async function initializeMongoStore(): Promise<CustomSessionStore> {
  const configService = new ConfigService();
  const mongoUri = configService.get<string>('URI_MONGODB');

  if (!mongoUri)
    throw new Error('MongoDB URI is not defined in environment variables');

  // Configura Mongoose
  await mongoose.connect(mongoUri);

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
  });

  mongoose.connection.once('open', () => {
    console.log('MongoDB connected successfully');
  });

  // Configura CustomSessionStore
  const sessionManager = new CustomSessionStore();

  return sessionManager;
}
