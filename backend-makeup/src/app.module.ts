import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AgendamentosModule } from './agendamentos/agendamentos.module';
import { ServicosModule } from './servicos/servicos.module';
import { BloqueiosModule } from './bloqueios/bloqueios.module';
import { AuthModule } from './auth/auth.module';
import { PagamentosModule } from './pagamentos/pagamentos.module';
import { ProdutosModule } from './produtos/produtos.module';
import { GastosModule } from './gastos/gastos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ConfigAgendaModule } from './config-agenda/config-agenda.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AgendamentosModule,
    ServicosModule,
    BloqueiosModule,
    AuthModule,
    PagamentosModule,
    ProdutosModule,
    GastosModule,
    DashboardModule,
    ConfigAgendaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
