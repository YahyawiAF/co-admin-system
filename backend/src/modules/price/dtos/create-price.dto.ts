import { ApiProperty } from '@nestjs/swagger';
import { PriceType } from '@prisma/client';
import { IsNotEmpty, IsEnum, IsNumber, ValidateNested } from 'class-validator';
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
}