import { MemberEntity } from '@/modules/member/entities/member.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Journal } from '@prisma/client';

export class JournalEntity implements Journal {
  constructor({ members, ...data }: Partial<JournalEntity>) {
    Object.assign(this, data);
    if (members) {
      this.members = new MemberEntity(members);
    }
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

  @ApiProperty()
  memberID: string;

  @ApiProperty({ required: false, type: MemberEntity })
  members?: MemberEntity;
}
