import { IsIn, IsNotEmpty, IsString } from 'class-validator';

const STATUS_VALIDOS = ['CONCLUIDO', 'CANCELADO'] as const;

export class AtualizarStatusAgendamentoDto {
  @IsString()
  @IsNotEmpty({ message: 'Status é obrigatório' })
  @IsIn(STATUS_VALIDOS, {
    message: 'Status deve ser CONCLUIDO ou CANCELADO',
  })
  status: string;
}
