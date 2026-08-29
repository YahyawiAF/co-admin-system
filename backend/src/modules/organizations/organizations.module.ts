import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from 'database/prisma.service';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '20m' },
    }),
  ],
  controllers: [OrganizationsController],
  providers: [JwtAuthGuard, OrganizationsService, PrismaService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
