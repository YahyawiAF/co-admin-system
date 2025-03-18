import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../../database/prisma.module';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenStrategy } from './refreshToken.strategy';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from '../user/user.module';  // Import UserModule

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '20m' },
    }),
    PrismaModule,
    PassportModule,
    forwardRef(() => UserModule),  // Use forwardRef() to resolve circular dependency
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
