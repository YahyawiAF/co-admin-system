import { MemberEntity } from '@/modules/member/entities/member.entity';
import { ApiProperty } from '@nestjs/swagger';
import { PriceEntity } from '@/modules/price/entities/price.entity';
import { UserEntity } from '@/modules/user/entities/user.entity';

export class JournalEntity {
  constructor(partial: Partial<JournalEntity> & { prices?: any }) {
    const { members, price, prices, createdBy, ...data } = partial as any;
    Object.assign(this, data);
    if (members) {
      this.members = new MemberEntity(members);
    }

    if (createdBy) {
      this.createdBy = new UserEntity(createdBy);
    }

    // Prisma relation is `prices`; keep API field as `price`
    const priceData = price || prices;
    if (priceData) {
      this.price = new PriceEntity(priceData);
      if (!this.priceId && priceData.id) {
        this.priceId = priceData.id;
      }
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
  memberID: string | null;

  @ApiProperty()
  isReservation: boolean;

  @ApiProperty()
  isAnonymous: boolean;

  @ApiProperty({ required: false, nullable: true })
  guestName: string | null;

  @ApiProperty({ required: false, type: UserEntity })
  createdBy?: UserEntity;

  @ApiProperty({ required: false, type: MemberEntity })
  members?: MemberEntity;

  @ApiProperty({ required: false, type: PriceEntity })
  price?: PriceEntity;

  @ApiProperty()
  priceId: string;

  @ApiProperty({ required: false, nullable: true })
  groupVisitId?: string | null;
}
