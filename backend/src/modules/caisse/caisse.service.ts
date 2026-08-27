import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { endOfDay, startOfDay } from 'date-fns';
import { OpsEventsService } from '../ops-events/ops-events.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CaisseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opsEvents: OpsEventsService,
    private readonly config: ConfigService,
  ) {}

  private dayKey(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return startOfDay(d);
  }

  async getOrNull(date: string) {
    const day = this.dayKey(date);
    return this.prisma.caisseSession.findUnique({
      where: { date: day },
      include: { movements: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async open(date: string, openingFloat = 0) {
    const day = this.dayKey(date);
    const existing = await this.prisma.caisseSession.findUnique({
      where: { date: day },
    });
    if (existing && !existing.closedAt) return existing;
    if (existing?.closedAt) {
      throw new BadRequestException('Caisse déjà clôturée pour ce jour');
    }
    const session = await this.prisma.caisseSession.create({
      data: { date: day, openingFloat },
      include: { movements: true },
    });
    await this.opsEvents.record({
      type: 'caisse.opened',
      amount: openingFloat,
      meta: { sessionId: session.id, date: day.toISOString() },
    });
    return session;
  }

  async addMovement(
    sessionId: string,
    data: { type: 'IN' | 'OUT'; amount: number; label?: string },
  ) {
    const session = await this.prisma.caisseSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (session.closedAt) {
      throw new BadRequestException('Caisse clôturée');
    }
    return this.prisma.caisseMovement.create({
      data: {
        sessionId,
        type: data.type,
        amount: data.amount,
        label: data.label,
      },
    });
  }

  async daySummary(date: string) {
    const day = this.dayKey(date);
    const start = startOfDay(day);
    const end = endOfDay(day);

    const [
      journals,
      abonnements,
      dailyProducts,
      dailyExpenses,
      session,
      seats,
      bookings,
    ] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: start, lte: end } },
        include: { prices: true },
      }),
      this.prisma.abonnement.findMany({
        where: { registredDate: { gte: start, lte: end } },
      }),
      this.prisma.dailyProduct.findMany({
        where: { date: { gte: start, lte: end } },
        include: { product: true },
      }),
      this.prisma.dailyExpense.findMany({
        where: { date: { gte: start, lte: end } },
        include: { expense: true },
      }),
      this.getOrNull(date),
      this.prisma.seat.findMany({ where: { isActive: true } }),
      this.prisma.seatBooking.findMany({
        where: { isBooked: true, eventKey: 'collabora-hub' },
      }),
    ]);

    const revenueJournal = journals
      .filter((j) => j.isPayed)
      .reduce((a, j) => a + (j.payedAmount || 0), 0);
    const revenueAbonnements = abonnements
      .filter((a) => a.isPayed)
      .reduce((a, x) => a + (x.payedAmount || 0), 0);
    const revenueProducts = dailyProducts
      .filter((dp) => dp.status !== 'PENDING' && dp.status !== 'CANCELLED')
      .reduce((a, dp) => a + (dp.product?.sellingPrice || 0) * dp.quantite, 0);
    const expenses = dailyExpenses.reduce(
      (a, de) => a + (de.expense?.amount || 0),
      0,
    );
    const movementsIn =
      session?.movements
        ?.filter((m) => m.type === 'IN')
        .reduce((a, m) => a + m.amount, 0) || 0;
    const movementsOut =
      session?.movements
        ?.filter((m) => m.type === 'OUT')
        .reduce((a, m) => a + m.amount, 0) || 0;

    const openingFloat = session?.openingFloat || 0;
    const expectedClose =
      openingFloat +
      revenueJournal +
      revenueAbonnements +
      revenueProducts +
      movementsIn -
      expenses -
      movementsOut;

    const normalSeats = seats.filter((s) => !s.isOverflow);
    const overflowSeats = seats.filter((s) => s.isOverflow);
    const bookedLabels = new Set(bookings.map((b) => b.seatId));
    const normalOccupied = normalSeats.filter((s) =>
      bookedLabels.has(s.label),
    ).length;
    const overflowOccupied = overflowSeats.filter((s) =>
      bookedLabels.has(s.label),
    ).length;

    return {
      date: day.toISOString(),
      session,
      revenueJournal,
      revenueAbonnements,
      revenueProducts,
      expenses,
      movementsIn,
      movementsOut,
      openingFloat,
      expectedClose,
      net: revenueJournal + revenueAbonnements + revenueProducts - expenses,
      unpaidJournal: journals.filter((j) => !j.isPayed).length,
      occupancy: {
        normalCapacity: normalSeats.length,
        normalOccupied,
        overflowCapacity: overflowSeats.length,
        overflowOccupied,
        isFull: normalSeats.length > 0 && normalOccupied >= normalSeats.length,
      },
      dailyProducts,
      dailyExpenses,
      journalsCount: journals.length,
    };
  }

  async close(date: string, data: { countedClose: number; notes?: string }) {
    const day = this.dayKey(date);
    let session = await this.prisma.caisseSession.findUnique({
      where: { date: day },
    });
    if (!session) {
      session = await this.prisma.caisseSession.create({
        data: { date: day, openingFloat: 0 },
      });
    }
    if (session.closedAt) {
      throw new BadRequestException('Déjà clôturée');
    }

    const summary = await this.daySummary(date);
    const expectedClose = summary.expectedClose;
    const difference = data.countedClose - expectedClose;

    if (Math.abs(difference) > 0.05) {
      throw new BadRequestException(
        `Écart caisse : attendu ${expectedClose.toFixed(
          2,
        )} DT, compté ${data.countedClose.toFixed(
          2,
        )} DT. Corrigez avant de clôturer.`,
      );
    }

    const closed = await this.prisma.caisseSession.update({
      where: { id: session.id },
      data: {
        closedAt: new Date(),
        countedClose: data.countedClose,
        expectedClose,
        difference,
        notes: data.notes,
      },
      include: { movements: true },
    });

    await this.prisma.coffreEntry.create({
      data: {
        date: day,
        type: 'IN',
        amount: data.countedClose,
        label: `Clôture caisse ${day.toISOString().slice(0, 10)}`,
        caisseSessionId: closed.id,
      },
    });

    await this.opsEvents.record({
      type: 'caisse.closed',
      amount: data.countedClose,
      meta: {
        sessionId: closed.id,
        expectedClose,
        difference,
        occupancy: summary.occupancy,
      },
    });

    const syncResult = await this.tryErpSync({
      date: day.toISOString().slice(0, 10),
      revenueJournal: summary.revenueJournal,
      revenueAbonnements: summary.revenueAbonnements,
      revenueProducts: summary.revenueProducts,
      expenses: summary.expenses,
      countedCash: data.countedClose,
      expectedCash: expectedClose,
      difference,
      occupancy: summary.occupancy,
      overflowUsed: summary.occupancy.overflowOccupied,
      sessionId: closed.id,
    });

    if (syncResult?.externalRef) {
      return this.prisma.caisseSession.update({
        where: { id: closed.id },
        data: {
          externalOrgId: syncResult.externalOrgId,
          externalRef: syncResult.externalRef,
          syncedAt: new Date(),
        },
        include: { movements: true },
      });
    }

    return closed;
  }

  buildErpPayload(body: Record<string, unknown>) {
    return {
      source: 'collabora-hub',
      channel: 'coworking',
      ...body,
    };
  }

  async tryErpSync(body: Record<string, unknown>) {
    const enabled = this.config.get<string>('ERP_SYNC_ENABLED') === 'true';
    const apiUrl = this.config.get<string>('ERP_API_URL');
    const orgId = this.config.get<string>('ERP_ORG_ID');
    if (!enabled || !apiUrl || !orgId) return null;

    const payload = this.buildErpPayload({ ...body, organizationId: orgId });
    try {
      const res = await fetch(
        `${apiUrl.replace(/\/$/, '')}/coworking/${orgId}/day-close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `ERP sync failed ${res.status}`);
      }
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        externalRef?: string;
      };
      return {
        externalOrgId: orgId,
        externalRef: json.externalRef || json.id || `synced-${Date.now()}`,
      };
    } catch (e) {
      // Soft-fail: clôture succeeds even if ERP is down
      console.error('ERP sync error', e);
      return null;
    }
  }

  async coffreList() {
    const entries = await this.prisma.coffreEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const balance = entries.reduce(
      (a, e) => a + (e.type === 'OUT' ? -e.amount : e.amount),
      0,
    );
    return { balance, entries };
  }

  async coffreAdd(data: {
    type: 'IN' | 'OUT';
    amount: number;
    label?: string;
    date?: string;
  }) {
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestException('Montant invalide');
    }
    const date = this.dayKey(data.date || new Date().toISOString());
    const entry = await this.prisma.coffreEntry.create({
      data: {
        date,
        type: data.type,
        amount: data.amount,
        label: data.label,
      },
    });
    await this.opsEvents.record({
      type: data.type === 'IN' ? 'coffre.in' : 'coffre.out',
      amount: data.amount,
      meta: { entryId: entry.id },
    });
    return this.coffreList();
  }

  async monthSummary(year: number, month: number) {
    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException('Mois invalide');
    }
    const start = new Date(year, month - 1, 1);
    const end = endOfDay(new Date(year, month, 0));

    const [
      journals,
      abonnements,
      dailyProducts,
      dailyExpenses,
      sessions,
      coffre,
    ] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: start, lte: end } },
      }),
      this.prisma.abonnement.findMany({
        where: { registredDate: { gte: start, lte: end } },
      }),
      this.prisma.dailyProduct.findMany({
        where: { date: { gte: start, lte: end } },
        include: { product: true },
      }),
      this.prisma.dailyExpense.findMany({
        where: { date: { gte: start, lte: end } },
        include: { expense: true },
      }),
      this.prisma.caisseSession.findMany({
        where: { date: { gte: start, lte: end } },
        include: { movements: true },
      }),
      this.prisma.coffreEntry.findMany({
        where: { date: { gte: start, lte: end } },
      }),
    ]);

    const revenueJournal = journals
      .filter((j) => j.isPayed)
      .reduce((a, j) => a + (j.payedAmount || 0), 0);
    const revenueAbonnements = abonnements
      .filter((a) => a.isPayed)
      .reduce((a, x) => a + (x.payedAmount || 0), 0);
    const revenueProducts = dailyProducts
      .filter((dp) => dp.status !== 'PENDING' && dp.status !== 'CANCELLED')
      .reduce((a, dp) => a + (dp.product?.sellingPrice || 0) * dp.quantite, 0);
    const expensesDaily = dailyExpenses
      .filter((de) => de.expense?.type === 'JOURNALIER')
      .reduce((a, de) => a + (de.expense?.amount || 0), 0);
    const expensesMonthly = dailyExpenses
      .filter((de) => de.expense?.type === 'MENSUEL')
      .reduce((a, de) => a + (de.expense?.amount || 0), 0);
    const expenses = expensesDaily + expensesMonthly;
    const coffreIn = coffre
      .filter((c) => c.type === 'IN')
      .reduce((a, c) => a + c.amount, 0);
    const coffreOut = coffre
      .filter((c) => c.type === 'OUT')
      .reduce((a, c) => a + c.amount, 0);

    const daysOpen = sessions.filter((s) => !s.closedAt).length;
    const daysClosed = sessions.filter((s) => s.closedAt).length;
    const countedTotal = sessions.reduce(
      (a, s) => a + (s.countedClose || 0),
      0,
    );
    const expectedTotal = sessions.reduce(
      (a, s) => a + (s.expectedClose || 0),
      0,
    );

    return {
      year,
      month,
      revenueJournal,
      revenueAbonnements,
      revenueProducts,
      expensesDaily,
      expensesMonthly,
      expenses,
      net: revenueJournal + revenueAbonnements + revenueProducts - expenses,
      coffreIn,
      coffreOut,
      coffreNet: coffreIn - coffreOut,
      daysOpen,
      daysClosed,
      countedTotal,
      expectedTotal,
      sessions: sessions.map((s) => ({
        date: s.date,
        closedAt: s.closedAt,
        openingFloat: s.openingFloat,
        countedClose: s.countedClose,
        expectedClose: s.expectedClose,
        difference: s.difference,
      })),
    };
  }
}
