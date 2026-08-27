import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CaisseService } from './caisse.service';

@Controller('caisse')
export class CaisseController {
  constructor(private readonly caisse: CaisseService) {}

  @Get('summary')
  summary(@Query('date') date: string) {
    return this.caisse.daySummary(date || new Date().toISOString());
  }

  @Get('session')
  session(@Query('date') date: string) {
    return this.caisse.getOrNull(date || new Date().toISOString());
  }

  @Get('month')
  month(@Query('year') year: string, @Query('month') month: string) {
    const now = new Date();
    return this.caisse.monthSummary(
      Number(year) || now.getFullYear(),
      Number(month) || now.getMonth() + 1,
    );
  }

  @Get('coffre')
  coffre() {
    return this.caisse.coffreList();
  }

  @Post('coffre')
  addCoffre(
    @Body()
    body: {
      type: 'IN' | 'OUT';
      amount: number;
      label?: string;
      date?: string;
    },
  ) {
    return this.caisse.coffreAdd(body);
  }

  @Post('open')
  open(@Body() body: { date?: string; openingFloat?: number }) {
    return this.caisse.open(
      body.date || new Date().toISOString(),
      body.openingFloat ?? 0,
    );
  }

  @Post('close')
  close(@Body() body: { date?: string; countedClose: number; notes?: string }) {
    return this.caisse.close(body.date || new Date().toISOString(), {
      countedClose: body.countedClose,
      notes: body.notes,
    });
  }

  @Post(':sessionId/movements')
  addMovement(
    @Param('sessionId') sessionId: string,
    @Body() body: { type: 'IN' | 'OUT'; amount: number; label?: string },
  ) {
    return this.caisse.addMovement(sessionId, body);
  }

  @Get('erp-payload-preview')
  async erpPreview(@Query('date') date: string) {
    const summary = await this.caisse.daySummary(
      date || new Date().toISOString(),
    );
    return this.caisse.buildErpPayload({
      date: (date || new Date().toISOString()).slice(0, 10),
      revenueJournal: summary.revenueJournal,
      revenueAbonnements: summary.revenueAbonnements,
      revenueProducts: summary.revenueProducts,
      expenses: summary.expenses,
      countedCash: summary.session?.countedClose ?? null,
      expectedCash: summary.expectedClose,
      difference: summary.session?.difference ?? null,
      occupancy: summary.occupancy,
      overflowUsed: summary.occupancy.overflowOccupied,
    });
  }
}
