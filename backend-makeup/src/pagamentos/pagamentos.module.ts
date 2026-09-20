import { Module } from '@nestjs/common';
import { PagamentosController } from './pagamentos.controller';
import { PagamentosService } from './pagamentos.service';
import { AsaasGateway } from './gateway/asaas.gateway';
import { GATEWAY_PAGAMENTO } from './gateway/gateway.interface';
import { AgendamentosModule } from '../agendamentos/agendamentos.module';
import { AuthModule } from '../auth/auth.module';
import { GATEWAY_PRIMARY } from '../makeup.config';

const gatewayProvider = {
  provide: GATEWAY_PAGAMENTO,
  useFactory: () => {
    if (GATEWAY_PRIMARY === 'asaas') {
      return new AsaasGateway();
    }
    throw new Error(`Gateway desconhecido: ${GATEWAY_PRIMARY}`);
  },
};

@Module({
  imports: [AgendamentosModule, AuthModule],
  controllers: [PagamentosController],
  providers: [gatewayProvider, PagamentosService],
})
export class PagamentosModule {}