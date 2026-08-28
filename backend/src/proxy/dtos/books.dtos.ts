import { IsArray, IsString, IsNotEmpty, IsOptional } from 'class-validator';

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

  @IsOptional()
  @IsString()
  spaceId?: string;
}
