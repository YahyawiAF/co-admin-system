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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ExpensesService, QuickExpenseInput } from './expense.service';
import { ExpenseEntity } from './entities/exp.entitie';
import { CreateExpenseDto } from './dtos/createExp.dto';
import { UpdateExpDto } from './dtos/updateExp.dto';

@Controller('expenses')
@ApiTags('Expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring charge template' })
  @ApiResponse({
    status: 201,
    description: 'Expense successfully created',
    type: ExpenseEntity,
  })
  async create(@Body() createExpenseDto: CreateExpenseDto) {
    return this.expensesService.create(createExpenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all expense templates' })
  @ApiResponse({
    status: 200,
    description: 'Expenses list',
    type: [ExpenseEntity],
  })
  async findAll() {
    return this.expensesService.findAll();
  }

  @Get('month')
  @ApiOperation({ summary: 'Month overview: recurring charges, one-off charges, quick expenses' })
  async month(@Query('year') year?: string, @Query('month') month?: string) {
    const now = new Date();
    return this.expensesService.monthOverview(
      Number(year) || now.getFullYear(),
      Number(month) || now.getMonth() + 1,
    );
  }

  @Post('daily')
  @ApiOperation({ summary: 'Record a spent amount (quick expense or paid charge)' })
  async createDailyExpense(@Body() body: QuickExpenseInput) {
    return this.expensesService.createDailyExpense(body);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Spent amounts between two days (yyyy-MM-dd)' })
  async listDaily(@Query('from') from?: string, @Query('to') to?: string) {
    return this.expensesService.listDaily(from, to);
  }

  @Get('daily/suggestions')
  @ApiOperation({ summary: 'Recent quick-expense descriptions' })
  async suggestions() {
    return this.expensesService.suggestions();
  }

  @Get('daily/all')
  @ApiOperation({ summary: 'Get all daily expenses' })
  async findAllDailyExpenses() {
    return this.expensesService.findAllDailyExpenses();
  }

  @Patch('daily/:id')
  @ApiOperation({ summary: 'Update daily expense' })
  @ApiParam({ name: 'id', description: 'Daily expense ID' })
  async updateDailyExpense(
    @Param('id') id: string,
    @Body() body: QuickExpenseInput,
  ) {
    return this.expensesService.updateDailyExpense(id, body);
  }

  @Delete('daily/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete daily expense' })
  @ApiParam({ name: 'id', description: 'Daily expense ID' })
  async removeDailyExpense(@Param('id') id: string) {
    return this.expensesService.removeDailyExpense(id);
  }

  @Get('daily/:id')
  @ApiOperation({ summary: 'Get daily expense by ID' })
  @ApiParam({ name: 'id', description: 'Daily expense ID' })
  async findOneDailyExpense(@Param('id') id: string) {
    return this.expensesService.findOneDailyExpense(id);
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
}
