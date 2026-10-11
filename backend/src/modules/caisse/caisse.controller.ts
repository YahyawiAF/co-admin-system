import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CaisseService } from './caisse.service';

type MovementBody = {
  type: 'IN' | 'OUT';
  amount: number;
  label?: string;
  /** Transfer with the coffre (OUT = drawer → coffre, IN = coffre → drawer) */
  coffre?: boolean;
};

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

  @Delete('coffre/:id')
  removeCoffre(@Param('id') id: string) {
    return this.caisse.coffreRemove(id);
  }

  @Post('open')
  open(@Body() body: { date?: string; openingFloat?: number }) {
    return this.caisse.open(
      body.date || new Date().toISOString(),
      body.openingFloat ?? 0,
    );
  }

  @Post('opening-float')
  openingFloat(@Body() body: { date?: string; openingFloat: number }) {
    return this.caisse.setOpeningFloat(
      body.date || new Date().toISOString(),
      Number(body.openingFloat),
    );
  }

  @Post('close')
  close(
    @Body()
    body: {
      date?: string;
      countedClose: number;
      keptFloat?: number;
      notes?: string;
    },
  ) {
    return this.caisse.close(body.date || new Date().toISOString(), {
      countedClose: body.countedClose,
      keptFloat: body.keptFloat,
      notes: body.notes,
    });
  }

  @Post('reopen')
  reopen(@Body() body: { date: string }) {
    return this.caisse.reopen(body.date);
  }

  @Post('movements')
  addMovementForDate(@Body() body: MovementBody & { date?: string }) {
    return this.caisse.addMovementForDate(
      body.date || new Date().toISOString(),
      body,
    );
  }

  @Delete('movements/:id')
  removeMovement(@Param('id') id: string) {
    return this.caisse.removeMovement(id);
  }

  @Post(':sessionId/movements')
  addMovement(@Param('sessionId') sessionId: string, @Body() body: MovementBody) {
    return this.caisse.addMovement(sessionId, body);
  }

  @Get('erp-payload-preview')
  async erpPreview(@Query('date') date: string) {
    const summary = await this.caisse.daySummary(
      date || new Date().toISOString(),
    );
    return this.caisse.buildErpPayload({
      date: summary.dateKey,
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
