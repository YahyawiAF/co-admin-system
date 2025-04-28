import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { CreateProductDto } from './dtos/createProduct.dto';
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



  async createDailyProduct(data: { productId: string , quantite: number }) {
  
    return this.prisma.dailyProduct.create({
      data: {
        productId: data.productId,
        quantite: data.quantite,
        
      },
    });
  }
  async updateDailyProduct(id: string, data: { productId: string , quantite: number }) {
    return this.prisma.dailyProduct.update({
      where: { id },
      data: {
        productId: data.productId,
        quantite: data.quantite,
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