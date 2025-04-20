import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, Validate } from 'class-validator';
import { IsEmailOrPhone } from '../is-email-or-phone.decorator';
import { Role } from '@prisma/client';

export class SignUpDto {
  @ApiProperty({
    description: 'Email address or phone number',
    example: 'user@example.com or +1234567890',
  })
  @IsNotEmpty()
  @IsString()
  @Validate(IsEmailOrPhone)
  identifier: string; // Champ unifié pour email ou phone

  @ApiProperty()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fullname: string;
  @IsOptional()
  @IsEnum(Role)
  role?: Role; 

  @IsOptional()
  @IsString()
  secretToken?: string;
}