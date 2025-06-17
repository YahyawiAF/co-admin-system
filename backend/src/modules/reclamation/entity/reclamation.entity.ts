import { ApiProperty } from '@nestjs/swagger';
import { Reclamation, ReclamationStatus } from '@prisma/client';
import { Expose } from 'class-transformer';

export class ReclamationEntity implements Reclamation {
  constructor(partial: Partial<ReclamationEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Unique identifier for the reclamation' })
  id: string;

  @ApiProperty({ description: 'Title of the reclamation' })
  title: string;

  @ApiProperty({ description: 'Description of the reclamation' })
  description: string;

  @ApiProperty({ description: 'Status of the reclamation', enum: ReclamationStatus })
  status: ReclamationStatus;

  @ApiProperty({ description: 'Timestamp when the reclamation was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the reclamation was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'ID of the member who submitted the reclamation' })
  memberId: string;

  
  member?: { firstName?: string; lastName?: string };

  @ApiProperty({ description: 'Computed member full name', required: false })
  @Expose()
  get memberFullName(): string {
    return this.member?.firstName && this.member?.lastName
      ? `${this.member.firstName} ${this.member.lastName}`
      : 'Unknown';
  }
}