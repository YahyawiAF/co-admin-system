import { Controller, Get, Query } from '@nestjs/common';
import { StatisticsService } from './StatisticsService';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('historical')
  async getHistoricalStats(@Query('months') months: string = '12') {
    const monthsNumber = Math.min(Math.max(parseInt(months, 10) || 12, 1), 24);
    return this.statisticsService.getHistoricalStats(monthsNumber);
  }

  @Get('revenue')
  async getMonthlyRevenue(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (isNaN(monthNum)) throw new Error('Month must be a number');
    if (isNaN(yearNum)) throw new Error('Year must be a number');
    if (monthNum < 1 || monthNum > 12) throw new Error('Month must be between 1 and 12');

    return this.statisticsService.getMonthlyRevenue(monthNum, yearNum);
  }

  @Get('expenses')
  async getMonthlyExpenses(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (isNaN(monthNum)) throw new Error('Month must be a number');
    if (isNaN(yearNum)) throw new Error('Year must be a number');
    if (monthNum < 1 || monthNum > 12) throw new Error('Month must be between 1 and 12');

    return this.statisticsService.getMonthlyExpensesDetailed(monthNum, yearNum);
  }

  @Get('registrations')
  async getMonthlyRegistrations(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (isNaN(monthNum) || isNaN(yearNum)) {
      throw new Error('Month and year must be numbers');
    }

    return this.statisticsService.getMonthlyRegistrations(monthNum, yearNum);
  }

  @Get('memberships')
  async getMembershipByCategory(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (isNaN(monthNum) || isNaN(yearNum)) {
      throw new Error('Month and year must be numbers');
    }

    return this.statisticsService.getMembershipByCategory(monthNum, yearNum);
  }

  @Get('users-count')
  async getUsersCount() {
    return { count: await this.statisticsService.getUsersCount() };
  }

  @Get('most-present')
  async getMostPresentUsers(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('limit') limit: string,
  ) {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    const limitNum = parseInt(limit, 10) || 10;
    
    if (isNaN(monthNum) || isNaN(yearNum)) {
      throw new Error('Month and year must be numbers');
    }

    return this.statisticsService.getMostPresentUsers(monthNum, yearNum, limitNum);
  }

  @Get('users-evolution')
async getUsersEvolution(
  @Query('months') months: string = '12'
) {
  const monthsNumber = Math.min(Math.max(parseInt(months, 10) || 12, 1), 24);
  return this.statisticsService.getUsersEvolution(monthsNumber);
}
}