import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  
} from 'class-validator';

export class AddJournalDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  public memberID: string;


  
  @IsString()
  @ApiProperty()
  public priceId: string;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  @ApiProperty()
  public registredTime: Date;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @ApiProperty()
  public leaveTime: Date | null;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty()
  public isPayed: boolean;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty()
  public isReservation: boolean;

  

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  @IsOptional()
  public payedAmount: number;
  @IsOptional()
  @IsArray()
  @ApiProperty({ required: false })
  public expenseIds?: string[];
  
}
