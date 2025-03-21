import { MemberEntity } from '@/modules/member/entities/member.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Journal, JournalType } from '@prisma/client';
import { PriceEntity } from '@/modules/price/entities/price.entity'; // Importez l'entité PriceEntity

export class JournalEntity implements Journal {
  constructor({ members, price, ...data }: Partial<JournalEntity>) {
    Object.assign(this, data);
    if (members) {
      this.members = new MemberEntity(members);
    }
    if (price) {
      this.price = new PriceEntity(price);
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

  @ApiProperty()
  isReservation: boolean;

  @ApiProperty({ enum: JournalType, enumName: 'JournalType' })
  journalType: JournalType;

  @ApiProperty({ required: false, type: MemberEntity })
  members?: MemberEntity;

  @ApiProperty({ required: false, type: PriceEntity })
  price?: PriceEntity; // Ajoutez une référence à l'entité PriceEntity

  @ApiProperty()
  priceId: string; // Ajoutez une propriété priceId pour la relation
}