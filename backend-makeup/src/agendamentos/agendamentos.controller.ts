import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service';
import { SlotDisponibilidade } from './agendamentos.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { AtualizarStatusAgendamentoDto } from './dto/atualizar-status-agendamento.dto';
import { AgendamentoComServico, AgendamentoRow } from '../types/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('agendamentos')
export class AgendamentosController {
  constructor(private readonly agendamentosService: AgendamentosService) {}

  @Get('disponiveis')
  async obterHorariosDisponiveis(
    @Query('servicoId') servicoId: string,
    @Query('data') data: string,
  ): Promise<SlotDisponibilidade[]> {
    return this.agendamentosService.obterHorariosDisponiveis(servicoId, data);
  }

  @Get('meus')
  async listarMeus(
    @Query('whatsapp') whatsapp: string,
  ): Promise<AgendamentoComServico[]> {
    return this.agendamentosService.listarMeusAgendamentos(whatsapp);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listarAgendaDoDia(
    @Query('data') data: string,
  ): Promise<AgendamentoComServico[]> {
    return this.agendamentosService.listarAgendaDoDia(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criar(@Body() dto: CriarAgendamentoDto): Promise<AgendamentoRow> {
    return this.agendamentosService.criarAgendamento(dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async atualizarStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarStatusAgendamentoDto,
  ): Promise<AgendamentoRow> {
    return this.agendamentosService.atualizarStatus(id, dto);
  }
}
