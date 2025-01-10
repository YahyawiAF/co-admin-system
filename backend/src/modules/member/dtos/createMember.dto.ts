import { ApiProperty } from '@nestjs/swagger';
import { Subscription } from '@prisma/client';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class AddMemberDto {
  // @IsNotEmpty()
  // @IsString()
  // @ApiProperty({ description: 'Unique identifier for the member' })
  // public id: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Email of the member', required: false })
  public email?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'First name of the member', required: false })
  public firstName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Last name of the member', required: false })
  public lastName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Functionality of the member', required: false })
  public functionality?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Biography of the member', required: false })
  public bio?: string;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ description: 'Credits associated with the member' })
  public credits: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ description: 'Phone associated with the member' })
  public phone: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Subscription plan of the member',
    required: false,
  })
  public plan?: Subscription;

  // @IsOptional()
  // @ApiProperty({
  //   description: 'Journals associated with the member',
  //   required: false,
  //   type: [String],
  // })
  // public journals?: string[];

  // @IsOptional()
  // @ApiProperty({
  //   description: 'Reservations associated with the member',
  //   required: false,
  //   type: [String],
  // })
  // public reservations?: string[];

  // @IsOptional()
  // @IsDate()
  // @ApiProperty({
  //   description: 'Creation timestamp of the member',
  //   required: false,
  // })
  // public createdAt?: Date;

  // @IsOptional()
  // @IsDate()
  // @ApiProperty({
  //   description: 'Last update timestamp of the member',
  //   required: false,
  // })
  // public updatedAt?: Date;

  // @IsOptional()
  // @IsDate()
  // @ApiProperty({
  //   description: 'Deletion timestamp of the member',
  //   required: false,
  // })
  // public deletedAt?: Date;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'Indicates whether the member is active' })
  public isActive: boolean;
}
