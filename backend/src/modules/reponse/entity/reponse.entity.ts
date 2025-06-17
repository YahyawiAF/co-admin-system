import { ApiProperty } from '@nestjs/swagger';
import { Response } from '@prisma/client';
import { Expose } from 'class-transformer';

export class ResponseEntity implements Response {
  constructor(partial: Partial<ResponseEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Unique identifier for the response' })
  id: string;

  @ApiProperty({ description: 'Content of the response' })
  content: string;

  @ApiProperty({ description: 'Timestamp when the response was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the response was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'ID of the reclamation this response belongs to' })
  reclamationId: string;

  @ApiProperty({ description: 'ID of the admin who created the response' })
  adminId: string;

  
  admin?: { fullname: string };

  @ApiProperty({ description: 'Computed admin full name', required: false })
  @Expose()
  get adminFullName(): string {
    return this.admin?.fullname || 'Unknown';
  }
}