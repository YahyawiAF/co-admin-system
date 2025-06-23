import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { CreateProductDto } from './dtos/createProduct.dto';
import { CreateDailyProductDto } from './dtos/createdailyproduct.dtos';
import { ProductEntity } from './entities/product.entitie';
import { UpdateProductDto } from './dtos/updateProduct';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<ProductEntity> {
    return new ProductEntity(
      await this.prisma.product.create({
        data: createProductDto,
      }),
    );
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
    return new ProductEntity(
      await this.prisma.product.update({
        where: { id },
        data: updateProductDto,
      }),
    );
  }

  async remove(id: string): Promise<ProductEntity> {
    return new ProductEntity(
      await this.prisma.product.delete({
        where: { id },
      }),
    );
  }

  async createDailyProduct(data: CreateDailyProductDto) {
    console.log('Backend received data for createDailyProduct:', data);
    if (data.memberId) {
      const memberExists = await this.prisma.member.findUnique({
        where: { id: data.memberId },
      });
      if (!memberExists) {
        throw new Error('Member not found');
      }
    }
    return this.prisma.dailyProduct.create({
      data: {
        productId: data.productId,
        quantite: data.quantite,
        date: data.date ? new Date(data.date) : new Date(),
        memberId: data.memberId, // Include memberId
      },
    });
  }

  async updateDailyProduct(
    id: string,
    data: Partial<{
      productId: string;
      quantite: number;
      date: string;
      memberId: string | null;
    }>,
  ) {
    console.log('Backend received data for updateDailyProduct:', data);
    if (data.memberId) {
      const memberExists = await this.prisma.member.findUnique({
        where: { id: data.memberId },
      });
      if (!memberExists) {
        throw new Error('Member not found');
      }
    }
    return this.prisma.dailyProduct.update({
      where: { id },
      data: {
        ...(data.productId && { productId: data.productId }),
        ...(data.quantite && { quantite: data.quantite }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.memberId !== undefined && { memberId: data.memberId }),
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
        member: true,
      },
    });
  }

  async findOneDailyProduct(id: string) {
    return this.prisma.dailyProduct.findUnique({
      where: { id },
      include: {
        product: true,
        member: true,
      },
    });
  }
}
