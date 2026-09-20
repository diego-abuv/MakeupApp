import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';

const mockSupabaseClient = {
  from: jest.fn(),
};

const PASSWORD_HASH = bcrypt.hashSync('senha123', 10);
const ADMIN = {
  id: 'admin-uuid-1',
  username: 'admin.bar',
  password_hash: PASSWORD_HASH,
  role: 'admin',
  blocked: false,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabaseClient },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('AT-01: deve autenticar com credenciais válidas e retornar tokens', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'admin_users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: ADMIN, error: null }),
          };
        }
        if (table === 'refresh_tokens') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            mockResolvedValue: jest.fn(),
          };
        }
        throw new Error(`tabela inesperada: ${table}`);
      });

      const resultado = await service.login({
        username: 'admin.bar',
        password: 'senha123',
      });

      expect(resultado.access_token).toBeTruthy();
      expect(resultado.refresh_token).toBeTruthy();
      expect(resultado.expires_in).toBe(900);
    });

    it('AT-02: deve rejeitar senha incorreta', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'admin_users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: ADMIN, error: null }),
          };
        }
        throw new Error(`tabela inesperada: ${table}`);
      });

      await expect(
        service.login({ username: 'admin.bar', password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('AT-03: deve rejeitar usuário inexistente', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'admin_users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        throw new Error(`tabela inesperada: ${table}`);
      });

      await expect(
        service.login({ username: 'nao.existe', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('AT-04: deve rejeitar conta bloqueada', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'admin_users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...ADMIN, blocked: true },
              error: null,
            }),
          };
        }
        throw new Error(`tabela inesperada: ${table}`);
      });

      await expect(
        service.login({ username: 'admin.bar', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('AT-05: deve renovar access token sem revogar o refresh token', async () => {
      let revogado = false;
      let chamadasUpdate = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'refresh_tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                user_id: ADMIN.id,
                revoked: revogado,
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              },
              error: null,
            }),
            update: (fields: object) => {
              if ('revoked' in fields) revogado = true;
              chamadasUpdate += 1;
              return {
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
              };
            },
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'admin_users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: ADMIN, error: null }),
          };
        }
        throw new Error(`tabela inesperada: ${table}`);
      });

      const resultado = await service.refresh('token-de-testes');

      expect(resultado.access_token).toBeTruthy();
      expect(resultado.refresh_token).toBe('token-de-testes');
      expect(revogado).toBe(false);
      expect(chamadasUpdate).toBe(0);
    });

    it('AT-06: deve rejeitar refresh revogado', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'refresh_tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                user_id: ADMIN.id,
                revoked: true,
                expires_at: new Date().toISOString(),
              },
              error: null,
            }),
          };
        }
        throw new Error(`tabela inesperada: ${table}`);
      });

      await expect(service.refresh('token-revogado')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('AT-07: deve rejeitar token ausente', async () => {
      await expect(service.refresh('')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verificarAccessToken', () => {
    it('AT-08: deve rejeitar token inválido', () => {
      expect(() => service.verificarAccessToken('token-invalido')).toThrow(
        UnauthorizedException,
      );
    });
  });
});
