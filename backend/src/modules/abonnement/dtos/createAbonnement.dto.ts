import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsNumber,
  IsBoolean,
  IsOptional,
 
} from 'class-validator';
import { PaginatedResult } from 'prisma-pagination';

export class AddAbonnementDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  public memberID: string;


  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  public priceId: string;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  @ApiProperty()
  public registredDate: Date;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @ApiProperty()
  public leaveDate: Date | null;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty()
  public isPayed: boolean;

  @IsBoolean()
  @ApiProperty()
  public isReservation: boolean;
  @IsNotEmpty()
  @IsOptional()
  @ApiProperty()
  stayedPeriode: string;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  public payedAmount: number;
}