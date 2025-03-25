import { Injectable, NotFoundException } from '@nestjs/common';
import { PriceEntity } from './entities/price.entity';
import { PrismaService } from 'database/prisma.service';
import { CreatePriceDto } from './dtos/create-price.dto';
import { UpdatePriceDto } from './dtos/update-price.dto';

@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPriceDto: CreatePriceDto): Promise<PriceEntity> {
    console.log('Received DTO:', createPriceDto);
    
    try {
      const { name, price, timePeriod, type } = createPriceDto;
  
      if (!name || !price || !timePeriod || !type) {
        throw new Error('Missing required fields');
      }

      // Validation supplémentaire du timePeriod
      if (!timePeriod.start || !timePeriod.end) {
        throw new Error('Time period must have start and end times');
      }

      const priceEntity = await this.prisma.price.create({
        data: {
          name,
          price,
          timePeriod: {  // Stocké comme JSON
            start: timePeriod.start,
            end: timePeriod.end
          },
          type,
        },
      });
  
      return new PriceEntity({
        ...priceEntity,
        timePeriod: priceEntity.timePeriod as { start: string; end: string }
      });
    } catch (error) {
      console.error('Error creating price:', error);
      throw error;
    }
  }
  
  async findAll(): Promise<PriceEntity[]> {
    const prices = await this.prisma.price.findMany();
    return prices.map((price) => new PriceEntity({
      ...price,
      timePeriod: price.timePeriod as { start: string; end: string }
    }));
  }

  async findOne(id: string): Promise<PriceEntity> {
    const price = await this.prisma.price.findUnique({
      where: { id },
    });

    if (!price) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }

    return new PriceEntity({
      ...price,
      timePeriod: price.timePeriod as { start: string; end: string }
    });
  }

  async update(id: string, updatePriceDto: UpdatePriceDto): Promise<PriceEntity> {
    const existingPrice = await this.prisma.price.findUnique({
      where: { id },
    });

    if (!existingPrice) {
      throw new NotFoundException(`Price with ID ${id} not found`);
    }

    // Gestion du timePeriod dans l'update
    const updateData = {
      ...updatePriceDto,
      ...(updatePriceDto.timePeriod && {
        timePeriod: {
          start: updatePriceDto.timePeriod.start,
          end: updatePriceDto.timePeriod.end
        }
      })
    };

    const updatedPrice = await this.prisma.price.update({
      where: { id },
      data: updateData,
    });

    return new PriceEntity({
      ...updatedPrice,
      timePeriod: updatedPrice.timePeriod as { start: string; end: string }
    });
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