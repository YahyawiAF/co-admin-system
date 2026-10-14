import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';

@Module({
  controllers: [PromotionController],
  providers: [PromotionService, PrismaService],
  exports: [PromotionService],
})
export class PromotionModule {}
