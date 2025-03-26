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

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty()
  public isReservation: boolean;
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @ApiProperty()
  stayedPeriode: Date | null;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  public payedAmount: number;
}
