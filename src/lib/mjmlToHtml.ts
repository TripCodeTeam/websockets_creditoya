import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';

@Injectable()
export class MjmlService {
  private readonly apiUrl = 'https://api.mjml.io/v1/render';
  private readonly appId: string;
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>('MJMLApplicationID');
    this.secretKey = this.configService.get<string>('MJMLSecretKey');

    if (!this.appId || !this.secretKey) {
      throw new Error('MJML Application ID and Secret Key must be defined');
    }
  }

  async convertToHTML(content: string): Promise<string> {
    try {
      // Verifica que el contenido no esté vacío
      if (!content) {
        throw new Error('MJML content is required.');
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.appId}:${this.secretKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mjml: content }),
      });

      // Verifica si la respuesta es exitosa
      if (!response.ok) {
        const errorMessage = await response.text();
        console.error('Error details:', errorMessage);
        throw new InternalServerErrorException(
          `Error converting MJML to HTML: ${response.status} - ${response.statusText}`,
        );
      }

      // Parsear el resultado a JSON
      const result = await response.json();

      // Extraer el HTML del resultado
      return result.html;
    } catch (error) {
      // Manejo del error
      if (error instanceof Error) {
        console.error('Error converting MJML:', error.message);
      } else {
        console.error('Unknown error:', error);
      }
      throw error; // Lanza el error para que la función que lo llama lo maneje
    }
  }
}
