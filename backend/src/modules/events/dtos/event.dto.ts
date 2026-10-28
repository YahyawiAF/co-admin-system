import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { EventKind, EventStatus } from '@prisma/client';

export class CreateEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: EventKind })
  @IsOptional()
  @IsEnum(EventKind)
  kind?: EventKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty()
  @IsDateString()
  startAt: string;

  @ApiProperty()
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ description: 'Price of a place in DT; null = free' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;
}

export class UpdateEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: EventKind })
  @IsOptional()
  @IsEnum(EventKind)
  kind?: EventKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ description: 'Price of a place in DT; null = free' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;
}

export class EventAttendanceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class EventMemberDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiPropertyOptional({ description: 'Share link code the member came from' })
  @IsOptional()
  @IsString()
  sourceCode?: string;
}

/** Sign-up without an account: first name + phone (light visitor found or created by phone). */
export class EventGuestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(56)
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  sourceCode?: string;

  @ApiPropertyOptional({
    description: 'Survey answer given earlier in this browser',
  })
  @IsOptional()
  @IsUUID()
  surveyResponseId?: string;

  @ApiPropertyOptional({
    description:
      'Browser key of that survey answer (proves it is the same browser)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorKey?: string;
}

export class EventPaidDto {
  @ApiProperty()
  @IsBoolean()
  paid: boolean;

  @ApiPropertyOptional({
    description: 'Amount taken (DT); defaults to the event price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class EventFeedbackDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
