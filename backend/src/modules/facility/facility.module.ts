import { Module } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { FacilityController } from './facility.controller';
import { FacilityService } from './facility.service';

@Module({
  controllers: [FacilityController],
  providers: [FacilityService, PrismaService],
})
export class FacilityModule {}
