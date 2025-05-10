// src/proxy/proxy.module.ts
import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';

@Module({
  providers: [ProxyService],
  exports: [ProxyService], // Important pour l'utiliser ailleurs
})
export class ProxyModule {}