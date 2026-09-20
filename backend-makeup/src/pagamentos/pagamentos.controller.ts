import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  PagamentosService,
  PixSinal,
  WebhookProcessado,
} from './pagamentos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CancelarSinalDto } from './dto/pagamentos.dto';

export interface WebhookAsaasBody {
  event?: string;
  payment?: { id?: string };
}

@Controller()
export class PagamentosController {
  constructor(private readonly pagamentosService: PagamentosService) {}

  @Post('agendamentos/:id/pix')
  async gerarPix(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PixSinal> {
    return this.pagamentosService.gerarPix(id);
  }

  @Get('agendamentos/:id/pix')
  async obterPix(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PixSinal> {
    return this.pagamentosService.obterPix(id);
  }

  @Get('agendamentos/:id/sinal-status')
  async obterStatusSinal(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ status: string; pagamentoStatus: string }> {
    return this.pagamentosService.obterStatusSinal(id);
  }

  @Post('pagamentos/webhook/asaas')
  async webhookAsaas(
    @Headers('asaas-access-token') token: string,
    @Headers('authorization') authorization: string,
    @Body() body: WebhookAsaasBody,
  ): Promise<WebhookProcessado> {
    const tokenDoHeader = token ?? authorization?.replace(/^Bearer\s+/i, '');
    if (!tokenDoHeader) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }
    return this.pagamentosService.processarWebhook(tokenDoHeader, body);
  }

  @Post('agendamentos/:id/cancelar-sinal')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async cancelarSinal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: CancelarSinalDto,
  ): Promise<{ id: string }> {
    return this.pagamentosService.cancelarSinal(id);
  }
}