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
import { ProdutosService } from './produtos.service';
import {
  AtualizarCompraDto,
  AtualizarProdutoDto,
  CriarCompraDto,
  CriarProdutoDto,
  EncerrarCompraDto,
} from './dto/produtos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller()
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Get('produtos')
  async listarProdutos() {
    return this.produtosService.listarProdutos();
  }

  @Post('produtos')
  async criarProduto(@Body() dto: CriarProdutoDto) {
    return this.produtosService.criarProduto(dto);
  }

  @Patch('produtos/:id')
  async atualizarProduto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarProdutoDto,
  ) {
    return this.produtosService.atualizarProduto(id, dto);
  }

  @Delete('produtos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerProduto(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.produtosService.removerProduto(id);
  }

  @Get('compras')
  async listarCompras() {
    return this.produtosService.listarCompras();
  }

  @Post('compras')
  async criarCompra(@Body() dto: CriarCompraDto) {
    return this.produtosService.criarCompra(dto);
  }

  @Patch('compras/:id')
  async atualizarCompra(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarCompraDto,
  ) {
    return this.produtosService.atualizarCompra(id, dto);
  }

  @Delete('compras/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerCompra(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.produtosService.removerCompra(id);
  }

  @Post('compras/:id/encerrar')
  async encerrarCompra(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EncerrarCompraDto,
  ) {
    return this.produtosService.encerrarCompra(id, dto);
  }
}