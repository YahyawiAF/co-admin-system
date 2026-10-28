import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from 'database/prisma.service';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import { RequestContextMiddleware } from 'common/request-context.middleware';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAuditInterceptor } from './staff-audit.interceptor';
import { StaffAuditService } from './staff-audit.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

/**
 * Staff (employee) accounts: per-module permissions, hide-instead-of-delete,
 * and the action log the admin reviews.
 */
@Global()
@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })],
  controllers: [StaffController],
  providers: [
    PrismaService,
    JwtAuthGuard,
    StaffAccessGuard,
    StaffAuditService,
    StaffService,
    { provide: APP_GUARD, useExisting: StaffAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: StaffAuditInterceptor },
  ],
  exports: [StaffAccessGuard, StaffService],
})
export class StaffModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
