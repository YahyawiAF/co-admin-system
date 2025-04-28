// src/expenses/expenses.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ExpensesService } from './expense.service';
import { ExpenseEntity } from './entities/exp.entitie';
import { CreateExpenseDto } from './dtos/createExp.dto';
import { UpdateExpDto } from './dtos/updateExp.dto';

@Controller('expenses')
@ApiTags('Expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create new expense' })
  @ApiResponse({
    status: 201,
    description: 'Expense successfully created',
    type: ExpenseEntity,
  })
  async create(@Body() createExpenseDto: CreateExpenseDto) {
    return this.expensesService.create(createExpenseDto);
  }

  
  @Get()
  @ApiOperation({ summary: 'Get all expenses' })
  @ApiResponse({
    status: 200,
    description: 'Expenses list',
    type: [ExpenseEntity],
  })
  async findAll() {
    return this.expensesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  @ApiResponse({
    status: 200,
    description: 'Expense details',
    type: ExpenseEntity,
  })
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update expense' })
  @ApiResponse({
    status: 200,
    description: 'Updated expense',
    type: ExpenseEntity,
  })
  async update(@Param('id') id: string, @Body() updateExpDto: UpdateExpDto) {
    return this.expensesService.update(id, updateExpDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete expense' })
  @ApiResponse({ status: 204, description: 'Expense successfully deleted' })
  async remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }


  @Post('daily')
  @ApiOperation({ summary: 'Create new daily expense' })
  @ApiResponse({
    status: 201,
    description: 'Daily expense successfully created',
  })
  async createDailyExpense(@Body() body: { expenseId: string; date?: string ;Summary?: string }) {
    const date = body.date ? new Date(body.date) : undefined;
    return this.expensesService.createDailyExpense({
      expenseId: body.expenseId,
      date,
      Summary: body.Summary,

    });
  }

  @Patch('daily/:id')
  @ApiOperation({ summary: 'Update daily expense' })
  @ApiParam({ name: 'id', description: 'Daily expense ID' })
  @ApiResponse({
    status: 200,
    description: 'Daily expense updated',
  })
  async updateDailyExpense(
    @Param('id') id: string,
    @Body() body: { expenseId?: string; date?: string ;Summary?: string },
  ) {
    const date = body.date ? new Date(body.date) : undefined;
    return this.expensesService.updateDailyExpense(id, {
      expenseId: body.expenseId,
      date,
      Summary: body.Summary,
    });
  }

  @Delete('daily/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete daily expense' })
  @ApiParam({ name: 'id', description: 'Daily expense ID' })
  @ApiResponse({
    status: 204,
    description: 'Daily expense successfully deleted',
  })
  async removeDailyExpense(@Param('id') id: string) {
    return this.expensesService.removeDailyExpense(id);
  }

  @Get('daily/all')
  @ApiOperation({ summary: 'Get all daily expenses' })
  @ApiResponse({
    status: 200,
    description: 'List of all daily expenses',
  })
  async findAllDailyExpenses() {
    return this.expensesService.findAllDailyExpenses();
  }

  @Get('daily/:id')
  @ApiOperation({ summary: 'Get daily expense by ID' })
  @ApiParam({ name: 'id', description: 'Daily expense ID' })
  @ApiResponse({
    status: 200,
    description: 'Daily expense details',
  })
  async findOneDailyExpense(@Param('id') id: string) {
    return this.expensesService.findOneDailyExpense(id);
  }

}
