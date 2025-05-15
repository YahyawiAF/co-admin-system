import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsPhoneNumber,
  IsObject,
} from 'class-validator';

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
    required: false 
  })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ 
   
    required: true 
  })
  @IsNotEmpty()
  @IsNumber()
  nbrPlaces: number;

  @ApiProperty({
    example: {
      facebook: 'https://facebook.com/facility',
      instagram: 'https://instagram.com/facility'
    },
    required: false
  })
  @IsOptional()
  @IsObject()
  socialNetworks?: Record<string, string>;

  @ApiProperty({
    
    required: false
  })
  @IsOptional()
  @IsObject()
  places?: Record<string, number>;
}