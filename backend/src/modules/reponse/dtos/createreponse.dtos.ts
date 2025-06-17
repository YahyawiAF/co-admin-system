import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateResponseDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Content of the response' })
  content: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'ID of the reclamation this response belongs to' })
  reclamationId: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'ID of the admin creating the response' })
  adminId: string;
}