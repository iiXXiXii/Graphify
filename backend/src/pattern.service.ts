import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PatternService {
  constructor(private readonly prisma: PrismaService) {}

  async createPattern(data: any) {
    return this.prisma.pattern.create({ data });
  }

  async getPatternsByUser(userId: number) {
    return this.prisma.pattern.findMany({ where: { userId } });
  }
}
