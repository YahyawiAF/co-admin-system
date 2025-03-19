import { ApiProperty } from '@nestjs/swagger';
import { PriceType } from '@prisma/client';

export class PriceEntity {
  constructor(partial: Partial<PriceEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  timePeriod: string; 

  @ApiProperty()
  createdAt: Date | null;

  @ApiProperty()
  updatedAt: Date | null;

  @ApiProperty({ enum: PriceType, enumName: 'PriceType' })
  type: PriceType;
}
