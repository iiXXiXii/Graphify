import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PrismaService } from './prisma.service';
import { PatternService } from './pattern.service';
import { ScheduleService } from './schedule.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:4200',
        credentials: true,
      },
      playground: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    PatternService,
    ScheduleService,
  ],
  exports: [
    PrismaService,
  ],
})
export class AppModule {}
