import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const CORS: CorsOptions = {
  origin: 'http://localhost:3001',
  methods: 'GET, PUT, POST, DELETE',
  allowedHeaders: 'Content-Type, Authorization',
  credentials: true,
};
