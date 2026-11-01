import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsNumber,
  IsBoolean,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class AddJournalDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  public memberID?: string;

  @IsString()
  @ApiProperty()
  public createdbyUserID?: string;

  @IsString()
  @ApiProperty()
  public priceId: string;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  @ApiProperty()
  public registredTime: Date;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDate()
  @Type(() => Date)
  @ApiProperty({ nullable: true, required: false })
  public leaveTime: Date | null;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty()
  public isPayed: boolean;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty()
  public isReservation: boolean;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  public payedAmount: number;

  /** Amount actually collected (payedAmount = amount owed) */
  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false })
  public paidAmount?: number;

  /** Part of the price given away ("Offert"): payedAmount is the amount after it, no debt. */
  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: false, nullable: true })
  public offeredAmount?: number | null;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  public isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  public guestName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  public groupVisitId?: string;
}
