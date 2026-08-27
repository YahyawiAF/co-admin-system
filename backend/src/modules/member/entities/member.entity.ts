import { ApiProperty } from '@nestjs/swagger';
import { Member, Subscription } from '@prisma/client';
import { Expose } from 'class-transformer';

export class MemberEntity implements Member {
  constructor(partial: Partial<MemberEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Unique identifier for the member' })
  id: string;

  @ApiProperty({ description: 'Email of the member', required: false })
  email: string | null;

  @ApiProperty({ description: 'First name of the member', required: false })
  firstName: string | null;

  @ApiProperty({ description: 'Last name of the member', required: false })
  lastName: string | null;

  @ApiProperty({ description: 'Functionality of the member', required: false })
  functionality: string | null;

  @ApiProperty({ description: 'Biography of the member', required: false })
  bio: string | null;

  @ApiProperty({
    description: 'Profile photo (data URL or http URL)',
    required: false,
  })
  avatarUrl: string | null;

  @ApiProperty({ description: 'Credits associated with the member' })
  credits: number;

  @ApiProperty({ description: 'Phone of the member' })
  phone: string | null;

  @ApiProperty({
    description: 'Password hash for mobile auth',
    required: false,
  })
  passwordHash: string | null;

  @ApiProperty({ description: 'Admin-only visitor number', required: false })
  visitorNumber: number | null;

  @ApiProperty({
    description: 'Subscription plan of the member',
    required: false,
  })
  plan: Subscription;

  @ApiProperty({
    description: 'Timestamp when the member was created',
    required: false,
  })
  createdAt: Date | null;

  @ApiProperty({
    description: 'Timestamp when the member was last updated',
    required: false,
  })
  updatedAt: Date | null;

  @ApiProperty({
    description: 'Timestamp when the member was deleted',
    required: false,
  })
  deletedAt: Date | null;

  @ApiProperty({
    description: 'userId connect member to user',
    required: false,
  })
  userId: number | null;

  @ApiProperty({ description: 'Indicates whether the member is active' })
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  groupId: string | null;

  @ApiProperty({ required: false, nullable: true })
  discountForfait: number | null;

  @ApiProperty({ required: false, nullable: true })
  discountSalle: number | null;

  @ApiProperty({ required: false, nullable: true })
  discountOpenSpace: number | null;

  @ApiProperty({ required: false, type: [String] })
  skills: string[];

  @ApiProperty({ required: false, type: [String] })
  services: string[];

  @ApiProperty({ required: false, nullable: true })
  linkedinUrl: string | null;

  @ApiProperty({ required: false })
  openToCollaboration: boolean;

  @ApiProperty({ required: false })
  showInDirectory: boolean;

  @ApiProperty({
    description:
      'Full name of the member (computed from firstName and lastName)',
  })
  @Expose()
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  @ApiProperty({
    description:
      'Full name of the member (computed from firstName and lastName)',
  })
  @Expose()
  get fullNameWithEmail(): string {
    const fullName = [this.firstName, this.lastName]
      .filter((name) => name)
      .join(' ');
    return fullName || 'Unknown'; // Default to 'Unknown' if both names are missing
  }
}
