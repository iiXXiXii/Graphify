import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      log: configService.get('NODE_ENV') === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  // Helper method to clean the database during testing - with enhanced safety checks
  async cleanDatabase(confirmationCode?: string) {
    const nodeEnv = this.configService.get('NODE_ENV');
    const databaseUrl = this.configService.get('DATABASE_URL') || '';

    // Triple check to ensure we're in a test environment:
    // 1. NODE_ENV must be 'test'
    // 2. DATABASE_URL must include 'test' or end with '_test'
    // 3. Confirmation code must match "CONFIRM_CLEAN_TEST_DB" if provided

    const isTestDatabase = databaseUrl.includes('test') || databaseUrl.endsWith('_test');

    if (nodeEnv !== 'test') {
      this.logger.error('Database clean rejected: Not in test environment');
      throw new Error('Database cleaning is only allowed in test environments');
    }

    if (!isTestDatabase) {
      this.logger.error('Database clean rejected: URL does not indicate test database');
      throw new Error('Database URL does not appear to be a test database');
    }

    if (confirmationCode && confirmationCode !== 'CONFIRM_CLEAN_TEST_DB') {
      this.logger.error('Database clean rejected: Invalid confirmation code');
      throw new Error('Invalid confirmation code for test database cleaning');
    }

    this.logger.log('Cleaning test database...');

    try {
      // Get all table names
      const tables = await this.$queryRaw`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      `;

      // Disable foreign key checks and truncate all tables
      await this.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET session_replication_role = "replica";');

        for (const table of tables as any[]) {
          await tx.$executeRawUnsafe(`TRUNCATE TABLE "public"."${table.tablename}" CASCADE;`);
        }

        await tx.$executeRawUnsafe('SET session_replication_role = "origin";');
      });

      this.logger.log('Test database cleaned successfully');
    } catch (error) {
      this.logger.error(`Error cleaning test database: ${error.message}`);
      throw new Error(`Failed to clean test database: ${error.message}`);
    }
  }
}
