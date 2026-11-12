import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { endOfDay } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { dbDay, fromDbDay, localDayKey, parseLocalDay } from '../../../common/parse-local-day';
import { abonnementPaymentsInRange } from '../abonnement/abonnement-revenue';
import { normalizeCategory } from '../expense/expense-amount';
import { orderUnitPrice } from '../product/order-price';
import { CaisseService } from './caisse.service';

const round2 = (n: number) => Math.round(n * 100) / 100;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const GAP_KINDS = ['DEPENSE', 'BANQUE', 'RETRAIT', 'PERTE'] as const;
export type GapKind = (typeof GAP_KINDS)[number];
/** Coffre lines added by « Corriger le coffre »: the count, not a known movement */
const isCorrection = (label: string | null) => /^correction/i.test(label ?? '');

export type GapLineInput = {
  month: string;
  kind: GapKind;
  amount: number;
  date: string;
  note?: string;
  category?: string;
  fromSafe?: boolean;
  caisseSessionId?: string;
};

/**
 * Finance › Argent « contrôle du mois »: revenu brut − argent gardé = argent sorti;
 * what part of it has a record (expenses, noted movements, explained lines), and the rest = non déclaré.
 */
@Injectable()
export class MoneyCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caisse: CaisseService,
  ) {}

  /** The current month and the `count − 1` before it, newest first. */
  async months(count = 6) {
    const now = new Date();
    const keys = Array.from({ length: Math.min(12, Math.max(1, count)) }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const months = [];
    for (const k of keys) months.push(await this.month(k));
    return { months };
  }

  async month(key: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m) throw new BadRequestException('Mois invalide');
    const year = Number(m[1]);
    const month = Number(m[2]);
    const now = new Date();
    const start = new Date(year, month - 1, 1);
    const monthEnd = endOfDay(new Date(year, month, 0));
    const running = now <= monthEnd;
    const end = running ? endOfDay(now) : monthEnd;
    if (start > now) throw new BadRequestException('Mois à venir');

    const [journals, abonnements, products, expenses, coffreBefore, coffreIn, sessions, lastBefore, lines] = await Promise.all([
      this.prisma.journal.findMany({ where: { registredTime: { gte: start, lte: end }, isPayed: true }, select: { payedAmount: true } }),
      this.prisma.abonnementPayment.findMany({ where: abonnementPaymentsInRange(start, end), select: { amount: true } }),
      this.prisma.dailyProduct.findMany({ where: { date: { gte: start, lte: end } }, include: { product: true } }),
      this.prisma.dailyExpense.findMany({
        where: { date: { gte: start, lte: end }, source: { in: ['CAISSE', 'COFFRE'] } },
        include: { expense: true },
      }),
      this.prisma.coffreEntry.groupBy({ by: ['type'], where: { date: { lt: dbDay(start) } }, _sum: { amount: true } }),
      this.prisma.coffreEntry.findMany({ where: { date: { gte: dbDay(start), lte: dbDay(end) } } }),
      this.prisma.caisseSession.findMany({
        where: { date: { gte: dbDay(start), lte: dbDay(end) } },
        include: { movements: { include: { coffreEntry: { select: { id: true } } } } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.caisseSession.findFirst({
        where: { date: { lt: dbDay(start) }, closedAt: { not: null } },
        orderBy: { date: 'desc' },
        select: { keptFloat: true },
      }),
      this.prisma.moneyGapLine.findMany({ where: { month: key }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    ]);

    // Revenu brut: everything cashed this month (passes, abonnements, café)
    const brut = round2(
      journals.reduce((a, j) => a + (j.payedAmount || 0), 0) +
        abonnements.reduce((a, p) => a + p.amount, 0) +
        products
          .filter((dp) => dp.status !== 'PENDING' && dp.status !== 'CANCELLED')
          .reduce((a, dp) => a + orderUnitPrice(dp) * dp.quantite, 0),
    );

    // Argent gardé: coffre + caisse at the end − at the start
    const sum = (rows: { type: string; _sum: { amount: number | null } }[], t: string) => rows.find((x) => x.type === t)?._sum.amount ?? 0;
    const safeStart = sum(coffreBefore, 'IN') - sum(coffreBefore, 'OUT');
    const safeEnd = safeStart + coffreIn.reduce((a, e) => a + (e.type === 'IN' ? e.amount : -e.amount), 0);
    const drawerStart = lastBefore?.keptFloat ?? 0;
    const last = sessions[sessions.length - 1];
    let drawerEnd = drawerStart;
    if (last?.closedAt) drawerEnd = last.keptFloat ?? 0;
    else if (last) drawerEnd = (await this.caisse.daySummary(localDayKey(fromDbDay(last.date)), { open: false })).expectedClose;
    const keptStart = round2(safeStart + drawerStart);
    const keptEnd = round2(safeEnd + drawerEnd);

    // Money that came in from outside (owner, bank) and money that left with a record
    const manual = coffreIn.filter((e) => !e.caisseSessionId && !e.dailyExpenseId && !e.caisseMovementId && !isCorrection(e.label));
    const loose = sessions.flatMap((s) => s.movements.filter((mv) => !mv.coffreEntry));
    const otherIn = round2(
      manual.filter((e) => e.type === 'IN').reduce((a, e) => a + e.amount, 0) +
        loose.filter((mv) => mv.type === 'IN').reduce((a, mv) => a + mv.amount, 0),
    );
    const notedOut = [
      ...manual.filter((e) => e.type === 'OUT').map((e) => ({ label: e.label || 'Sortie du coffre', amount: e.amount, date: localDayKey(fromDbDay(e.date)), from: 'COFFRE' as const })),
      ...loose
        .filter((mv) => mv.type === 'OUT')
        .map((mv) => ({ label: mv.label || 'Sortie de caisse', amount: mv.amount, date: localDayKey(fromDbDay(sessions.find((s) => s.id === mv.sessionId)!.date)), from: 'CAISSE' as const })),
    ];

    const amountOf = (de: (typeof expenses)[number]) => de.amount ?? de.expense?.amount ?? 0;
    const expensesTotal = round2(expenses.reduce((a, de) => a + amountOf(de), 0));
    const expensesLate = round2(expenses.filter((de) => de.afterCount).reduce((a, de) => a + amountOf(de), 0));
    const byKind = (k: GapKind) => round2(lines.filter((l) => l.kind === k).reduce((a, l) => a + l.amount, 0));
    const noted = round2(notedOut.reduce((a, x) => a + x.amount, 0));

    const out = round2(brut + otherIn - (keptEnd - keptStart));
    const explained = round2(expensesTotal + noted + byKind('BANQUE') + byKind('RETRAIT') + byKind('PERTE'));
    const gap = round2(out - explained);

    // Closings of the month with missing cash that no line explains yet
    const linked = new Set(lines.map((l) => l.caisseSessionId).filter(Boolean));
    const closingGaps = sessions
      .filter((s) => s.closedAt && (s.difference ?? 0) <= -0.5 && !linked.has(s.id))
      .map((s) => ({ sessionId: s.id, date: localDayKey(fromDbDay(s.date)), amount: round2(-(s.difference ?? 0)), note: s.notes }));
    const unclosedDays = sessions
      .filter((s) => !s.closedAt && localDayKey(fromDbDay(s.date)) !== localDayKey(now))
      .map((s) => localDayKey(fromDbDay(s.date)));
    const lastCount = [...sessions].reverse().find((s) => s.closedAt);

    return {
      key,
      label: `${MONTHS[month - 1]} ${year}`,
      running,
      /** At least one closing this month: without a count the month cannot be checked */
      checkable: sessions.some((s) => s.closedAt),
      brut,
      otherIn,
      keptStart,
      keptEnd,
      kept: round2(keptEnd - keptStart),
      safeEnd: round2(safeEnd),
      drawerEnd: round2(drawerEnd),
      out,
      expenses: expensesTotal,
      expensesLate,
      expensesCount: expenses.length,
      notedOut,
      noted,
      bank: byKind('BANQUE'),
      withdrawals: byKind('RETRAIT'),
      losses: byKind('PERTE'),
      explained,
      gap,
      explainedPct: out > 0.5 ? Math.max(0, Math.min(100, Math.round((Math.min(explained, out) / out) * 100))) : 100,
      lastCountDate: lastCount ? localDayKey(fromDbDay(lastCount.date)) : null,
      closingGaps,
      unclosedDays,
      lines: lines.map((l) => ({
        id: l.id,
        kind: l.kind as GapKind,
        amount: l.amount,
        date: localDayKey(fromDbDay(l.date)),
        note: l.note,
        fromSafe: l.fromSafe,
        caisseSessionId: l.caisseSessionId,
        dailyExpenseId: l.dailyExpenseId,
      })),
    };
  }

  /** One line explaining money that left: a DEPENSE also becomes an expense « déclarée après coup ». */
  async addLine(body: GapLineInput) {
    const kind = (GAP_KINDS as readonly string[]).includes(body.kind) ? body.kind : null;
    if (!kind) throw new BadRequestException('Type inconnu');
    const amount = round2(Number(body.amount));
    if (!(amount > 0)) throw new BadRequestException('Montant invalide');
    if (!/^\d{4}-\d{2}$/.test(body.month ?? '')) throw new BadRequestException('Mois invalide');
    const dayKey = body.date && body.date.slice(0, 7) === body.month ? body.date : `${body.month}-01`;
    const note = body.note?.trim() || null;
    const fromSafe = !!body.fromSafe;

    await this.prisma.$transaction(async (tx) => {
      let dailyExpenseId: string | null = null;
      if (kind === 'DEPENSE') {
        const label = note || 'Dépense déclarée après coup';
        const de = await tx.dailyExpense.create({
          data: {
            date: parseLocalDay(dayKey),
            amount,
            label,
            kind: 'JOURNALIER',
            source: fromSafe ? 'COFFRE' : 'CAISSE',
            category: normalizeCategory(body.category ?? 'AUTRE', label),
            afterCount: true,
            Summary: 'Déclarée après coup (contrôle du mois)',
          },
        });
        dailyExpenseId = de.id;
      }
      await tx.moneyGapLine.create({
        data: {
          month: body.month,
          kind,
          amount,
          date: dbDay(dayKey),
          note,
          fromSafe,
          dailyExpenseId,
          caisseSessionId: body.caisseSessionId || null,
        },
      });
    });
    return this.month(body.month);
  }

  async removeLine(id: string) {
    const line = await this.prisma.moneyGapLine.findUnique({ where: { id } });
    if (!line) throw new NotFoundException('Ligne introuvable');
    await this.prisma.$transaction(async (tx) => {
      await tx.moneyGapLine.delete({ where: { id } });
      if (line.dailyExpenseId) await tx.dailyExpense.deleteMany({ where: { id: line.dailyExpenseId } });
    });
    return this.month(line.month);
  }
}
