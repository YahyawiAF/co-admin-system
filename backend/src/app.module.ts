import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'; // Importez MiddlewareConsumer et NestModule
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { EventsModule } from 'src/modules/webSocket/events.module';
import { JournalModule } from 'src/modules/journal/journal.modal';
import { MemberModule } from 'src/modules/member/member.module';
import { PriceModule } from './modules/price/price.module';
import { PrismaService } from 'database/prisma.service';
import { AbonnementModule } from './modules/abonnement/abonnement.module';
import { SecurityMiddleware } from 'common/guards/securityMiddlewera';
import { ExpensesModule } from './modules/expense/expense.module';
import { ProductsModule } from './modules/product/product.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(), // Charge les variables d'environnement
    EventEmitterModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule], // Utilise ConfigModule pour injecter ConfigService
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAILER_HOST'), // Exemple : 'smtp.gmail.com'
          port: configService.get<number>('MAILER_PORT'), // Exemple : 587
          secure: true, // true pour le port 465, false pour les autres ports
          auth: {
            user: configService.get<string>('MAILER_USER'), // Votre adresse e-mail
            pass: configService.get<string>('MAILER_PASSWORD'), // Votre mot de passe e-mail
          },
        },
        defaults: {
          from: `"No Reply" <${configService.get<string>('MAILER_FROM')}>`, // Adresse e-mail par défaut
        },
        template: {
          dir: process.cwd() + '/src/templates', // Chemin absolu vers le dossier templates
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService], // Injecte ConfigService dans useFactory
    }),
    UserModule,
    AuthModule,
    EventsModule,
    JournalModule,
    MemberModule,
    PriceModule,
    AbonnementModule,
    ExpensesModule,
    ProductsModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule implements NestModule {
  // Implémentez NestModule
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('auth'); // Appliquez le middleware à toutes les routes
  }
}
