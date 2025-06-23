import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, IsPositive } from 'class-validator';

export class CreateDailyProductDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'UUID du produit' })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1, description: 'Quantité du produit' })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  quantite: number;

  @ApiProperty({ example: '2025-06-23', description: 'Date (optionnelle)', required: false })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ example: '789a1234-b56c-78d9-e012-345678901234', description: 'UUID du membre (optionnel)', required: false })
  @IsOptional()
  @IsUUID()
  memberId?: string;
}