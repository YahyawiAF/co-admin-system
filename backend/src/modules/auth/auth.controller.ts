import { 
    Body, 
    Controller, 
    Get, 
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
   
  }
  