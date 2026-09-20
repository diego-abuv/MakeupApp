import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export const DATA_HORA_LOCAL_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export const CPF_PATTERN = /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/;

export class CriarAgendamentoDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome completo é obrigatório' })
  clienteNome: string;

  @IsString()
  @IsNotEmpty({ message: 'WhatsApp é obrigatório' })
  @Matches(/^[0-9]{10,13}$/, {
    message: 'WhatsApp deve conter apenas números (DDI + DDD + número)',
  })
  clienteWhatsapp: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  clienteEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'CPF é obrigatório' })
  @Matches(CPF_PATTERN, {
    message: 'CPF deve estar no formato 000.000.000-00 ou conter 11 dígitos',
  })
  clienteCpf: string;

  @IsUUID('4', { message: 'Serviço inválido' })
  servicoId: string;

  @Matches(DATA_HORA_LOCAL_PATTERN, {
    message:
      'Data e hora de início devem estar no formato YYYY-MM-DDTHH:mm (hora local)',
  })
  dataHoraInicio: string;

  @IsOptional()
  @IsString()
  aceite?: string;
}

export function somenteDigitos(value: string): string {
  return value.replace(/\D/g, '');
}

export function cpfValido(cpf: string): boolean {
  const digitos = somenteDigitos(cpf);
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) {
    return false;
  }

  const calcularDigito = (base: number): number => {
    let soma = 0;
    for (let i = 0; i < base; i++) {
      soma += Number(digitos[i]) * (base + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  if (calcularDigito(9) !== Number(digitos[9])) return false;
  if (calcularDigito(10) !== Number(digitos[10])) return false;
  return true;
}