import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AddStatusDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty()
  public email: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  public listid: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  public bounce_type: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  public bounce_text: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  public timestamp: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  public sendid: string;
}
