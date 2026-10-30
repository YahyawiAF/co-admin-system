import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { PrismaService } from 'database/prisma.service';
import { PriceModule } from '../price/price.module';
import { EventsModule } from '../webSocket/events.module';
import { PushModule } from '../push/push.module';
import { PromotionModule } from '../promotion/promotion.module';
import { MemberOnboardingController } from './member-onboarding.controller';
import { MemberOnboardingService } from './member-onboarding.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    PriceModule,
    EventsModule,
    PushModule,
    PromotionModule,
  ],
  controllers: [MobileController, MemberOnboardingController],
  providers: [MobileService, MemberOnboardingService, PrismaService],
  exports: [MobileService],
})
export class MobileModule {}
