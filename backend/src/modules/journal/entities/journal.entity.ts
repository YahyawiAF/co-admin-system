import { MemberEntity } from '@/modules/member/entities/member.entity';
import { ApiProperty } from '@nestjs/swagger';
import { PriceEntity } from '@/modules/price/entities/price.entity';
import { ExpenseEntity } from '@/modules/expense/entities/exp.entitie';

export class JournalEntity {
  constructor({ members, price, expenses, ...data }: Partial<JournalEntity>) {
    Object.assign(this, data);
    
    if (members) {
      this.members = new MemberEntity(members);
    }
    
    if (price) {
      this.price = new PriceEntity(price);
    }
    
    if (expenses) {
        // Pour la relation many-to-many
        this.expenses = expenses.map(expense => new ExpenseEntity(expense));
        this.expenseIds = expenses.map(e => e.id); // Extraction des IDs
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
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  memberID: string;

  @ApiProperty()
  isReservation: boolean;

  @ApiProperty({ type: PriceEntity, required: false })
  price?: PriceEntity;

  @ApiProperty()
  priceId?: string;

  @ApiProperty({ type: MemberEntity, required: false })
  members?: MemberEntity;

  @ApiProperty({ type: [ExpenseEntity], required: false })
  expenses?: ExpenseEntity[];
  @ApiProperty({ type: [String], required: false})
  expenseIds?: string[];
}