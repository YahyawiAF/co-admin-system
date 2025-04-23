import { Module } from '@nestjs/common';
import { ExpensesController } from './expense.controller';
import { ExpensesService } from './expense.service';
import { PrismaService } from 'database/prisma.service';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, PrismaService],
})
export class ExpensesModule {}
