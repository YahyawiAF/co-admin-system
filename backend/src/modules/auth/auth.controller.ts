import {
    Body,
    Controller,
    Get, // Ajoutez Get ici
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
  
  @Controller('auth')
  @ApiTags('auth')
  export class AuthController {
    constructor(private readonly authService: AuthService) {}
  
    @Post('login')
    @ApiOkResponse({ type: AuthEntity })
    login(@Body() { email, password }: LoginDto) {
      return this.authService.login(email, password);
    }
  
    @Post('signup')
    @ApiOkResponse({ type: AuthEntity })
    signUp(@Body() signUpDto: SignUpDto) {
      return this.authService.signUp(signUpDto.email, signUpDto.password, signUpDto.fullname);
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
    @ApiOkResponse({ description: 'Password reset email sent' })
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
      await this.authService.requestPasswordReset(forgotPasswordDto.email);
      return { message: 'Password reset email sent' };
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
  
    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiOkResponse({ description: 'Logout successful' })
    async logout(@Req() req: Request) {
      const userId = req.user['sub'];
      await this.authService.logout(userId);
      return { message: 'Logout successful' };
    }
  
    // Ajoutez cette nouvelle route protégée
    @Get('protected')
    @UseGuards(JwtAuthGuard) // Appliquez le guard pour protéger la route
    @ApiOkResponse({ description: 'Accès à une ressource protégée' })
    getProtectedResource(@Req() req: Request) {
      // Vous pouvez accéder aux informations de l'utilisateur via `req.user`
      const userId = req.user['sub'];
      return {
        message: 'Ceci est une ressource protégée',
        userId: userId,
      };
    }
  }