import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATA_HORA_LOCAL_PATTERN } from '../../agendamentos/dto/criar-agendamento.dto';

const DIAS_SEMANA = [0, 1, 2, 3, 4, 5, 6] as const;
const TIPOS = ['ALMOCO', 'FOLGA', 'IMPREVISTO'] as const;

export class CriarBloqueioDto {
  @Matches(DATA_HORA_LOCAL_PATTERN, {
    message:
      'Data e hora de início devem estar no formato YYYY-MM-DDTHH:mm (hora local)',
  })
  dataHoraInicio: string;

  @Matches(DATA_HORA_LOCAL_PATTERN, {
    message:
      'Data e hora de fim devem estar no formato YYYY-MM-DDTHH:mm (hora local)',
  })
  dataHoraFim: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Motivo deve ter no máximo 100 caracteres' })
  motivo?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'Recorrente deve ser true ou false' })
  recorrente?: boolean;

  @IsOptional()
  @IsInt({ message: 'dia_semana deve ser um número de 0 a 6' })
  @IsIn(DIAS_SEMANA, {
    message: 'dia_semana deve ser 0 (domingo) a 6 (sábado)',
  })
  dia_semana?: number;

  @IsOptional()
  @IsIn(TIPOS, {
    message: 'tipo deve ser ALMOCO, FOLGA ou IMPREVISTO',
  })
  tipo?: (typeof TIPOS)[number];
}
