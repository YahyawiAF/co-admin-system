// src/booking/dto/book-seats.dto.ts
import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class BookSeatsDto {
  @IsString()
  @IsNotEmpty()
  eventKey: string; 

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  seats: string[];
}