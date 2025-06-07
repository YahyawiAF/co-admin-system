import { ApiProperty } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserEntity implements User {
  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
    memberId: string;
    accessToken: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;

  @ApiProperty()
  fullname: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;

  @Exclude()z
  password: string;
  @ApiProperty()
  resetPasswordToken :string;
  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ required: false }) 
  img: string;

}
