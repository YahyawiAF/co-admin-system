import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class AddJournalDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  public clientID: string;

  @IsNotEmpty()
  @IsDate()
  @ApiProperty()
  public registredTime: Date;

  @IsNotEmpty()
  @IsDate()
  @ApiProperty()
  public leaveTime: Date | null;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty()
  public isPayed: boolean;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  public payedAmount: number;
}
