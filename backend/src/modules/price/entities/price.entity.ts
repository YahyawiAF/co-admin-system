import { ApiProperty } from '@nestjs/swagger';
import { PriceType } from '@prisma/client';

class TimeInterval {
  @ApiProperty({ example: '02:00' })
  start: string;

  @ApiProperty({ example: '04:00' })
  end: string;
}

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

  @ApiProperty({ type: TimeInterval })
  timePeriod: TimeInterval;

  @ApiProperty()
  createdAt: Date | null;

  @ApiProperty()
  updatedAt: Date | null;

  @ApiProperty({ enum: PriceType, enumName: 'PriceType' })
  type: PriceType;
}