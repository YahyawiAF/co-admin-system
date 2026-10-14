import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from 'database/prisma.service';
import { ErpClientService } from './erp-client.service';
import { SyncOutboxService } from './sync-outbox.service';
import { SyncMappingService } from './sync-mapping.service';
import { SyncProcessorService } from './sync-processor.service';

/**
 * Bridge to supply-chain-pro: pushes members/tariffs/abonnements/journals there as
 * customers/products/invoices/payments via its existing REST API. That project's
 * code is never touched — this module is only an HTTP client + a durable queue.
 */
@Module({
  imports: [
    HttpModule.register({ timeout: 15000, maxRedirects: 0 }),
    ConfigModule.forRoot(),
  ],
  providers: [
    PrismaService,
    ErpClientService,
    SyncOutboxService,
    SyncMappingService,
    SyncProcessorService,
  ],
  exports: [SyncOutboxService],
})
export class ErpSyncModule {}
