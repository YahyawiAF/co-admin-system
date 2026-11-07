// src/expenses/expenses.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseType, Prisma } from '@prisma/client';
import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { CreateExpenseDto } from './dtos/createExp.dto';
import { ExpenseEntity } from './entities/exp.entitie';
import { UpdateExpDto } from './dtos/updateExp.dto';
import { PrismaService } from 'database/prisma.service';
import {
  dbDay,
  localDayKey,
  parseLocalDay,
} from '../../../common/parse-local-day';
import {
  CATEGORY_LABEL,
  expenseAmount,
  expenseLabel,
  expenseMonths,
  monthKeyOf,
  normalizeCategory,
  normalizeSource,
  shareIn,
  type ExpenseCategory,
} from './expense-amount';
import { addMonths, subMonths } from 'date-fns';

type Tx = Prisma.TransactionClient;

export type QuickExpenseInput = {
  expenseId?: string | null;
  amount?: number | null;
  label?: string | null;
  date?: string | Date | null;
  kind?: ExpenseType | null;
  source?: string | null;
  Summary?: string | null;
  /** yyyy-MM the expense is for (null = month of the date) */
  forMonth?: string | null;
  /** Spread over N months from forMonth */
  spreadMonths?: number | null;
  category?: string | null;
};

/** « Pour quel mois » input: yyyy-MM or null; throws on anything else. */
function monthInput(v: string | null | undefined) {
  if (v == null || v === '') return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new BadRequestException('Mois invalide (aaaa-mm)');
  return v;
}

function spreadInput(v: number | null | undefined) {
  if (v == null) return 1;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 36) throw new BadRequestException('Répartition : 1 à 36 mois');
  return n;
}

const withExpense = { expense: true, coffreEntry: { select: { id: true } } } as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

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
    const expenses = await this.prisma.expense.findMany({
      orderBy: [{ dueDay: 'asc' }, { name: 'asc' }],
    });
    return expenses.map((expense) => new ExpenseEntity(expense));
  }

  private present<T extends Parameters<typeof expenseAmount>[0] & { date?: Date | null; createdAt?: Date | null; forMonth?: string | null; spreadMonths?: number | null; category?: string | null }>(de: T) {
    const label = expenseLabel(de);
    const months = expenseMonths(de);
    const category = normalizeCategory(de.category, label);
    return {
      ...de,
      amount: expenseAmount(de),
      label,
      category,
      categoryLabel: CATEGORY_LABEL[category],
      /** Months it counts in (yyyy-MM) */
      months,
      /** Paid in a month, counted in another */
      otherMonth: months[0] !== monthKeyOf(de.date ?? de.createdAt ?? new Date()) || months.length > 1,
    };
  }

  /** Keeps the coffre OUT line in step with an expense paid from the coffre. */
  private async syncCoffre(
    tx: Tx,
    de: { id: string; date: Date | null; amount: number | null; label: string | null; source: string },
  ) {
    await tx.coffreEntry.deleteMany({ where: { dailyExpenseId: de.id } });
    if (de.source !== 'COFFRE' || !de.amount) return;
    await tx.coffreEntry.create({
      data: {
        date: dbDay(de.date ?? new Date()),
        type: 'OUT',
        amount: de.amount,
        label: `Dépense · ${de.label || 'Dépense'}`,
        dailyExpenseId: de.id,
      },
    });
  }

  async createDailyExpense(data: QuickExpenseInput) {
    let amount = data.amount != null ? Number(data.amount) : null;
    let label = data.label?.trim() || null;
    let kind = data.kind ?? ExpenseType.JOURNALIER;
    if (data.expenseId) {
      const tpl = await this.prisma.expense.findUnique({ where: { id: data.expenseId } });
      if (!tpl) throw new NotFoundException('Charge introuvable');
      amount ??= tpl.amount;
      label ||= tpl.name;
      kind = tpl.type;
    }
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Montant invalide');
    }
    const source = normalizeSource(data.source ?? (kind === 'MENSUEL' ? 'AUTRE' : 'CAISSE'));
    const row = await this.prisma.$transaction(async (tx) => {
      const de = await tx.dailyExpense.create({
        data: {
          expenseId: data.expenseId || null,
          date: parseLocalDay(data.date ?? null),
          amount: round2(amount!),
          label: label || 'Dépense',
          kind,
          source,
          Summary: data.Summary?.trim() || null,
          forMonth: monthInput(data.forMonth),
          spreadMonths: spreadInput(data.spreadMonths),
          category: data.category ? normalizeCategory(data.category, label) : null,
        },
      });
      await this.syncCoffre(tx, de);
      return tx.dailyExpense.findUniqueOrThrow({ where: { id: de.id }, include: withExpense });
    });
    return this.present(row);
  }

  async updateDailyExpense(id: string, data: QuickExpenseInput) {
    const current = await this.prisma.dailyExpense.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Dépense introuvable');
    if (data.amount != null && !(Number(data.amount) > 0)) {
      throw new BadRequestException('Montant invalide');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const de = await tx.dailyExpense.update({
        where: { id },
        data: {
          expenseId: data.expenseId,
          date: data.date != null ? parseLocalDay(data.date) : undefined,
          amount: data.amount != null ? round2(Number(data.amount)) : undefined,
          label: data.label != null ? data.label.trim() || 'Dépense' : undefined,
          source: data.source != null ? normalizeSource(data.source) : undefined,
          Summary: data.Summary !== undefined ? data.Summary?.trim() || null : undefined,
          forMonth: data.forMonth !== undefined ? monthInput(data.forMonth) : undefined,
          spreadMonths: data.spreadMonths !== undefined ? spreadInput(data.spreadMonths) : undefined,
          category: data.category !== undefined ? (data.category ? normalizeCategory(data.category, data.label ?? current.label) : null) : undefined,
        },
      });
      await this.syncCoffre(tx, de);
      return tx.dailyExpense.findUniqueOrThrow({ where: { id }, include: withExpense });
    });
    return this.present(row);
  }

  async removeDailyExpense(id: string) {
    return this.prisma.dailyExpense.delete({
      where: { id },
    });
  }

  async findOneDailyExpense(id: string) {
    const row = await this.prisma.dailyExpense.findUnique({
      where: { id },
      include: withExpense,
    });
    return row ? this.present(row) : null;
  }

  async findAllDailyExpenses() {
    const rows = await this.prisma.dailyExpense.findMany({
      include: withExpense,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.present(r));
  }

  async listDaily(from?: string, to?: string) {
    const start = startOfDay(parseLocalDay(from ?? null));
    const end = endOfDay(parseLocalDay(to ?? from ?? null));
    const rows = await this.prisma.dailyExpense.findMany({
      where: { date: { gte: start, lte: end } },
      include: withExpense,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.present(r));
  }

  /** Daily purchases per day over the last `days` complete days (for the end-of-month estimate). */
  async dailyAverage(days = 28, now = new Date()) {
    const to = subDays(startOfDay(now), 1);
    const from = subDays(to, days - 1);
    const rows = await this.prisma.dailyExpense.findMany({
      where: { kind: 'JOURNALIER', date: { gte: from, lte: endOfDay(to) } },
      include: { expense: true },
    });
    return round2(rows.reduce((a, r) => a + expenseAmount(r), 0) / days);
  }

  /** Recent quick-expense descriptions (typing help only — nothing is saved as a template). */
  async suggestions() {
    const rows = await this.prisma.dailyExpense.findMany({
      where: { kind: 'JOURNALIER', date: { gte: subDays(new Date(), 60) } },
      include: { expense: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    const byLabel = new Map<string, { label: string; lastAmount: number; count: number }>();
    for (const r of rows) {
      const label = expenseLabel(r);
      const key = label.trim().toLowerCase();
      const cur = byLabel.get(key);
      if (cur) cur.count += 1;
      else byLabel.set(key, { label, lastAmount: expenseAmount(r), count: 1 });
    }
    return [...byLabel.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }

  async monthOverview(year: number, month: number) {
    if (!year || month < 1 || month > 12) throw new BadRequestException('Mois invalide');
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(start);
    const today = startOfDay(new Date());
    const [templates, rawRows] = await Promise.all([
      this.prisma.expense.findMany({
        where: { type: 'MENSUEL' },
        orderBy: [{ dueDay: 'asc' }, { name: 'asc' }],
      }),
      // Paid up to 3 years before (spread) or a year after (paid late) can count in this month
      this.prisma.dailyExpense.findMany({
        where: { date: { gte: subMonths(start, 36), lte: addMonths(end, 13) } },
        include: withExpense,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const monthKey = monthKeyOf(start);
    const all = rawRows.map((r) => ({ ...this.present(r), share: shareIn(r, monthKey) }));
    // Rows that count in this month: their share replaces the amount in every total
    const rows = all.filter((r) => r.share > 0).map((r) => ({ ...r, paidAmount: r.amount, amount: r.share }));
    /** Paid this month, for another month (cash out, not this month's bénéfice) */
    const inMonth = (r: (typeof all)[number]) => {
      const d = r.date ?? r.createdAt;
      return d >= start && d <= end;
    };
    const paidForOther = all.filter((r) => inMonth(r) && r.share < r.amount);
    const days = getDaysInMonth(start);

    const recurring = templates.map((t) => {
      const payments = rows.filter((r) => r.expenseId === t.id);
      const paid = round2(payments.reduce((a, p) => a + p.amount, 0));
      const dueDate = t.dueDay ? new Date(year, month - 1, Math.min(t.dueDay, days)) : null;
      const isPaid = payments.length > 0;
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        amount: t.amount,
        dueDay: t.dueDay,
        dueDate: dueDate ? localDayKey(dueDate) : null,
        status: isPaid
          ? ('paid' as const)
          : dueDate && dueDate < today
            ? ('late' as const)
            : dueDate && differenceInCalendarDays(dueDate, today) <= 5
              ? ('soon' as const)
              : ('todo' as const),
        paid,
        payments,
      };
    });

    const oneOff = rows.filter((r) => r.kind === 'MENSUEL' && !templates.some((t) => t.id === r.expenseId));
    const daily = rows.filter((r) => r.kind === 'JOURNALIER');

    const byLabel = new Map<string, { label: string; total: number; count: number }>();
    for (const r of daily) {
      const key = r.label.trim().toLowerCase();
      const cur = byLabel.get(key) ?? { label: r.label, total: 0, count: 0 };
      cur.total = round2(cur.total + r.amount);
      cur.count += 1;
      byLabel.set(key, cur);
    }
    const byDay = new Map<string, { date: string; total: number; count: number }>();
    for (const r of daily) {
      const key = localDayKey(r.date ?? r.createdAt);
      const cur = byDay.get(key) ?? { date: key, total: 0, count: 0 };
      cur.total = round2(cur.total + r.amount);
      cur.count += 1;
      byDay.set(key, cur);
    }
    const bySource = { CAISSE: 0, COFFRE: 0, AUTRE: 0 } as Record<string, number>;
    for (const r of all.filter(inMonth)) bySource[r.source] = round2((bySource[r.source] || 0) + r.amount);
    const byCategory = new Map<ExpenseCategory, { category: ExpenseCategory; label: string; total: number; count: number }>();
    for (const r of rows) {
      const cur = byCategory.get(r.category) ?? { category: r.category, label: r.categoryLabel, total: 0, count: 0 };
      cur.total = round2(cur.total + r.amount);
      cur.count += 1;
      byCategory.set(r.category, cur);
    }

    const dailyTotal = round2(daily.reduce((a, r) => a + r.amount, 0));
    const chargesPaid = round2(
      recurring.reduce((a, r) => a + r.paid, 0) + oneOff.reduce((a, r) => a + r.amount, 0),
    );
    const chargesRemaining = round2(
      recurring.filter((r) => r.status !== 'paid').reduce((a, r) => a + r.amount, 0),
    );
    return {
      year,
      month,
      recurring,
      oneOff,
      daily: {
        total: dailyTotal,
        count: daily.length,
        byLabel: [...byLabel.values()].sort((a, b) => b.total - a.total),
        byDay: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)),
        rows: daily,
      },
      totals: {
        spent: round2(dailyTotal + chargesPaid),
        daily: dailyTotal,
        chargesPaid,
        chargesRemaining,
        chargesPlanned: round2(templates.reduce((a, t) => a + t.amount, 0)),
        /** Money that left the caisse / coffre / bank this month (whatever month it is for) */
        bySource,
        byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total),
        /** Paid this month for another month */
        paidForOtherMonths: round2(paidForOther.reduce((a, r) => a + r.amount - r.share, 0)),
      },
      paidForOther: paidForOther.map((r) => ({ id: r.id, label: r.label, amount: r.amount, share: r.share, months: r.months, date: localDayKey(r.date ?? r.createdAt), source: r.source })),
    };
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
