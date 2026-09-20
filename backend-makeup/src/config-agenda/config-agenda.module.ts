import { Module } from '@nestjs/common';
import { ConfigAgendaService } from './config-agenda.service';
import { ConfigAgendaController } from './config-agenda.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConfigAgendaController],
  providers: [ConfigAgendaService],
  exports: [ConfigAgendaService],
})
export class ConfigAgendaModule {}
