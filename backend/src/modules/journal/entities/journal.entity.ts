import { MemberEntity } from '@/modules/member/entities/member.entity';
import { ApiProperty } from '@nestjs/swagger';
import { PriceEntity } from '@/modules/price/entities/price.entity'; // Importez l'entité PriceEntity
import { UserEntity } from '@/modules/user/entities/user.entity';

export class JournalEntity {
  constructor({ members, price, createdBy, ...data }: Partial<JournalEntity>) {
    Object.assign(this, data);
    if (members) {
      this.members = new MemberEntity(members);
    }

    if (createdBy) {
      this.createdBy = new UserEntity(createdBy);
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
  createdbyUserID: string | null;

  @ApiProperty()
  createdAt: Date | null;

  @ApiProperty()
  updatedAt: Date | null;

  @ApiProperty()
  memberID: string;

  @ApiProperty()
  isReservation: boolean;

  @ApiProperty({ required: false, type: UserEntity })
  createdBy?: UserEntity;

  @ApiProperty({ required: false, type: MemberEntity })
  members?: MemberEntity;

  @ApiProperty({ required: false, type: PriceEntity })
  price?: PriceEntity; // Ajoutez une référence à l'entité PriceEntity

  @ApiProperty()
  priceId: string; // Ajoutez une propriété priceId pour la relation
}
