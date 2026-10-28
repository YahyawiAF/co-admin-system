import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from 'database/prisma.service';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import {
  SurveysAdminController,
  SurveysPublicController,
} from './surveys.controller';
import { SurveysAdminService } from './surveys-admin.service';
import { SurveysPublicService } from './surveys-public.service';

/** Learn & Share: public surveys, campaign links and attribution, results, learning sessions. */
@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })],
  controllers: [SurveysAdminController, SurveysPublicController],
  providers: [
    PrismaService,
    JwtAuthGuard,
    SurveysAdminService,
    SurveysPublicService,
  ],
})
export class SurveysModule {}
