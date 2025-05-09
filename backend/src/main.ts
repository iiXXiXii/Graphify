import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // NestJS already provides logging
    })
  );
  const configService = app.get(ConfigService);

  // Get configuration values
  const port = configService.get('PORT', 3000);
  const corsOrigin = configService.get('CORS_ORIGIN', '*'); // Allow any origin by default for the hosted version
  const nodeEnv = configService.get('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  // Security setup - register as Fastify plugin
  await app.register(import('@fastify/helmet'));

  // Enable compression to reduce bandwidth - register as Fastify plugin
  await app.register(import('@fastify/compress'));

  // Parse cookies - register as Fastify plugin
  await app.register(fastifyCookie);

  // CORS setup - more permissive for the publicly hosted version
  const corsSettings = {
    origin: corsOrigin === '*' ?
      true : // Allow any origin if set to '*'
      corsOrigin.split(','), // Otherwise use specific origins
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept',
  };
  await app.enableCors(corsSettings);

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
    await app.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '15 minutes',
      errorResponseBuilder: (request, context) => {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Too many requests from this IP, please try again later'
        };
      }
    });
  }

  // Start the server
  await app.listen(port, '0.0.0.0'); // Listen on all network interfaces to enable public access
  logger.log(`Application is running in ${nodeEnv} mode on: ${await app.getUrl()}`);

  if (!isProduction) {
    logger.log(`Swagger documentation available at: ${await app.getUrl()}/api`);
  }
}

bootstrap();
