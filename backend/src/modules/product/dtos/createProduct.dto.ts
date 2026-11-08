import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Ordinateur portable', required: true })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'PC portable 15" 16Go RAM',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Boisson', required: false, nullable: true })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiProperty({ example: 899.99, required: true })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @ApiProperty({ example: 1299.99, required: true })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ example: 10, required: true })
  @IsNotEmpty()
  @IsNumber()
  stock: number;

  @ApiProperty({
    example: 'product-image.jpg',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  img?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
