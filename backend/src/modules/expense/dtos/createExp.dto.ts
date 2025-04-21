import { ApiProperty } from '@nestjs/swagger';
import { ExpenseType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Loyer salle', required: true })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Paiement mensuel de la location',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1500.5, required: true })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    enum: ExpenseType,
    enumName: 'ExpenseType',
    example: ExpenseType.MENSUEL,
    required: true,
  })
  @IsNotEmpty()
  @IsEnum(ExpenseType)
  type: ExpenseType;

  @ApiProperty({
    example: '2024-03-01T00:00:00.000Z',
    required: true,
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  date: Date;
}
