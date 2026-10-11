import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingUnit, PriceCategory, PriceType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  Max,
  Min,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TimeIntervalDto {
  @ApiProperty({ example: '02:00' })
  @IsNotEmpty()
  start: string;

  @ApiProperty({ example: '04:00' })
  @IsNotEmpty()
  end: string;
}

export class CreatePriceDto {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty({ type: TimeIntervalDto })
  @ValidateNested()
  @Type(() => TimeIntervalDto)
  timePeriod: TimeIntervalDto;

  @ApiProperty({ enum: PriceType, enumName: 'PriceType' })
  @IsEnum(PriceType)
  type: PriceType;

  @ApiPropertyOptional({ enum: PriceCategory })
  @IsOptional()
  @IsEnum(PriceCategory)
  category?: PriceCategory;

  @ApiPropertyOptional({
    description: 'One or more visit categories (JOURNEE, OPEN_SPACE, SALLE) or ABONNEMENT',
    enum: PriceCategory,
    isArray: true,
  })
  @IsOptional()
  @IsEnum(PriceCategory, { each: true })
  categories?: PriceCategory[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationHours?: number;

  @ApiPropertyOptional({ enum: BillingUnit })
  @IsOptional()
  @IsEnum(BillingUnit)
  billingUnit?: BillingUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  periodDays?: number;

  @ApiPropertyOptional({
    description: 'Optional space this tarif is linked to',
  })
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional({
    description: 'Spaces where this forfait can be chosen',
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  spaceIds?: string[];

  @ApiPropertyOptional({
    description: 'Forfait can be sold per seat',
  })
  @IsOptional()
  @IsBoolean()
  occupySeat?: boolean;

  @ApiPropertyOptional({
    description: 'Forfait can book the entire linked space',
  })
  @IsOptional()
  @IsBoolean()
  occupyWhole?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, an active subscription of this tarif keeps a dedicated seat until the period ends',
  })
  @IsOptional()
  @IsBoolean()
  reserveSeat?: boolean;

  @ApiPropertyOptional({
    description: 'Hour 0–23 when dedicated seat starts (null = all day)',
  })
  @IsOptional()
  @IsNumber()
  reserveSeatFromHour?: number | null;

  @ApiPropertyOptional({
    description: 'Hour 0–23 when dedicated seat ends (null = all day)',
  })
  @IsOptional()
  @IsNumber()
  reserveSeatToHour?: number | null;

  @ApiPropertyOptional({
    description: 'If false, tarif is hidden from visitor/admin pickers',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Créneau: sold only from this hour (0–23); null = all day',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  availableFromHour?: number | null;

  @ApiPropertyOptional({
    description: 'Créneau end hour (1–30, above 24 = after midnight)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  availableToHour?: number | null;

  @ApiPropertyOptional({ type: [Number], description: '0 = dimanche … 6 = samedi; empty = every day' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  availableDays?: number[];
}
