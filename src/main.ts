import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { CORS } from './constants/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  // console.log(configService.get('PORT'));

  app.enableCors(CORS);
  // app.setGlobalPrefix('api');

  await app.listen(configService.get('PORT'));
}
bootstrap();
