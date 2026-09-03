import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitRequestType } from '@prisma/client';

export class MobileRegisterDto {
  @ApiProperty({ example: '20123456' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'If true, password is required (subscription flow)',
  })
  @IsBoolean()
  requirePassword: boolean;

  @ApiPropertyOptional({
    description: 'Organization slug for tenant isolation',
  })
  @IsOptional()
  @IsString()
  orgSlug?: string;
}

export class QuickRegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orgSlug: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+21620123456' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class MobileLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgSlug?: string;
}

export class StartDaySessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional({ enum: ['open', 'salle', 'all', 'none'] })
  @IsOptional()
  @IsIn(['open', 'salle', 'all', 'none'])
  reserveKind?: 'open' | 'salle' | 'all' | 'none';

  @ApiPropertyOptional({ description: 'Hours billed for HOURLY tarifs' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seatLabel?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatLabels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupVisitId?: string;
}

export class StartSubscriptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPayed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reservedSeatLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reservedSeatSpaceId?: string;
}

export class CheckoutSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPayed?: boolean;
}

export class QuickCheckInDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdbyUserID?: string;

  /** Walk-in with no Member row */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional({ enum: ['open', 'salle', 'all', 'none'] })
  @IsOptional()
  @IsIn(['open', 'salle', 'all', 'none'])
  reserveKind?: 'open' | 'salle' | 'all' | 'none';

  @ApiPropertyOptional({ description: 'Hours billed for HOURLY tarifs' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seatLabel?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatLabels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupVisitId?: string;

  @ApiPropertyOptional({
    description: 'Book this seat under another member (group extras)',
  })
  @IsOptional()
  @IsString()
  bookForMemberId?: string;
}

export class BookSpaceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional({ enum: ['open', 'salle', 'all'] })
  @IsOptional()
  @IsIn(['open', 'salle', 'all'])
  kind?: 'open' | 'salle' | 'all';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableId?: string;
}

export class CreateVisitRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiProperty({ enum: VisitRequestType })
  @IsEnum(VisitRequestType)
  type: VisitRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seatLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  occupyWhole?: boolean;
}

export class ClaimSeatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({ description: 'Seat label on the floor plan' })
  @IsString()
  @IsNotEmpty()
  seatLabel: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgSlug?: string;
}

export class UpdateMobileProfileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Job / métier' })
  @IsOptional()
  @IsString()
  functionality?: string;

  @ApiPropertyOptional({ description: 'Skills / compétences' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openToCollaboration?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInDirectory?: boolean;
}

export class CreateStaffMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromUserId?: string;
}

export class CreateCommunityMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fromMemberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toMemberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class CreateMobileOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class UpdateMobileOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class ScanInDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;
}

export class MoveSeatDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromSeatLabel?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toSeatLabel: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromSpaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toSpaceId?: string;
}
