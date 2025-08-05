// src/auth/dto/reset-password-phone.dto.ts
import { IsString, IsMobilePhone } from 'class-validator';

export class ResetPasswordPhoneDto {
  @IsMobilePhone()
  phoneNumber: string;

  @IsString()
  newPassword: string;
}