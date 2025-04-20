import { MemberEntity } from '@/modules/member/entities/member.entity';
import { ApiProperty } from '@nestjs/swagger';
import { PriceEntity } from '@/modules/price/entities/price.entity'; // Importez l'entité PriceEntity

export class AbonnementEntity  {
  constructor({ members, price, ...data }: Partial<AbonnementEntity>) {
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
  registredDate: Date;

  @ApiProperty()
  leaveDate: Date | null;

  @ApiProperty()
  stayedPeriode: string;

  @ApiProperty()
  payedAmount: number;


  @ApiProperty()
  createdAt: Date | null;

  @ApiProperty()
  updatedAt: Date | null;

  @ApiProperty()
  memberID: string;

  @ApiProperty()
  isReservation: boolean;

  @ApiProperty({ required: false, type: MemberEntity })
  members?: MemberEntity;

  @ApiProperty({ required: false, type: PriceEntity })
  price?: PriceEntity; 

  @ApiProperty()
  priceId: string; 
}