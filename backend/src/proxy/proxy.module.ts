// src/proxy/proxy.module.ts
import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { PrismaService } from 'database/prisma.service';
import { PrismaModule } from 'database/prisma.module';

@Module({
  imports: [PrismaModule], // Importez le module
  providers: [ProxyService],
  exports: [ProxyService], // Exportez seulement ProxyService
})
export class ProxyModule {}