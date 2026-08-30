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
} from 'class-validator';

export enum MobileSeatModeDto {
  ADMIN_ASSIGN = 'ADMIN_ASSIGN',
  VISITOR_CHOOSE = 'VISITOR_CHOOSE',
  AUTO_ASSIGN = 'AUTO_ASSIGN',
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  organizationId?: string | null;
}
