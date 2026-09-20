import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigAgendaService, ExpedienteDia } from './config-agenda.service';
import { AtualizarExpedienteDto } from './dto/config-agenda.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('config-agenda')
export class ConfigAgendaController {
  constructor(private readonly configAgendaService: ConfigAgendaService) {}

  @Get()
  async obter(): Promise<ExpedienteDia[]> {
    return this.configAgendaService.obter();
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async atualizar(
    @Body() dto: AtualizarExpedienteDto,
  ): Promise<ExpedienteDia[]> {
    return this.configAgendaService.atualizar(dto.expediente);
  }
}
