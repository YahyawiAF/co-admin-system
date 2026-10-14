import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'database/prisma.service';
import { SyncOutbox } from '@prisma/client';
import { AxiosError } from 'axios';
import { ErpInvoicePayload } from './types';
import { ErpClientService } from './erp-client.service';
import { SyncMappingService } from './sync-mapping.service';
import { SyncEntityType } from './sync-outbox.service';
import { memberToCustomer } from './mappers/member-to-customer.mapper';
import { priceToProduct } from './mappers/price-to-product.mapper';
import { abonnementToInvoice } from './mappers/abonnement-to-invoice.mapper';
import { journalToInvoice } from './mappers/journal-to-invoice.mapper';
import { productToErpProduct } from './mappers/product-to-product.mapper';
import { dailyProductToInvoice } from './mappers/daily-product-to-invoice.mapper';

const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 25;
// Separates tariffs/abonnements from café/goods in supply-chain-pro's own reporting.
const TARIF_CATEGORY = { slug: 'coworking-tarifs', name: 'Tarifs & abonnements (coworking)' };
const GOODS_CATEGORY = { slug: 'coworking-produits', name: 'Produits (café / boutique)' };
// Lower runs first: members/prices/products must exist in supply-chain-pro before an
// invoice can reference their external ids.
const ENTITY_PRIORITY: Record<string, number> = {
  member: 0,
  price: 0,
  product: 0,
  abonnement: 1,
  journal: 1,
  dailyProduct: 1,
};

/** Axios only says "status code 400" — append supply-chain-pro's own explanation from the body. */
function describeError(error: unknown): string {
  const base = (error as Error)?.message || 'Unknown error';
  const data = (error as AxiosError)?.response?.data as
    | { message?: unknown }
    | string
    | undefined;
  if (!data) return base;
  const detail =
    typeof data === 'string'
      ? data
      : typeof data.message === 'string' || Array.isArray(data.message)
        ? [data.message].flat().join('; ')
        : JSON.stringify(data);
  return `${base} — ${detail}`;
}

/** Drains SyncOutbox into supply-chain-pro, and runs a daily reconciliation sweep. */
@Injectable()
export class SyncProcessorService {
  private readonly logger = new Logger(SyncProcessorService.name);
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
    private readonly mapping: SyncMappingService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async drainOutbox(): Promise<void> {
    if (!this.erp.isEnabled() || this.draining) return;
    this.draining = true;
    try {
      const rows = await this.prisma.syncOutbox.findMany({
        where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } },
        orderBy: [{ createdAt: 'asc' }],
        take: BATCH_SIZE,
      });
      const ordered = [...rows].sort(
        (a, b) =>
          (ENTITY_PRIORITY[a.entityType] ?? 9) -
          (ENTITY_PRIORITY[b.entityType] ?? 9),
      );
      for (const row of ordered) {
        await this.processRow(row);
      }
    } finally {
      this.draining = false;
    }
  }

  /** Safety net for writes that bypass the hooked services (e.g. the mobile app's direct Prisma writes). */
  @Cron('0 3 * * *')
  async reconcile(): Promise<void> {
    if (!this.erp.isEnabled()) return;
    await this.enqueueStale('member', () =>
      this.prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, updatedAt: true },
      }),
    );
    await this.enqueueStale('price', () =>
      this.prisma.price.findMany({ select: { id: true, updatedAt: true } }),
    );
    await this.enqueueStale('abonnement', () =>
      this.prisma.abonnement.findMany({ select: { id: true, updatedAt: true } }),
    );
    await this.enqueueStale('journal', () =>
      this.prisma.journal.findMany({ select: { id: true, updatedAt: true } }),
    );
    await this.enqueueStale('product', () =>
      this.prisma.product.findMany({ select: { id: true, updatedAt: true } }),
    );
    await this.enqueueStale('dailyProduct', () =>
      this.prisma.dailyProduct.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { id: true, updatedAt: true },
      }),
    );
  }

  private async enqueueStale(
    entityType: SyncEntityType,
    load: () => Promise<{ id: string; updatedAt: Date }[]>,
  ): Promise<void> {
    const rows = await load();
    for (const row of rows) {
      const map = await this.mapping.get(entityType, row.id);
      if (map && map.syncedAt >= row.updatedAt) continue;
      const pending = await this.prisma.syncOutbox.findFirst({
        where: { entityType, entityId: row.id, status: 'PENDING' },
      });
      if (pending) continue;
      await this.prisma.syncOutbox.create({
        data: {
          entityType,
          entityId: row.id,
          operation: map ? 'UPDATE' : 'CREATE',
        },
      });
    }
  }

  private async processRow(row: SyncOutbox): Promise<void> {
    try {
      switch (row.entityType) {
        case 'member':
          await this.syncMember(row.entityId);
          break;
        case 'price':
          await this.syncPrice(row.entityId);
          break;
        case 'abonnement':
          await this.syncAbonnement(row.entityId);
          break;
        case 'journal':
          await this.syncJournal(row.entityId);
          break;
        case 'product':
          await this.syncProduct(row.entityId);
          break;
        case 'dailyProduct':
          await this.syncDailyProduct(row.entityId);
          break;
        default:
          throw new Error(`Unknown entityType "${row.entityType}"`);
      }
      await this.prisma.syncOutbox.update({
        where: { id: row.id },
        data: { status: 'SYNCED' },
      });
      // Earlier failures for this entity are resolved now — keep FAILED meaning "still broken".
      await this.prisma.syncOutbox.updateMany({
        where: {
          entityType: row.entityType,
          entityId: row.entityId,
          status: 'FAILED',
          createdAt: { lt: row.createdAt },
        },
        data: { status: 'SUPERSEDED' },
      });
    } catch (error) {
      const attempts = row.attempts + 1;
      const message = describeError(error).slice(0, 500);
      this.logger.warn(
        `Sync failed for ${row.entityType}:${row.entityId} (attempt ${attempts}) — ${message}`,
      );
      await this.prisma.syncOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: message,
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        },
      });
    }
  }

  private async syncMember(id: string): Promise<void> {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) return; // deleted since it was enqueued — nothing left to sync
    const existing = await this.mapping.get('member', id);
    const payload = memberToCustomer(member);
    const result = existing
      ? await this.erp.updateCustomer(existing.externalId, payload)
      : await this.erp.createCustomer(payload);
    await this.mapping.set('member', id, existing?.externalId ?? result.id);
  }

  /** Looks up a category by slug, creating it once if missing. Cached via SyncMapping. */
  private async ensureCategory(category: {
    slug: string;
    name: string;
  }): Promise<string> {
    const cached = await this.mapping.get('category', category.slug);
    if (cached) return cached.externalId;
    const found = await this.erp.getCategoryBySlug(category.slug);
    const externalId = found
      ? found.id
      : (await this.erp.createCategory(category)).id;
    await this.mapping.set('category', category.slug, externalId);
    return externalId;
  }

  private async syncPrice(id: string): Promise<void> {
    const price = await this.prisma.price.findUnique({ where: { id } });
    if (!price) return;
    const existing = await this.mapping.get('price', id);
    const categoryId = await this.ensureCategory(TARIF_CATEGORY);
    const payload = { ...priceToProduct(price), categoryId };
    const result = existing
      ? await this.erp.updateProduct(existing.externalId, payload)
      : await this.erp.createProduct(payload);
    await this.mapping.set('price', id, existing?.externalId ?? result.id);
  }

  private async syncProduct(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) return;
    const existing = await this.mapping.get('product', id);
    const categoryId = await this.ensureCategory(GOODS_CATEGORY);
    const payload = { ...productToErpProduct(product), categoryId };
    const result = existing
      ? await this.erp.updateProduct(existing.externalId, payload)
      : await this.erp.createProduct(payload);
    await this.mapping.set('product', id, existing?.externalId ?? result.id);
  }

  /**
   * Create on first sync; on later syncs, re-send everything except
   * amountDue/amountPaid — those are owned by the Payment flow from here on,
   * and resending the unpaid baseline would undo what a Payment already set.
   */
  private async upsertInvoice(
    existingExternalId: string | undefined,
    payload: ErpInvoicePayload,
  ): Promise<string> {
    if (existingExternalId) {
      const { amountDue, amountPaid, ...updatePayload } = payload;
      await this.erp.updateInvoice(existingExternalId, updatePayload);
      return existingExternalId;
    }
    const result = await this.erp.createInvoice(payload);
    return result.id;
  }

  private async syncDailyProduct(id: string): Promise<void> {
    const dailyProduct = await this.prisma.dailyProduct.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!dailyProduct || dailyProduct.status === 'CANCELLED') return;
    if (!dailyProduct.memberId) {
      // Known gap, same as anonymous Journal visits: no "walk-in customer" concept yet.
      return;
    }
    const customerMap = await this.mapping.get('member', dailyProduct.memberId);
    if (!customerMap) throw new Error('customer not yet synced — will retry');
    const productMap = await this.mapping.get('product', dailyProduct.productId);

    const invoiceMap = await this.mapping.get('dailyProduct', id);
    const payload = dailyProductToInvoice(
      dailyProduct,
      customerMap.externalId,
      productMap?.externalId ?? null,
    );
    const invoiceExternalId = await this.upsertInvoice(
      invoiceMap?.externalId,
      payload,
    );
    await this.mapping.set('dailyProduct', id, invoiceExternalId);

    if (dailyProduct.isPayed) {
      const already = await this.mapping.get('dailyProductPayment', id);
      if (!already) {
        const paid = await this.erp.createPayment({
          customerId: customerMap.externalId,
          invoiceId: invoiceExternalId,
          amount: payload.total,
          paymentMethod: 'cash',
          fundSource: 'UNDECLARED',
          paymentDate: (dailyProduct.date ?? dailyProduct.createdAt).toISOString(),
        });
        await this.mapping.set('dailyProductPayment', id, paid.id);
      }
    }
  }

  private async syncAbonnement(id: string): Promise<void> {
    const abonnement = await this.prisma.abonnement.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!abonnement) return;
    const customerMap = await this.mapping.get('member', abonnement.memberID);
    if (!customerMap) throw new Error('customer not yet synced — will retry');
    const productMap = await this.mapping.get('price', abonnement.priceId);

    const invoiceMap = await this.mapping.get('abonnement', id);
    const payload = abonnementToInvoice(
      abonnement,
      customerMap.externalId,
      productMap?.externalId ?? null,
    );
    const invoiceExternalId = await this.upsertInvoice(
      invoiceMap?.externalId,
      payload,
    );
    await this.mapping.set('abonnement', id, invoiceExternalId);

    for (const payment of abonnement.payments) {
      const already = await this.mapping.get('abonnementPayment', payment.id);
      if (already) continue;
      const paid = await this.erp.createPayment({
        customerId: customerMap.externalId,
        invoiceId: invoiceExternalId,
        amount: payment.amount,
        // Co-admin doesn't record how an abonnement payment was collected yet.
        paymentMethod: 'cash',
        fundSource: 'UNDECLARED',
        paymentDate: payment.paidAt.toISOString(),
      });
      await this.mapping.set('abonnementPayment', payment.id, paid.id);
    }
  }

  private async syncJournal(id: string): Promise<void> {
    const journal = await this.prisma.journal.findUnique({ where: { id } });
    if (!journal) return;
    if (journal.isAnonymous || !journal.memberID) {
      // Known V1 gap: no "walk-in customer" concept yet — see plan notes.
      return;
    }
    const customerMap = await this.mapping.get('member', journal.memberID);
    if (!customerMap) throw new Error('customer not yet synced — will retry');
    const productMap = journal.priceId
      ? await this.mapping.get('price', journal.priceId)
      : null;

    const invoiceMap = await this.mapping.get('journal', id);
    const payload = journalToInvoice(
      journal,
      customerMap.externalId,
      productMap?.externalId ?? null,
    );
    const invoiceExternalId = await this.upsertInvoice(
      invoiceMap?.externalId,
      payload,
    );
    await this.mapping.set('journal', id, invoiceExternalId);

    if ((journal.paidAmount ?? 0) > 0) {
      const already = await this.mapping.get('journalPayment', id);
      if (!already) {
        const paid = await this.erp.createPayment({
          customerId: customerMap.externalId,
          invoiceId: invoiceExternalId,
          amount: journal.paidAmount!,
          paymentMethod: 'cash',
          fundSource: 'UNDECLARED',
          paymentDate: (journal.paidAt ?? journal.registredTime).toISOString(),
        });
        await this.mapping.set('journalPayment', id, paid.id);
      }
    }
  }
}
