import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_.]{3,50}$/, {
    message:
      'Usuário inválido (use 3 a 50 caracteres: letras, números, ponto ou underline)',
  })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;
}
