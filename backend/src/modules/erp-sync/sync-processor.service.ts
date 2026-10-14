import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'database/prisma.service';
import { SyncOutbox } from '@prisma/client';
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
    } catch (error) {
      const attempts = row.attempts + 1;
      const message = (error as Error).message?.slice(0, 500) || 'Unknown error';
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

  private async syncPrice(id: string): Promise<void> {
    const price = await this.prisma.price.findUnique({ where: { id } });
    if (!price) return;
    const existing = await this.mapping.get('price', id);
    const payload = priceToProduct(price);
    const result = existing
      ? await this.erp.updateProduct(existing.externalId, payload)
      : await this.erp.createProduct(payload);
    await this.mapping.set('price', id, existing?.externalId ?? result.id);
  }

  private async syncProduct(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) return;
    const existing = await this.mapping.get('product', id);
    const payload = productToErpProduct(product);
    const result = existing
      ? await this.erp.updateProduct(existing.externalId, payload)
      : await this.erp.createProduct(payload);
    await this.mapping.set('product', id, existing?.externalId ?? result.id);
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
    const result = invoiceMap
      ? await this.erp.updateInvoice(invoiceMap.externalId, payload)
      : await this.erp.createInvoice(payload);
    const invoiceExternalId = invoiceMap?.externalId ?? result.id;
    await this.mapping.set('dailyProduct', id, invoiceExternalId);

    if (dailyProduct.isPayed) {
      const already = await this.mapping.get('dailyProductPayment', id);
      if (!already) {
        const paid = await this.erp.createPayment({
          customerId: customerMap.externalId,
          invoiceId: invoiceExternalId,
          amount: payload.total,
          paymentMethod: 'cash',
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
    const result = invoiceMap
      ? await this.erp.updateInvoice(invoiceMap.externalId, payload)
      : await this.erp.createInvoice(payload);
    const invoiceExternalId = invoiceMap?.externalId ?? result.id;
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
    const result = invoiceMap
      ? await this.erp.updateInvoice(invoiceMap.externalId, payload)
      : await this.erp.createInvoice(payload);
    const invoiceExternalId = invoiceMap?.externalId ?? result.id;
    await this.mapping.set('journal', id, invoiceExternalId);

    if ((journal.paidAmount ?? 0) > 0) {
      const already = await this.mapping.get('journalPayment', id);
      if (!already) {
        const paid = await this.erp.createPayment({
          customerId: customerMap.externalId,
          invoiceId: invoiceExternalId,
          amount: journal.paidAmount!,
          paymentMethod: 'cash',
          paymentDate: (journal.paidAt ?? journal.registredTime).toISOString(),
        });
        await this.mapping.set('journalPayment', id, paid.id);
      }
    }
  }
}
