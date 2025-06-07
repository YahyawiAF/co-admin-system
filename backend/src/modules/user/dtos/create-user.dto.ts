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
  Matches,
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

  @ApiProperty({ required: false }) 
  @IsOptional()
  @IsString()
  img?: string;
}

export class updateUserDto {
    @IsOptional()
    @IsEmail()
    @ApiProperty({ required: false })
    public email?: string;
  
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public fullname?: string;
  
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    password?: string;
  
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    refreshToken?: string;
  
    @IsOptional()
    @IsEnum(Role)
    @ApiProperty({ required: false })
    role?: Role;
  
    @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/, {
      message: 'Le numéro doit être au format international (ex: +212612345678)',
    })
    @ApiProperty({ required: false })
    phoneNumber?: string;

    @IsOptional() 
  @IsString()
  @ApiProperty({ required: false })
  img?: string;
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

  @IsOptional() 
  @IsString()
  @ApiProperty({ required: false })
  img?: string;
}
