import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ServicosService, ServicoVisao } from './servicos.service';
import { AtualizarServicoDto, CriarServicoDto } from './dto/servico.dto';
import { ServicoRow } from '../types/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

type ServicoPublico = Pick<
  ServicoRow,
  'id' | 'nome' | 'preco' | 'duracao_minutos' | 'categoria'
>;

@Controller('servicos')
export class ServicosController {
  constructor(private readonly servicosService: ServicosService) {}

  @Get()
  async listarAtivos(): Promise<ServicoPublico[]> {
    return this.servicosService.listarAtivos();
  }

  @Get('todos')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listarTodos(): Promise<ServicoVisao[]> {
    return this.servicosService.listarTodos();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async criar(@Body() dto: CriarServicoDto): Promise<ServicoVisao> {
    return this.servicosService.criar(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarServicoDto,
  ): Promise<ServicoVisao> {
    return this.servicosService.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.servicosService.remover(id);
  }
}
