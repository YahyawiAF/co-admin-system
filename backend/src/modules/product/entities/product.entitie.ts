import { ApiProperty } from '@nestjs/swagger';

export class ProductEntity {
  constructor(partial: Partial<ProductEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'UUID du produit' })
  id: string;

  @ApiProperty({ example: 'Ordinateur portable', description: 'Nom du produit' })
  name: string;

  @ApiProperty({
    example: 'PC portable 15" 16Go RAM',
    description: 'Description du produit',
    required: false,
  })
  description?: string;

  @ApiProperty({
    example: 899.99,
    description: 'Prix d\'achat du produit',
  })
  purchasePrice: number;

  @ApiProperty({
    example: 1299.99,
    description: 'Prix de vente du produit',
  })
  sellingPrice: number;

  @ApiProperty({
    example: 10,
    description: 'Quantité en stock',
  })
  stock: number;

  @ApiProperty({
    example: 'image.jpg',
    description: 'URL de l\'image du produit',
    required: false,
  })
  img?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Date de dernière mise à jour',
  })
  updatedAt: Date;
}