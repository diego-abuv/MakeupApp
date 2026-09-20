import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { AuthUserPayload } from '../auth.constants';

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Sessão não fornecida');
    }

    const token = authHeader.split(' ')[1];
    request.user = this.authService.verificarAccessToken(token);
    return true;
  }
}
