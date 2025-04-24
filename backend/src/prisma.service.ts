import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Helper method to clean the database during testing
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'test') {
      const models = Reflect.ownKeys(this).filter((key) => {
        return typeof key === 'string' &&
               !key.startsWith('_') &&
               !['$connect', '$disconnect', '$on', '$transaction', '$use'].includes(key as string);
      });

      return Promise.all(
        models.map((modelKey) => {
          if (typeof this[modelKey as string] === 'object' && this[modelKey as string].deleteMany) {
            return this[modelKey as string].deleteMany();
          }
          return Promise.resolve();
        }),
      );
    }
  }
}
