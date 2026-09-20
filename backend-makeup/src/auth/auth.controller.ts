import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ThrottleGuard } from './guards/throttle.guard';
import { REFRESH_EXPIRES_HOURS } from './auth.constants';
import type { Response, Request } from 'express';
import type { AuthenticatedRequest } from './guards/jwt-auth.guard';

const COOKIE_MAX_AGE = REFRESH_EXPIRES_HOURS * 60 * 60 * 1000;
const REFRESH_COOKIE_NAME = 'makeup_refresh';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottleGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ access_token: string }> {
    const resultado = await this.authService.login(dto);
    this.definirRefreshCookie(res, resultado.refresh_token);
    return { access_token: resultado.access_token };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ access_token: string }> {
    const atual: string =
      typeof req.cookies?.[REFRESH_COOKIE_NAME] === 'string'
        ? req.cookies[REFRESH_COOKIE_NAME]
        : '';
    const resultado = await this.authService.refresh(atual);
    this.definirRefreshCookie(res, resultado.refresh_token);
    return { access_token: resultado.access_token };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const atual: string =
      typeof req.cookies?.[REFRESH_COOKIE_NAME] === 'string'
        ? req.cookies[REFRESH_COOKIE_NAME]
        : '';
    await this.authService.logout(atual);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return { message: 'Logout realizado com sucesso' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest): unknown {
    return req.user;
  }

  private definirRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }
}
