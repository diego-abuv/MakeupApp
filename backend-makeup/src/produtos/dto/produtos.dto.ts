import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarProdutoDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do produto é obrigatório' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Categoria deve ter no máximo 50 caracteres' })
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Unidade deve ter no máximo 10 caracteres' })
  unidade?: string;
}

export class AtualizarProdutoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unidade?: string;
}

export class CriarCompraDto {
  @IsUUID('4', { message: 'Produto inválido' })
  produtoId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantidade inválida' })
  @Min(0.001, { message: 'Quantidade deve ser maior que zero' })
  quantidade: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  valorTotal: number;

  @IsDateString({}, { message: 'Data da compra inválida' })
  dataCompra: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Observação deve ter no máximo 255 caracteres' })
  observacao?: string;
}

export class AtualizarCompraDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantidade?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorTotal?: number;

  @IsOptional()
  @IsDateString()
  dataCompra?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacao?: string;
}

export class EncerrarCompraDto {
  @IsDateString({}, { message: 'Data de fim inválida' })
  dataFim: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Observação deve ter no máximo 255 caracteres' })
  observacao?: string;
}