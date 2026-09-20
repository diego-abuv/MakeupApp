import { IsArray, IsInt, IsIn, IsString, Matches } from 'class-validator';

const HORARIO_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ExpedienteDiaDto {
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5, 6])
  dia_semana!: number;

  @IsString()
  @Matches(HORARIO_PATTERN, {
    message: 'hora_inicio deve estar no formato HH:mm (00:00 – 23:59)',
  })
  hora_inicio!: string;

  @IsString()
  @Matches(HORARIO_PATTERN, {
    message: 'hora_fim deve estar no formato HH:mm (00:00 – 23:59)',
  })
  hora_fim!: string;
}

export class AtualizarExpedienteDto {
  @IsArray()
  expediente!: ExpedienteDiaDto[];
}
