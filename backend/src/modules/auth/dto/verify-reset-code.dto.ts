import { IsString } from 'class-validator';

export class VerifyResetCodeDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  code: string;
}