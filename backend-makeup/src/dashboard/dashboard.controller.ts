import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService, DashboardResumo } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  resumo(): Promise<DashboardResumo> {
    return this.dashboardService.resumo();
  }
}