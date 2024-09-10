import mongoose from 'mongoose';

// Definir el esquema de sesión para MongoDB
const sessionSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  sessionData: { type: mongoose.Schema.Types.Mixed, required: true },
});

// Define el modelo una sola vez
const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);

export default SessionModel;
