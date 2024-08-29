import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('create-session')
  async createSession(@Body('id') id: string) {
    await this.whatsappService.createSession(id)
    return { message: 'Session created' };
  }

  @Get('session/:id')
  async getSession(
    @Param('id') id: string,
  ) {
    const session = await this.whatsappService.getSession(id);
    return { session };
  }
}
