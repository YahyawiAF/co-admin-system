import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { CreateProductDto } from './dtos/createProduct.dto';
import { ProductEntity } from './entities/product.entitie';
import { UpdateProductDto } from './dtos/updateProduct';
import { EventsGateway } from '../webSocket/events.gateway';
import { SyncOutboxService } from '../erp-sync/sync-outbox.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private readonly syncOutbox: SyncOutboxService,
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
    return new ProductEntity(updated);
  }

  async remove(id: string): Promise<ProductEntity> {
    const deleted = await this.prisma.product.delete({
      where: { id },
    });
    this.emitStock({ ...deleted, stock: 0 });
    return new ProductEntity(deleted);
  }

  async createDailyProduct(data: {
    productId: string;
    quantite: number;
    date?: string;
  }) {
    const created = await this.prisma.dailyProduct.create({
      data: {
        productId: data.productId,
        quantite: data.quantite,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });
    await this.syncOutbox.enqueue('dailyProduct', created.id, 'CREATE');
    return created;
  }
  async updateDailyProduct(
    id: string,
    data: {
      productId?: string;
      quantite?: number;
      date?: string;
    },
  ) {
    const updated = await this.prisma.dailyProduct.update({
      where: { id },
      data: {
        ...(data.productId && { productId: data.productId }),
        ...(data.quantite && { quantite: data.quantite }),
        ...(data.date && { date: new Date(data.date) }),
      },
    });
    await this.syncOutbox.enqueue('dailyProduct', updated.id, 'UPDATE');
    return updated;
  }

  async removeDailyProduct(id: string) {
    return this.prisma.dailyProduct.delete({
      where: { id },
    });
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
