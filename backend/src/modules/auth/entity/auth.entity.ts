import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthEntity {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullname: string;

  @ApiProperty()
  phoneNumber: string; 

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;
  @ApiProperty()
  memberId?: string; 

}