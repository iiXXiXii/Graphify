import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Get configuration values
  const port = configService.get('PORT', 3000);
  const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:4200');
  const nodeEnv = configService.get('NODE_ENV', 'development');

  // Security setup
  app.use(helmet());

  // CORS setup
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Validation pipes
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Start the server
  await app.listen(port);
  logger.log(`Application is running in ${nodeEnv} mode on: ${await app.getUrl()}`);
}

bootstrap();
