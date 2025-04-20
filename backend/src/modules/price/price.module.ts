import { Module } from '@nestjs/common';
import { PriceService } from './price.service';
import { PriceController } from './price.controller';
import { PrismaService } from 'database/prisma.service'; 
import { EventsModule } from '../webSocket/events.module';
import { TypedEventEmitterModule } from '../event-emitter/typed-event-emitter.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';


  @Module({
    imports: [EventsModule, TypedEventEmitterModule,
       ConfigModule.forRoot(),
          JwtModule.register({
            secret: process.env.JWT_ACCESS_SECRET,
            signOptions: { expiresIn: '20m' },
          }),
    ],
  controllers: [PriceController], 
 providers: [JwtAuthGuard,PriceService, PrismaService],
   exports: [PriceService],
})
export class PriceModule {}
