import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { PrismaModule } from 'database/prisma.module';
import { OpsEventsModule } from '../modules/ops-events/ops-events.module';

@Module({
  imports: [PrismaModule, OpsEventsModule],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
