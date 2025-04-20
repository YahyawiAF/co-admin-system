import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.GLOBAL_PREFIX) {
    app.setGlobalPrefix(process.env.GLOBAL_PREFIX);
  }

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = new DocumentBuilder()
    .setTitle('Greenarrow SMTP Stats Collector Backend')
    .setDescription('Connector Backend APIs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.enableCors({
    origin: 'http://localhost:3000', // Remplacez par l'URL de votre frontend
    methods: 'GET, POST, PATCH, DELETE, PUT', // Définissez les méthodes HTTP autorisées
    credentials: true, // Si vous utilisez des cookies ou des sessions
  });

  await app.listen(4000);
}
bootstrap();
