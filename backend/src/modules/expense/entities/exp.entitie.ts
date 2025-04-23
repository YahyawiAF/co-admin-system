import { ApiProperty } from '@nestjs/swagger';
import { ExpenseType } from '@prisma/client';

export class ExpenseEntity {
  constructor(partial: Partial<ExpenseEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Loyer salle' })
  name: string;

  @ApiProperty({ example: 'Paiement mensuel de la location', required: false })
  description?: string;

  @ApiProperty({ example: 1500.5 })
  amount: number;

  @ApiProperty({ enum: ExpenseType, enumName: 'ExpenseType' })
  type: ExpenseType;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
