import { Module } from '@nestjs/common';
import { GastosController } from './gastos.controller';
import { GastosService } from './gastos.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GastosController],
  providers: [GastosService],
})
export class GastosModule {}