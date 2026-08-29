import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { CreateProductDto } from './dtos/createProduct.dto';
import { ProductEntity } from './entities/product.entitie';
import { UpdateProductDto } from './dtos/updateProduct';
import { EventsGateway } from '../webSocket/events.gateway';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
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
    const created = await this.prisma.product.create({
      data: createProductDto,
    });
    this.emitStock(created);
    return new ProductEntity(created);
  }

  async findAll(): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany();
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
    return this.prisma.dailyProduct.create({
      data: {
        productId: data.productId,
        quantite: data.quantite,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });
  }
  async updateDailyProduct(
    id: string,
    data: {
      productId?: string;
      quantite?: number;
      date?: string;
    },
  ) {
    return this.prisma.dailyProduct.update({
      where: { id },
      data: {
        ...(data.productId && { productId: data.productId }),
        ...(data.quantite && { quantite: data.quantite }),
        ...(data.date && { date: new Date(data.date) }),
      },
    });
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
