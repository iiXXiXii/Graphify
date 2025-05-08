import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Get configuration values
  const port = configService.get('PORT', 3000);
  const corsOrigin = configService.get('CORS_ORIGIN', '*'); // Allow any origin by default for the hosted version
  const nodeEnv = configService.get('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  // Security setup
  app.use(helmet());

  // Enable compression to reduce bandwidth
  app.use(compression());

  // Parse cookies
  app.use(cookieParser());

  // CORS setup - more permissive for the publicly hosted version
  const corsSettings = {
    origin: corsOrigin === '*' ?
      (req, callback) => callback(null, true) : // Allow any origin if set to '*'
      corsOrigin.split(','), // Otherwise use specific origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept',
  };
  app.enableCors(corsSettings);

  // API versioning prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipes
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Set up rate limiting if in production
  if (isProduction) {
    const rateLimit = require('express-rate-limit');
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
      }),
    );
  }

  // Start the server
  await app.listen(port, '0.0.0.0'); // Listen on all network interfaces to enable public access
  logger.log(`Application is running in ${nodeEnv} mode on: ${await app.getUrl()}`);

  if (!isProduction) {
    logger.log(`Swagger documentation available at: ${await app.getUrl()}/api`);
  }
}

bootstrap();
