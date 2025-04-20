import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  
  @ApiProperty({ example: 'newPassword123', description: 'New password' })
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}