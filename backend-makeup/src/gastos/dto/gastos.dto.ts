import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const CATEGORIAS = ['CURSO', 'FERRAMENTA', 'TRANSPORTE', 'OUTRO'] as const;

export class CriarGastoDto {
  @IsString()
  @IsNotEmpty({ message: 'Categoria é obrigatória' })
  categoria: string;

  @IsString()
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  @MaxLength(200, { message: 'Descrição deve ter no máximo 200 caracteres' })
  descricao: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  valor: number;

  @IsDateString({}, { message: 'Data inválida' })
  data: string;
}

export class AtualizarGastoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoria?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descricao?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor?: number;

  @IsOptional()
  @IsDateString()
  data?: string;
}

export { CATEGORIAS };