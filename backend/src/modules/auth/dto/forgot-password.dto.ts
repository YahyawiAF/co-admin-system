import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
export class ForgotPasswordDto {
@ApiProperty({ example: 'user@example.com or +1234567890', description: 'Email address or phone number' })
@IsString()
@IsNotEmpty()
identifier: string;
}