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

export class EncerrarCompraDto {
  @IsDateString({}, { message: 'Data de fim inválida' })
  dataFim: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Observação deve ter no máximo 255 caracteres' })
  observacao?: string;
}

export class ValorDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @Min(0, { message: 'Valor não pode ser negativo' })
  valor: number;
}

export class CancelarSinalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  motivo?: string;
}