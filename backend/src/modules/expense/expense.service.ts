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
  expenseAmount,
  expenseLabel,
  normalizeSource,
} from './expense-amount';

type Tx = Prisma.TransactionClient;

export type QuickExpenseInput = {
  expenseId?: string | null;
  amount?: number | null;
  label?: string | null;
  date?: string | Date | null;
  kind?: ExpenseType | null;
  source?: string | null;
  Summary?: string | null;
};

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

  private present<T extends Parameters<typeof expenseAmount>[0]>(de: T) {
    return { ...de, amount: expenseAmount(de), label: expenseLabel(de) };
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
      this.prisma.dailyExpense.findMany({
        where: { date: { gte: start, lte: end } },
        include: withExpense,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const rows = rawRows.map((r) => this.present(r));
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
    for (const r of rows) bySource[r.source] = round2((bySource[r.source] || 0) + r.amount);

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
        bySource,
      },
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
