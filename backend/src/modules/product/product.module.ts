import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { ProductsController } from './product.controller';
import { ProductsService } from './product.service';
import { EventsModule } from '../webSocket/events.module';
import { ErpSyncModule } from '../erp-sync/erp-sync.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [EventsModule, ErpSyncModule, StockModule],
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService],
})
export class ProductsModule {}
