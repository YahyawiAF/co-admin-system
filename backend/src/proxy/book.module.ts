// src/booking/booking.module.ts
import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
  imports: [ProxyModule], // Importez le module contenant le service
  controllers: [BookingController],
})
export class BookingModule {}