import { Module } from '@nestjs/common';
import { ExpensesController } from './expense.controller';
import { ExpensesService } from './expense.service';
import { PrismaService } from 'database/prisma.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [ExpensesController],
  providers: [ExpensesService, PrismaService],
})
export class ExpensesModule {}
