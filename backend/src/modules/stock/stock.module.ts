import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { ExpensesModule } from '../expense/expense.module';
import { EventsModule } from '../webSocket/events.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [ExpensesModule, EventsModule],
  controllers: [StockController],
  providers: [StockService, PrismaService],
  exports: [StockService],
})
export class StockModule {}
