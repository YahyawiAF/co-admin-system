import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthEntity {
  @ApiProperty({ description: 'Access token for authentication' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token for renewing access' })
  refreshToken: string;

  @ApiProperty({ description: 'Unique identifier of the user' })
  id: string;

  @ApiProperty({ description: 'Email address of the user', required: false })
  email: string;

  @ApiProperty({ description: 'Full name of the user', required: false })
  fullname: string;

  @ApiProperty({ description: 'Phone number of the user', required: false })
  phoneNumber: string;

  @ApiProperty({ enum: Role, enumName: 'Role', description: 'Role of the user' })
  role: Role;

  @ApiProperty({ description: 'Unique identifier of the associated member', required: false })
  memberId?: string;
}