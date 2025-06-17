import { Module } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

import { ResponseController } from './rep.controller';
import { ResponseService } from './rep.service';

@Module({
 
  controllers: [ResponseController],
  providers: [ResponseService, PrismaService],
  exports: [ResponseService],
})
export class ResponseModule {}