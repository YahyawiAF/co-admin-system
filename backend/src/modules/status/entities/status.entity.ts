import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class StatusEntity implements Status {
  constructor(partial: Partial<StatusEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  email: string;

  @ApiProperty()
  sendid: string;

  @ApiProperty()
  listid: string;

  @ApiProperty()
  bounce_type: string;

  @ApiProperty()
  bounce_text: string;

  @ApiProperty()
  timestamp: Date | null;
}
