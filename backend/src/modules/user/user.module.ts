import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UsersService } from './user.service';
import { PrismaService } from '../../../database/prisma.service';
import { EventsModule } from '../webSocket/events.module';
import { TypedEventEmitterModule } from '../event-emitter/typed-event-emitter.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    EventsModule,
    TypedEventEmitterModule,
    forwardRef(() => AuthModule), // Use forwardRef() to resolve circular dependency
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '20m' },
    }),
  ],
  controllers: [UsersController],
  providers: [JwtAuthGuard, UsersService, PrismaService],
  exports: [UsersService],
})
export class UserModule {}
