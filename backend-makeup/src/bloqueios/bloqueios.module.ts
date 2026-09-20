import { Module } from '@nestjs/common';
import { BloqueiosService } from './bloqueios.service';
import { BloqueiosController } from './bloqueios.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BloqueiosController],
  providers: [BloqueiosService],
})
export class BloqueiosModule {}
