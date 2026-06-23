import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation: every incoming DTO is checked against its class-validator
  // decorators. `whitelist` strips unknown properties; `forbidNonWhitelisted`
  // rejects them with 400; `transform` turns plain JSON into real DTO instances.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Allow the Next.js frontend (different origin) to call this API.
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
