import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { ProductsController } from './product.controller';
import { ProductsService } from './product.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService],
})
export class ProductsModule {}