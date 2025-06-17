import { Module } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ReclamationController } from './recl.controller';
import { ReclamationService } from './recl.service';

@Module({
    
  controllers: [ReclamationController],
  providers: [ReclamationService, PrismaService],
  exports: [ReclamationService],
})
export class ReclamationModule {}