import { Module } from '@nestjs/common';
import { ExpensesController } from './expense.controller';
import { ExpensesService } from './expense.service';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
