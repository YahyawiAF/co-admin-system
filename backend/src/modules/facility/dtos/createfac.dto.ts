import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsPhoneNumber,
  IsObject,
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  Min,
} from 'class-validator';
import { PriceCategory } from '@prisma/client';

export enum MobileSeatModeDto {
  ADMIN_ASSIGN = 'ADMIN_ASSIGN',
  VISITOR_CHOOSE = 'VISITOR_CHOOSE',
  AUTO_ASSIGN = 'AUTO_ASSIGN',
}

export enum PromoValueKindDto {
  PERCENT = 'PERCENT',
  FIXED_DT = 'FIXED_DT',
}

export class CreateFacilityDto {
  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  numtel: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  adresse: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  nbrPlaces: number;

  @ApiProperty({
    example: {
      facebook: 'https://facebook.com/facility',
      instagram: 'https://instagram.com/facility',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  socialNetworks?: Record<string, string>;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsObject()
  places?: Record<string, number>;

  @ApiProperty({
    enum: MobileSeatModeDto,
    required: false,
    description:
      'ADMIN_ASSIGN = admin picks seat; VISITOR_CHOOSE = visitor picks after confirm; AUTO_ASSIGN = auto seat (+ auto confirm when receptionAway)',
  })
  @IsOptional()
  @IsEnum(MobileSeatModeDto)
  mobileSeatMode?: MobileSeatModeDto;

  @ApiProperty({
    required: false,
    description:
      'When true (accueil en pause), visit requests auto-approve. Seat is auto-assigned unless VISITOR_CHOOSE.',
  })
  @IsOptional()
  @IsBoolean()
  receptionAway?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'When auto-accept was turned on; cleared after recap dismissed',
  })
  @IsOptional()
  receptionAwayStartedAt?: string | Date | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  organizationId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  appInstallGlobalPromoActive?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: PromoValueKindDto,
  })
  @IsOptional()
  @IsEnum(PromoValueKindDto)
  appInstallGlobalPromoKind?: PromoValueKindDto | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  appInstallGlobalPromoValue?: number | null;

  @ApiProperty({
    required: false,
    enum: PriceCategory,
    isArray: true,
    description: 'Tarif categories the global promo applies to (empty = all)',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PriceCategory, { each: true })
  appInstallGlobalPromoScopes?: PriceCategory[];

  @ApiProperty({ required: false, description: 'Warn N min before a pack/tier ends' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sessionWarnBeforeMin?: number;

  @ApiProperty({ required: false, description: 'AUTO: minutes kept on a tier after it ends' })
  @IsOptional()
  @IsInt()
  @Min(0)
  autoTierGraceMin?: number;

  @ApiProperty({ required: false, description: 'FIXED: overtime minutes without extra' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fixedGraceMin?: number;

  @ApiProperty({ required: false, description: 'FIXED: extra (DT) after the grace' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeSurchargeDt?: number;

  @ApiProperty({ required: false, description: 'FIXED: minutes over before next tier price' })
  @IsOptional()
  @IsInt()
  @Min(0)
  overtimeNextTierMin?: number;
}
