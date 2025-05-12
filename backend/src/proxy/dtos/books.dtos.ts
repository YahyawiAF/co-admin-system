import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class BookSeatsDto {
  @IsString()
  @IsNotEmpty()
  eventKey: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  seats: string[];

  @IsString()
  @IsNotEmpty()
  memberId: string;
}