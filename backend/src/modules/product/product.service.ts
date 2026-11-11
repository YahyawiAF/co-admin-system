import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ProductOrderStatus } from '@prisma/client';
import { orderUnitPrice } from './order-price';
import { parseLocalDay } from '../../../common/parse-local-day';
import { PrismaService } from 'database/prisma.service';
import { CreateProductDto } from './dtos/createProduct.dto';
import { ProductEntity } from './entities/product.entitie';
import { UpdateProductDto } from './dtos/updateProduct';
import { EventsGateway } from '../webSocket/events.gateway';
import { SyncOutboxService } from '../erp-sync/sync-outbox.service';
import { StockService } from '../stock/stock.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private readonly syncOutbox: SyncOutboxService,
    private readonly stock: StockService,
  ) {}

  private emitStock(product: { id: string; name: string; stock: number }) {
    this.eventsGateway.sendProductUpdated({
      type: 'product_updated',
      productId: product.id,
      name: product.name,
      stock: product.stock,
    });
  }

  async create(createProductDto: CreateProductDto): Promise<ProductEntity> {
    let organizationId = (createProductDto as { organizationId?: string })
      .organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      organizationId = org?.id;
    }
    const created = await this.prisma.product.create({
      data: { ...createProductDto, organizationId },
    });
    this.emitStock(created);
    await this.syncOutbox.enqueue('product', created.id, 'CREATE');
    return new ProductEntity(created);
  }

  async findAll(organizationId?: string): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({
      where: organizationId ? { organizationId } : undefined,
    });
    return products.map((product) => new ProductEntity(product));
  }

  async findOne(id: string): Promise<ProductEntity> {
    return new ProductEntity(
      await this.prisma.product.findUniqueOrThrow({
        where: { id },
      }),
    );
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductEntity> {
    const updated = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
    this.emitStock(updated);
    await this.syncOutbox.enqueue('product', updated.id, 'UPDATE');
    // Products with a recipe keep the stock computed from their ingredients
    await this.stock.syncProductStock();
    return new ProductEntity(updated);
  }

  async remove(id: string): Promise<ProductEntity> {
    const deleted = await this.prisma.product.delete({
      where: { id },
    });
    this.emitStock({ ...deleted, stock: 0 });
    return new ProductEntity(deleted);
  }

  /**
   * `fromAdmin` = a sale added later from Produits › Ventes (forgotten sale): it may carry
   * a price, a member and paid / not paid, and is marked as edited.
   */
  async createDailyProduct(data: {
    productId: string;
    quantite: number;
    date?: string;
    unitPrice?: number | null;
    memberId?: string | null;
    isPayed?: boolean;
    fromAdmin?: boolean;
  }) {
    if (data.fromAdmin) {
      if (!data.productId) throw new BadRequestException('Produit requis');
      if (!(Number(data.quantite) >= 1)) throw new BadRequestException('Quantité invalide');
      if (data.unitPrice != null && !(Number(data.unitPrice) >= 0)) throw new BadRequestException('Prix invalide');
    }
    const created = await this.prisma.dailyProduct.create({
      data: {
        productId: data.productId,
        quantite: Math.round(Number(data.quantite)),
        date: data.date ? (data.fromAdmin ? this.dayAtNoon(data.date) : new Date(data.date)) : new Date(),
        ...(data.fromAdmin && {
          unitPrice: data.unitPrice != null ? Number(data.unitPrice) : null,
          memberId: data.memberId || null,
          isPayed: !!data.isPayed,
          status: ProductOrderStatus.CONFIRMED,
          editedAt: new Date(),
        }),
      },
    });
    await this.syncOutbox.enqueue('dailyProduct', created.id, 'CREATE');
    void this.stock.syncProductStock();
    return created;
  }
  async updateDailyProduct(
    id: string,
    data: {
      productId?: string;
      quantite?: number;
      date?: string;
      /** Price per unit actually charged (null = product price) */
      unitPrice?: number | null;
      /** Correction from Produits › Ventes: marks the sale as edited */
      fromAdmin?: boolean;
    },
  ) {
    if (data.quantite != null && !(Number(data.quantite) >= 1)) throw new BadRequestException('Quantité invalide');
    if (data.unitPrice != null && !(Number(data.unitPrice) >= 0)) throw new BadRequestException('Prix invalide');
    const updated = await this.prisma.dailyProduct.update({
      where: { id },
      data: {
        ...(data.productId && { productId: data.productId }),
        ...(data.quantite && { quantite: Math.round(Number(data.quantite)) }),
        ...(data.date && { date: data.fromAdmin ? this.dayAtNoon(data.date) : new Date(data.date) }),
        ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice == null ? null : Number(data.unitPrice) }),
        ...(data.fromAdmin && { editedAt: new Date() }),
      },
    });
    await this.syncOutbox.enqueue('dailyProduct', updated.id, 'UPDATE');
    void this.stock.syncProductStock();
    return updated;
  }

  async removeDailyProduct(id: string) {
    const deleted = await this.prisma.dailyProduct.delete({
      where: { id },
    });
    void this.stock.syncProductStock();
    return deleted;
  }

  /** A yyyy-MM-dd day as a local noon (keeps the day whatever the time zone). */
  private dayAtNoon(day: string) {
    const d = parseLocalDay(day);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  /**
   * Sales list for Produits › Ventes: confirmed orders, newest first, 20 per page.
   * `status`: all | unpaid | paid. Totals cover every page.
   */
  async listSales(q: { status?: string; page?: number; pageSize?: number; organizationId?: string; productId?: string }) {
    const pageSize = Math.min(100, Math.max(5, Number(q.pageSize) || 20));
    const page = Math.max(1, Number(q.page) || 1);
    const base: Prisma.DailyProductWhereInput = {
      status: { notIn: [ProductOrderStatus.CANCELLED, ProductOrderStatus.PENDING] },
      ...(q.organizationId && { product: { organizationId: q.organizationId } }),
      ...(q.productId && { productId: q.productId }),
    };
    const where: Prisma.DailyProductWhereInput = {
      ...base,
      ...(q.status === 'unpaid' && { isPayed: false }),
      ...(q.status === 'paid' && { isPayed: true }),
    };
    const [total, rows, all] = await Promise.all([
      this.prisma.dailyProduct.count({ where }),
      this.prisma.dailyProduct.findMany({
        where,
        orderBy: [{ date: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { name: true, sellingPrice: true } },
          member: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.dailyProduct.findMany({
        where: base,
        select: { quantite: true, unitPrice: true, isPayed: true, product: { select: { sellingPrice: true } } },
      }),
    ]);
    const money = (o: { quantite: number; unitPrice: number | null; product: { sellingPrice: number } | null }) =>
      orderUnitPrice(o) * o.quantite;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const unpaid = all.filter((o) => !o.isPayed);
    return {
      page,
      pageSize,
      total,
      totals: {
        count: all.length,
        amount: round2(all.reduce((s, o) => s + money(o), 0)),
        unpaidCount: unpaid.length,
        unpaidAmount: round2(unpaid.reduce((s, o) => s + money(o), 0)),
      },
      rows: rows.map((o) => ({
        id: o.id,
        date: o.date ?? o.createdAt,
        productId: o.productId,
        productName: o.product?.name ?? 'Produit',
        memberId: o.memberId,
        memberName: o.member ? [o.member.firstName, o.member.lastName].filter(Boolean).join(' ') || null : null,
        quantity: o.quantite,
        unitPrice: orderUnitPrice(o),
        /** Price typed on the sale (null = product price) */
        customPrice: o.unitPrice,
        total: round2(money(o)),
        isPayed: o.isPayed,
        editedAt: o.editedAt,
      })),
    };
  }

  async findAllDailyProduct() {
    return this.prisma.dailyProduct.findMany({
      include: {
        product: true,
      },
    });
  }

  async findOneDailyProduct(id: string) {
    return this.prisma.dailyProduct.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });
  }
}
