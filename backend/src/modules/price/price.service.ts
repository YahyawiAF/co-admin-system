import { Injectable, NotFoundException } from '@nestjs/common';

import { PriceEntity } from './entities/price.entity';
import { PrismaService } from 'database/prisma.service';
import { CreatePriceDto } from './dtos/create-price.dto';
import { UpdatePriceDto } from './dtos/update-price.dto';

@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPriceDto: CreatePriceDto): Promise<PriceEntity> {
    console.log('Received DTO:', createPriceDto);  // 
    
    try {
      const { name, price, timePeriod, type } = createPriceDto;
  
      if (!name || !price || !timePeriod || !type) {
        throw new Error('Missing required fields');
      }
  
      const priceEntity = await this.prisma.price.create({
        data: {
          name,
          price,
          timePeriod,
          type,
        },
      });
  
      return new PriceEntity(priceEntity);
    } catch (error) {
      console.error('Error creating price:', error);
      throw error;  // Lancez à nouveau l'erreur après l'avoir loggée
    }
  }
  
  
  async findAll(): Promise<PriceEntity[]> {
    const prices = await this.prisma.price.findMany();
    return prices.map((price) => new PriceEntity(price));
  }

  async findOne(id: string): Promise<PriceEntity> {
    const price = await this.prisma.price.findUnique({
      where: { id },
    });

    if (!price) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }

    return new PriceEntity(price);
  }

  async update(id: string, updatePriceDto: UpdatePriceDto): Promise<PriceEntity> {
    const existingPrice = await this.prisma.price.findUnique({
      where: { id },
    });

    if (!existingPrice) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }

    const updatedPrice = await this.prisma.price.update({
      where: { id },
      data: updatePriceDto,
    });

    return new PriceEntity(updatedPrice);
  }

  async remove(id: string): Promise<void> {
    const price = await this.prisma.price.findUnique({
      where: { id },
    });

    if (!price) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }

    await this.prisma.price.delete({
      where: { id },
    });
  }
}
