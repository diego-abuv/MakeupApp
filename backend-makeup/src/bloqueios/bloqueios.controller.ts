import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BloqueiosService } from './bloqueios.service';
import { CriarBloqueioDto } from './dto/criar-bloqueio.dto';
import { BloqueioRow } from '../types/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('bloqueios')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BloqueiosController {
  constructor(private readonly bloqueiosService: BloqueiosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criar(@Body() dto: CriarBloqueioDto): Promise<BloqueioRow> {
    return this.bloqueiosService.criar(dto);
  }

  @Get()
  async listar(): Promise<BloqueioRow[]> {
    return this.bloqueiosService.listar();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bloqueiosService.remover(id);
  }
}
