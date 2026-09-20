import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { LOGIN_MAX_TENTATIVAS, LOGIN_WINDOW_MS } from '../auth.constants';
import { Request } from 'express';

interface Tentativa {
  contagem: number;
  resetEm: number;
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly tentativas = new Map<string, Tentativa>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string'
        ? forwarded.split(',')[0]
        : undefined
      )?.trim() ||
      request.ip ||
      'unknown';

    const agora = Date.now();
    const atual = this.tentativas.get(ip);

    if (!atual || agora > atual.resetEm) {
      this.tentativas.set(ip, {
        contagem: 1,
        resetEm: agora + LOGIN_WINDOW_MS,
      });
      return true;
    }

    if (atual.contagem >= LOGIN_MAX_TENTATIVAS) {
      const segundos = Math.ceil((atual.resetEm - agora) / 1000);
      throw new HttpException(
        {
          message: `Muitas tentativas. Tente novamente em ${segundos}s.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    atual.contagem += 1;
    return true;
  }
}
