import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { ThrottleGuard } from './guards/throttle.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AdminGuard, ThrottleGuard],
  exports: [AuthService, JwtAuthGuard, AdminGuard, ThrottleGuard],
})
export class AuthModule {}
