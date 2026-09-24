import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PromoValueKind } from '@prisma/client';

export class CreateAppInstallPromoDto {
  @ApiProperty()
  @IsUUID()
  priceId: string;

  @ApiProperty({ enum: PromoValueKind })
  @IsEnum(PromoValueKind)
  valueKind: PromoValueKind;

  @ApiProperty({ description: 'Percentage (0–100) or amount in DT' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAppInstallPromoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  priceId?: string;

  @ApiProperty({ enum: PromoValueKind, required: false })
  @IsOptional()
  @IsEnum(PromoValueKind)
  valueKind?: PromoValueKind;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AppInstallPromoEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  facilityId: string;

  @ApiProperty()
  priceId: string;

  @ApiProperty({ enum: PromoValueKind })
  valueKind: PromoValueKind;

  @ApiProperty()
  value: number;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  priceName?: string;

  @ApiProperty({ required: false })
  priceAmount?: number;
}
