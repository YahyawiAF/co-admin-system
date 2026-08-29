import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingUnit, PriceCategory, PriceType } from '@prisma/client';

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

  @ApiPropertyOptional({ enum: PriceCategory })
  category?: PriceCategory | null;

  @ApiPropertyOptional()
  durationHours?: number | null;

  @ApiPropertyOptional({ enum: BillingUnit })
  billingUnit?: BillingUnit | null;

  @ApiPropertyOptional()
  periodDays?: number | null;

  @ApiPropertyOptional()
  spaceId?: string | null;

  @ApiPropertyOptional()
  spaceName?: string | null;

  @ApiPropertyOptional()
  reserveSeat?: boolean;

  @ApiPropertyOptional()
  reserveSeatFromHour?: number | null;

  @ApiPropertyOptional()
  reserveSeatToHour?: number | null;

  @ApiPropertyOptional({ description: 'If false, tarif is hidden from pickers' })
  isActive?: boolean;
}
