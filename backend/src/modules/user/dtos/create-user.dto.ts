import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty()
  public email!: string;

  //   @IsNotEmpty()
  @IsString()
  @ApiProperty()
  public fullname!: string;

  @IsString()
  //   @IsNotEmpty()
  @MinLength(6)
  @ApiProperty()
  password: string;

  @IsString()
  //   @IsNotEmpty()
  @ApiProperty()
  refreshToken: string;

  @IsEnum(Role)
  @IsNotEmpty()
  @ApiProperty()
  role: Role;

  @ApiProperty({ required: false })
  @IsPhoneNumber() 

  phoneNumber?: string;
}

export class updateUserDto {
  @IsEmail()
  @ApiProperty()
  public email!: string;

  //   @IsNotEmpty()
  @IsString()
  @ApiProperty()
  public fullname!: string;

  @IsString()
  //   @IsNotEmpty()
  @ApiProperty()
  password: string;

  @IsString()
  //   @IsNotEmpty()
  @ApiProperty()
  refreshToken: string;

  @IsEnum(Role)
  @IsNotEmpty()
  @ApiProperty()
  role: Role;
}

export class AddUserDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty()
  public email: string;

  @IsEnum(Role)
  @IsNotEmpty()
  @ApiProperty()
  role: Role;

  @IsString()
  @IsOptional()
  @ApiProperty()
  public fullname: string;
}
