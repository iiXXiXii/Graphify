import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { GithubStrategy } from './auth/github.strategy';
import { PrismaService } from './prisma.service';
import { PatternService } from './pattern.service';
import { ScheduleService } from './src/schedule.service';

@Module({
  imports: [
    PassportModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    }),
  ],
  providers: [GithubStrategy, PrismaService, PatternService, ScheduleService],
})
export class AppModule {}
