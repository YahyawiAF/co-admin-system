import { ApiProperty } from '@nestjs/swagger';
import { ExpenseType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
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

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number | null;
}
