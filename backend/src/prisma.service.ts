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

  // Helper method to clean the database during testing
  async cleanDatabase() {
    if (this.configService.get('NODE_ENV') === 'test') {
      this.logger.log('Cleaning test database...');

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

      this.logger.log('Test database cleaned');
    } else {
      this.logger.warn('Database clean attempted outside of test environment - operation aborted');
    }
  }
}
