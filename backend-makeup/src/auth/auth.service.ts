import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { Database } from '../types/database';
import {
  ACCESS_EXPIRES,
  AuthUserPayload,
  JWT_SECRET,
  REFRESH_EXPIRES_HOURS,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';

type AdminUserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  blocked: boolean | null;
};

type AdminIdentidade = Pick<AdminUserRow, 'id' | 'username' | 'role'>;

const REFRESH_VALIDADE_MS = REFRESH_EXPIRES_HOURS * 60 * 60 * 1000;

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private signAccessToken(user: AdminIdentidade): string {
    const payload: AuthUserPayload = {
      id: user.id,
      username: user.username,
      role: 'admin',
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
      issuer: 'makeupapp',
    });
  }

  private async novoRefreshToken(userId: string): Promise<string> {
    const raw = crypto.randomBytes(40).toString('hex');
    const hash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + REFRESH_VALIDADE_MS).toISOString();

    const { error } = await this.supabase.from('refresh_tokens').insert({
      user_id: userId,
      token_hash: hash,
      expires_at: expiresAt,
    });

    if (error) {
      throw new Error('Erro ao gerar token de sessão');
    }

    return raw;
  }

  private async revogarRefreshToken(raw: string): Promise<void> {
    const hash = this.hashToken(raw);
    await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('token_hash', hash);
  }

  private async revogarTodosDoUsuario(userId: string): Promise<void> {
    await this.supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('user_id', userId)
      .eq('revoked', false);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const username = dto.username.toLowerCase().trim();
    const { data: user, error } = await this.supabase
      .from('admin_users')
      .select('id, username, password_hash, role, blocked')
      .eq('username', username)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(dto.password, user.password_hash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.blocked) {
      throw new UnauthorizedException(
        'Conta bloqueada. Contate o administrador.',
      );
    }

    await this.revogarTodosDoUsuario(user.id);

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.novoRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Token de sessão ausente');
    }

    const hash = this.hashToken(refreshToken);
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('refresh_tokens')
      .select('user_id, revoked, expires_at')
      .eq('token_hash', hash)
      .maybeSingle();

    if (error || !data) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
    if (data.revoked) {
      throw new UnauthorizedException('Sessão revogada');
    }
    if (new Date(data.expires_at) <= new Date(now)) {
      throw new UnauthorizedException('Sessão expirada');
    }

    const { data: user, error: userError } = await this.supabase
      .from('admin_users')
      .select('id, username, role, blocked')
      .eq('id', data.user_id)
      .maybeSingle();

    if (userError || !user || user.blocked) {
      throw new UnauthorizedException('Usuário inválido');
    }

    // Sem rotação: o refresh token é revogado apenas no logout explícito
    // ou quando expira. Garante sessão persistente entre recarregamentos.
    const accessToken = this.signAccessToken(user);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.revogarRefreshToken(refreshToken);
    }
  }

  verificarAccessToken(token: string): AuthUserPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'makeupapp',
      }) as AuthUserPayload;
      if (decoded.role !== 'admin') {
        throw new UnauthorizedException('Acesso restrito a administradores');
      }
      return decoded;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Sessão expirada');
      }
      throw new UnauthorizedException('Sessão inválida');
    }
  }
}
