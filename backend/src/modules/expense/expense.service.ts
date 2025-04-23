// src/expenses/expenses.service.ts
import { Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dtos/createExp.dto';
import { ExpenseEntity } from './entities/exp.entitie';
import { UpdateExpDto } from './dtos/updateExp.dto';
import { PrismaService } from 'database/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}
  async create(createExpenseDto: CreateExpenseDto) {
    return new ExpenseEntity(
      await this.prisma.expense.create({
        data: {
          ...createExpenseDto,
          amount: createExpenseDto.amount,
        },
      }),
    );
  }

  async findAll() {
    const expenses = await this.prisma.expense.findMany();
    return expenses.map((expense) => new ExpenseEntity(expense));
  }

  async findOne(id: string) {
    return new ExpenseEntity(
      await this.prisma.expense.findUnique({ where: { id } }),
    );
  }

  async update(id: string, updateExpDto: UpdateExpDto) {
    return new ExpenseEntity(
      await this.prisma.expense.update({
        where: { id },
        data: {
          ...updateExpDto,
          amount: updateExpDto.amount,
        },
      }),
    );
  }

  async remove(id: string) {
    return new ExpenseEntity(
      await this.prisma.expense.delete({ where: { id } }),
    );
  }
}
