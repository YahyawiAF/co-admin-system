import { ApiProperty } from '@nestjs/swagger';
import { Journal } from '@prisma/client';

export class JournalEntity implements Journal {
  constructor(partial: Partial<JournalEntity>) {
    Object.assign(this, partial);
  }
  @ApiProperty()
  id: string;

  @ApiProperty()
  isPayed: boolean;

  @ApiProperty()
  registredTime: Date;

  @ApiProperty()
  leaveTime: Date | null;

  @ApiProperty()
  payedAmount: number;

  @ApiProperty()
  userId: string | null;

  @ApiProperty()
  createdAt: Date | null;

  @ApiProperty()
  updatedAt: Date | null;
}
