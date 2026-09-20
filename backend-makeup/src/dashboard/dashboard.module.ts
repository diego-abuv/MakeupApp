import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ProdutosModule } from '../produtos/produtos.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ProdutosModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}