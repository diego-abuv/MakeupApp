import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarServicoDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do serviço é obrigatório' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  nome: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço inválido' })
  @Min(0, { message: 'Preço não pode ser negativo' })
  preco: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Duração inválida' })
  @Min(5, { message: 'Duração mínima de 5 minutos' })
  duracao_minutos: number;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Categoria deve ter no máximo 50 caracteres' })
  categoria?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class AtualizarServicoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Nome do serviço é obrigatório' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  nome?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço inválido' })
  @Min(0, { message: 'Preço não pode ser negativo' })
  preco?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Duração inválida' })
  @Min(5, { message: 'Duração mínima de 5 minutos' })
  duracao_minutos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Categoria deve ter no máximo 50 caracteres' })
  categoria?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
