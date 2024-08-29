import mongoose from 'mongoose';
import { MongoStore } from 'wwebjs-mongo';

// Configura Mongoose
mongoose.connect(process.env.URI_MONGODB as string);

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

export default store;
