import { Module } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { EventsModule } from '../webSocket/events.module';
import { TypedEventEmitterModule } from '../event-emitter/typed-event-emitter.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { AbonnementController } from './abonnement.controller';
import { AbonnementService } from './abonnement.service';

@Module({
  imports: [EventsModule, TypedEventEmitterModule,
     ConfigModule.forRoot(),
        JwtModule.register({
          secret: process.env.JWT_ACCESS_SECRET,
          signOptions: { expiresIn: '20m' },
        }),
  ],
  controllers: [AbonnementController],
  providers: [JwtAuthGuard,AbonnementService, PrismaService],
  exports: [AbonnementService],
})
export class AbonnementModule {}