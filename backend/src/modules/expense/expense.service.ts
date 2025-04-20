// src/expenses/expenses.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateExpenseDto } from './dtos/createExp.dto';
import { ExpenseEntity } from './entities/exp.entitie';
import { UpdateExpDto } from './dtos/updateExp.dto';

@Injectable()
export class ExpensesService {
  private prisma = new PrismaClient();

  async create(createExpenseDto: CreateExpenseDto) {
    return new ExpenseEntity(
      await this.prisma.expense.create({
        data: {
          ...createExpenseDto,
          amount: createExpenseDto.amount,
          createdAt: new Date(),
          updatedAt: new Date(),
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
          updatedAt: new Date(),
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