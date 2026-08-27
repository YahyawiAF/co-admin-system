import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { PrismaService } from 'database/prisma.service';
import { PriceModule } from '../price/price.module';
import { EventsModule } from '../webSocket/events.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    PriceModule,
    EventsModule,
  ],
  controllers: [MobileController],
  providers: [MobileService, PrismaService],
  exports: [MobileService],
})
export class MobileModule {}
