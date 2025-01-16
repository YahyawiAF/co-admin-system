import { ApiProperty } from '@nestjs/swagger';
import { JournalType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class AddJournalDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  public memberID: string;

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

  @IsEnum(JournalType)
  @IsNotEmpty()
  @ApiProperty()
  journalType: JournalType;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  public payedAmount: number;
}
