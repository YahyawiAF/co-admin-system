import { ApiProperty } from '@nestjs/swagger';
import { ReclamationStatus } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateReclamationDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Title of the reclamation' })
  title: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Description of the reclamation' })
  description: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'ID of the member submitting the reclamation' })
  memberId: string;

  @IsOptional()
  @IsEnum(ReclamationStatus)
  @ApiProperty({ description: 'Status of the reclamation', enum: ReclamationStatus, required: false })
  status?: ReclamationStatus;
}

