import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { orderUnitPrice } from '../product/order-price';
import { PrismaService } from 'database/prisma.service';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { OpsEventsService } from '../ops-events/ops-events.service';
import { ConfigService } from '@nestjs/config';
import {
  dbDay,
  fromDbDay,
  isLocalToday,
  localDayKey,
  parseLocalDay,
} from '../../../common/parse-local-day';
import { abonnementPaymentsInRange } from '../abonnement/abonnement-revenue';
import { expenseAmount, expenseLabel } from '../expense/expense-amount';

/** Gap (DT) above which closing needs an explanation. */
const GAP_NEEDS_NOTE = 0.5;

const round2 = (n: number) => Math.round(n * 100) / 100;

const sessionInclude = {
  movements: {
    orderBy: { createdAt: 'asc' as const },
    include: { coffreEntry: { select: { id: true } } },
  },
};

@Injectable()
export class CaisseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opsEvents: OpsEventsService,
    private readonly config: ConfigService,
  ) {}

  /** Cash left in the drawer by the last closed day before `day`. */
  private async carriedFloat(day: Date) {
    const prev = await this.prisma.caisseSession.findFirst({
      where: { date: { lt: dbDay(day) }, closedAt: { not: null } },
      orderBy: { date: 'desc' },
      select: { keptFloat: true },
    });
    return prev?.keptFloat ?? 0;
  }

  /** Auto-open today's caisse with yesterday's kept cash. Close stays manual. */
  async ensureOpenToday(date: string) {
    if (!isLocalToday(date)) return this.getOrNull(date);
    const existing = await this.getOrNull(date);
    if (existing) return existing;
    return this.open(date, await this.carriedFloat(parseLocalDay(date)));
  }

  async getOrNull(date: string) {
    return this.prisma.caisseSession.findUnique({
      where: { date: dbDay(date) },
      include: sessionInclude,
    });
  }

  async open(date: string, openingFloat = 0) {
    const day = dbDay(date);
    const existing = await this.prisma.caisseSession.findUnique({
      where: { date: day },
      include: sessionInclude,
    });
    if (existing && !existing.closedAt) return existing;
    if (existing?.closedAt) {
      throw new BadRequestException('Caisse déjà clôturée pour ce jour');
    }
    const session = await this.prisma.caisseSession.create({
      data: { date: day, openingFloat },
      include: sessionInclude,
    });
    await this.opsEvents.record({
      type: 'caisse.opened',
      amount: openingFloat,
      meta: { sessionId: session.id, date: localDayKey(fromDbDay(day)) },
    });
    return session;
  }

  async setOpeningFloat(date: string, openingFloat: number) {
    if (!(openingFloat >= 0)) throw new BadRequestException('Montant invalide');
    const session = await this.open(date, openingFloat);
    if (session.closedAt) throw new BadRequestException('Caisse clôturée');
    await this.prisma.caisseSession.update({
      where: { id: session.id },
      data: { openingFloat },
    });
    return this.daySummary(date);
  }

  async addMovement(
    sessionId: string,
    data: { type: 'IN' | 'OUT'; amount: number; label?: string; coffre?: boolean },
  ) {
    const session = await this.prisma.caisseSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (session.closedAt) {
      throw new BadRequestException('Caisse clôturée');
    }
    const amount = round2(Number(data.amount));
    if (!(amount > 0)) throw new BadRequestException('Montant invalide');
    const type = data.type === 'IN' ? 'IN' : 'OUT';
    const label =
      data.label?.trim() ||
      (data.coffre
        ? type === 'OUT'
          ? 'Versement au coffre'
          : 'Monnaie prise du coffre'
        : type === 'OUT'
          ? 'Sortie de caisse'
          : 'Entrée de caisse');
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.caisseMovement.create({
        data: { sessionId, type, amount, label },
      });
      if (data.coffre) {
        await tx.coffreEntry.create({
          data: {
            date: session.date,
            type: type === 'OUT' ? 'IN' : 'OUT',
            amount,
            label: type === 'OUT' ? `Depuis la caisse · ${label}` : `Vers la caisse · ${label}`,
            caisseMovementId: m.id,
          },
        });
      }
      return m;
    });
  }

  async addMovementForDate(
    date: string,
    data: { type: 'IN' | 'OUT'; amount: number; label?: string; coffre?: boolean },
  ) {
    const session = await this.open(date, await this.carriedFloat(parseLocalDay(date)));
    await this.addMovement(session.id, data);
    return this.daySummary(date);
  }

  async removeMovement(id: string) {
    const m = await this.prisma.caisseMovement.findUnique({
      where: { id },
      include: { session: true },
    });
    if (!m) throw new NotFoundException('Mouvement introuvable');
    if (m.session.closedAt) throw new BadRequestException('Caisse clôturée');
    await this.prisma.caisseMovement.delete({ where: { id } });
    return { ok: true };
  }

  async daySummary(date: string) {
    await this.ensureOpenToday(date);
    const day = parseLocalDay(date);
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
      unclosed,
    ] = await Promise.all([
      this.prisma.journal.findMany({
        where: { registredTime: { gte: start, lte: end } },
        include: { prices: true },
      }),
      this.prisma.abonnementPayment.findMany({
        where: abonnementPaymentsInRange(start, end),
        select: { amount: true },
      }),
      this.prisma.dailyProduct.findMany({
        where: { date: { gte: start, lte: end } },
        include: { product: true },
      }),
      this.prisma.dailyExpense.findMany({
        where: { date: { gte: start, lte: end } },
        include: { expense: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.getOrNull(date),
      this.prisma.seat.findMany({ where: { isActive: true } }),
      this.prisma.seatBooking.findMany({
        where: { isBooked: true, eventKey: 'collabora-hub' },
      }),
      this.prisma.caisseSession.findMany({
        where: { closedAt: null, date: { lt: dbDay(day) } },
        orderBy: { date: 'desc' },
        take: 10,
        select: { date: true },
      }),
    ]);

    const paidJournals = journals.filter((j) => j.isPayed);
    const revenueJournal = paidJournals.reduce((a, j) => a + (j.payedAmount || 0), 0);
    const revenueAbonnements = abonnements.reduce((a, p) => a + p.amount, 0);
    const soldProducts = dailyProducts.filter(
      (dp) => dp.status !== 'PENDING' && dp.status !== 'CANCELLED',
    );
    const revenueProducts = soldProducts.reduce(
      (a, dp) => a + orderUnitPrice(dp) * dp.quantite,
      0,
    );
    const expenseRows = dailyExpenses.map((de) => ({
      ...de,
      amount: expenseAmount(de),
      label: expenseLabel(de),
    }));
    const expenses = expenseRows.reduce((a, de) => a + de.amount, 0);
    const expensesCash = expenseRows
      .filter((de) => de.source === 'CAISSE')
      .reduce((a, de) => a + de.amount, 0);
    const movements = session?.movements ?? [];
    const movementsIn = movements
      .filter((m) => m.type === 'IN')
      .reduce((a, m) => a + m.amount, 0);
    const movementsOut = movements
      .filter((m) => m.type === 'OUT')
      .reduce((a, m) => a + m.amount, 0);

    const openingFloat = session?.openingFloat || 0;
    const revenue = revenueJournal + revenueAbonnements + revenueProducts;
    const expectedClose = round2(
      openingFloat + revenue + movementsIn - expensesCash - movementsOut,
    );
    const closedExpected =
      session?.closedAt && session.expectedClose != null
        ? session.expectedClose
        : null;
    const driftSinceClose =
      closedExpected != null ? round2(expectedClose - closedExpected) : null;

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
      dateKey: localDayKey(day),
      session,
      revenue: round2(revenue),
      revenueJournal,
      revenueAbonnements,
      revenueProducts,
      counts: {
        paidVisits: paidJournals.length,
        abonnementPayments: abonnements.length,
        products: soldProducts.reduce((a, dp) => a + dp.quantite, 0),
      },
      expenses: round2(expenses),
      expensesCash: round2(expensesCash),
      expensesOther: round2(expenses - expensesCash),
      movementsIn,
      movementsOut,
      openingFloat,
      expectedClose,
      closedExpected,
      driftSinceClose,
      suggestedFloat: session ? null : await this.carriedFloat(day),
      unclosedDays: unclosed.map((s) => localDayKey(fromDbDay(s.date))),
      net: round2(revenue - expenses),
      unpaidJournal: journals.filter((j) => !j.isPayed).length,
      occupancy: {
        normalCapacity: normalSeats.length,
        normalOccupied,
        overflowCapacity: overflowSeats.length,
        overflowOccupied,
        isFull: normalSeats.length > 0 && normalOccupied >= normalSeats.length,
      },
      dailyProducts,
      dailyExpenses: expenseRows,
      journalsCount: journals.length,
    };
  }

  async close(
    date: string,
    data: { countedClose: number; keptFloat?: number; notes?: string },
  ) {
    const day = dbDay(date);
    const counted = round2(Number(data.countedClose));
    if (!Number.isFinite(counted) || counted < 0) {
      throw new BadRequestException('Montant compté invalide');
    }
    let session = await this.prisma.caisseSession.findUnique({
      where: { date: day },
    });
    if (!session) {
      session = await this.prisma.caisseSession.create({
        data: { date: day, openingFloat: await this.carriedFloat(parseLocalDay(date)) },
      });
    }
    if (session.closedAt) {
      throw new BadRequestException('Déjà clôturée');
    }

    const summary = await this.daySummary(date);
    const expectedClose = summary.expectedClose;
    const difference = round2(counted - expectedClose);
    const notes = data.notes?.trim() || null;
    if (Math.abs(difference) >= GAP_NEEDS_NOTE && !notes) {
      throw new BadRequestException(
        `Écart de ${difference > 0 ? '+' : ''}${difference.toFixed(2)} DT : expliquez-le dans la note pour clôturer.`,
      );
    }
    const kept = Math.min(counted, Math.max(0, round2(Number(data.keptFloat ?? 0))));
    const toCoffre = round2(counted - kept);

    const closed = await this.prisma.$transaction(async (tx) => {
      const s = await tx.caisseSession.update({
        where: { id: session!.id },
        data: {
          closedAt: new Date(),
          countedClose: counted,
          expectedClose,
          difference,
          keptFloat: kept,
          notes,
        },
        include: sessionInclude,
      });
      if (toCoffre > 0) {
        await tx.coffreEntry.create({
          data: {
            date: day,
            type: 'IN',
            amount: toCoffre,
            label: `Clôture caisse ${localDayKey(fromDbDay(day))}`,
            caisseSessionId: s.id,
          },
        });
      }
      // Next day already auto-opened: start it with the cash left in the drawer
      await tx.caisseSession.updateMany({
        where: { date: dbDay(addDays(fromDbDay(day), 1)), closedAt: null },
        data: { openingFloat: kept },
      });
      return s;
    });

    await this.opsEvents.record({
      type: 'caisse.closed',
      amount: counted,
      meta: {
        sessionId: closed.id,
        expectedClose,
        difference,
        keptFloat: kept,
        occupancy: summary.occupancy,
      },
    });

    const syncResult = await this.tryErpSync({
      date: localDayKey(fromDbDay(day)),
      revenueJournal: summary.revenueJournal,
      revenueAbonnements: summary.revenueAbonnements,
      revenueProducts: summary.revenueProducts,
      expenses: summary.expenses,
      countedCash: counted,
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
        include: sessionInclude,
      });
    }

    return closed;
  }

  /** Undo a closing: removes its coffre deposit so the day can be corrected. */
  async reopen(date: string) {
    const session = await this.prisma.caisseSession.findUnique({
      where: { date: dbDay(date) },
    });
    if (!session?.closedAt) throw new BadRequestException("Cette caisse n'est pas clôturée");
    await this.prisma.$transaction([
      this.prisma.coffreEntry.deleteMany({ where: { caisseSessionId: session.id } }),
      this.prisma.caisseSession.update({
        where: { id: session.id },
        data: {
          closedAt: null,
          countedClose: null,
          expectedClose: null,
          difference: null,
          keptFloat: null,
        },
      }),
    ]);
    await this.opsEvents.record({
      type: 'caisse.reopened',
      meta: { sessionId: session.id },
    });
    return this.daySummary(date);
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
    const [totals, entries] = await Promise.all([
      this.prisma.coffreEntry.groupBy({ by: ['type'], _sum: { amount: true } }),
      this.prisma.coffreEntry.findMany({
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 300,
      }),
    ]);
    const sum = (t: string) => totals.find((x) => x.type === t)?._sum.amount ?? 0;
    return {
      balance: round2(sum('IN') - sum('OUT')),
      entries: entries.map((e) => ({
        ...e,
        dateKey: localDayKey(fromDbDay(e.date)),
        kind: e.caisseSessionId
          ? ('CLOTURE' as const)
          : e.dailyExpenseId
            ? ('DEPENSE' as const)
            : e.caisseMovementId
              ? ('CAISSE' as const)
              : ('MANUEL' as const),
      })),
    };
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
    const entry = await this.prisma.coffreEntry.create({
      data: {
        date: dbDay(data.date || null),
        type: data.type === 'OUT' ? 'OUT' : 'IN',
        amount: round2(data.amount),
        label: data.label?.trim() || null,
      },
    });
    await this.opsEvents.record({
      type: data.type === 'IN' ? 'coffre.in' : 'coffre.out',
      amount: data.amount,
      meta: { entryId: entry.id },
    });
    return this.coffreList();
  }

  /** Only manual lines; closings, expenses and drawer transfers are undone at their source. */
  async coffreRemove(id: string) {
    const e = await this.prisma.coffreEntry.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Mouvement introuvable');
    if (e.caisseSessionId || e.dailyExpenseId || e.caisseMovementId) {
      throw new BadRequestException(
        'Ce mouvement vient de la caisse ou d’une dépense : corrigez-le à sa source.',
      );
    }
    await this.prisma.coffreEntry.delete({ where: { id } });
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
      this.prisma.abonnementPayment.findMany({
        where: abonnementPaymentsInRange(start, end),
        select: { amount: true },
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
        where: { date: { gte: dbDay(start), lte: dbDay(end) } },
        include: { movements: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.coffreEntry.findMany({
        where: { date: { gte: dbDay(start), lte: dbDay(end) } },
      }),
    ]);

    const revenueJournal = journals
      .filter((j) => j.isPayed)
      .reduce((a, j) => a + (j.payedAmount || 0), 0);
    const revenueAbonnements = abonnements.reduce((a, p) => a + p.amount, 0);
    const revenueProducts = dailyProducts
      .filter((dp) => dp.status !== 'PENDING' && dp.status !== 'CANCELLED')
      .reduce((a, dp) => a + orderUnitPrice(dp) * dp.quantite, 0);
    const expensesDaily = dailyExpenses
      .filter((de) => de.kind === 'JOURNALIER')
      .reduce((a, de) => a + expenseAmount(de), 0);
    const expensesMonthly = dailyExpenses
      .filter((de) => de.kind === 'MENSUEL')
      .reduce((a, de) => a + expenseAmount(de), 0);
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
        dateKey: localDayKey(fromDbDay(s.date)),
        closedAt: s.closedAt,
        openingFloat: s.openingFloat,
        countedClose: s.countedClose,
        expectedClose: s.expectedClose,
        difference: s.difference,
        keptFloat: s.keptFloat,
        notes: s.notes,
      })),
    };
  }
}
