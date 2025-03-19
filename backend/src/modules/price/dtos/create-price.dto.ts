import { ApiProperty } from '@nestjs/swagger';
import { PriceType } from '@prisma/client';
import { IsNotEmpty, IsEnum, IsNumber } from 'class-validator';

export class CreatePriceDto {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNotEmpty()
  timePeriod: string;

  @ApiProperty({ enum: PriceType, enumName: 'PriceType' })
  @IsEnum(PriceType)
  type: PriceType;
}
