import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsNotEmpty()
  @IsString()
  senderId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000000)
  imageBase64?: string;
}