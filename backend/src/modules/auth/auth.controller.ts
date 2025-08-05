import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthEntity } from './entity/auth.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenGuard } from 'common/guards/refreshToken.guard';
import { Request } from 'express';
import { SignUpDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { Role } from '@prisma/client';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOkResponse({ type: AuthEntity })
  login(@Body() { identifier, password }: LoginDto) {
    return this.authService.login(identifier, password);
  }

  @Post('signup')
  @ApiOkResponse({ type: AuthEntity })
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(
      signUpDto.identifier,
      signUpDto.password,
      signUpDto.fullname,
      signUpDto.role,
    );
  }

  @UseGuards(RefreshTokenGuard)
  @Get('refresh')
  @ApiOkResponse({ type: AuthEntity })
  refreshTokens(@Req() req: Request) {
    const userId = req.user['sub'];
    const refreshToken = req.user['refreshToken'];
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Post('forgot-password')
  @ApiOkResponse({ description: 'Password reset email or SMS sent' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(forgotPasswordDto.identifier);
    return { message: 'Password reset email or SMS sent' };
  }

  @Post('reset-password/:token')
  @ApiOkResponse({ description: 'Password reset successfully' })
  async resetPassword(
    @Param('token') token: string,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    await this.authService.resetPassword(token, resetPasswordDto.newPassword);
    return { message: 'Password reset successfully' };
  }
  @Post('verify-reset-code')
  @ApiOkResponse({ description: 'Reset code verified successfully' })
  async verifyResetCode(@Body() verifyResetCodeDto: VerifyResetCodeDto) {
    await this.authService.verifyResetCode(
      verifyResetCodeDto.phoneNumber,
      verifyResetCodeDto.code,
    );
    return { message: 'Reset code verified successfully' };
  }
  @Post('reset-password-phone')
  @ApiOkResponse({ description: 'Password reset successfully' })
  async resetPasswordWithPhone(@Body() body: { phoneNumber: string; newPassword: string }) {
    await this.authService.resetPasswordWithPhone(body.phoneNumber, body.newPassword);
    return { message: 'Password reset successfully' };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Logout successful' })
  async logout(@Req() req: Request) {
    const userId = req.user['sub'];
    await this.authService.logout(userId);
    return { message: 'Logout successful' };
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Access to a protected resource' })
  getProtectedResource(@Req() req: Request) {
    const userId = req.user['sub'];
    return {
      message: 'This is a protected resource',
      userId: userId,
    };
  }
}

