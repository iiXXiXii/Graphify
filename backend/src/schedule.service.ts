import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(data: any) {
    return this.prisma.schedule.create({ data });
  }

  async getSchedulesByPattern(patternId: number) {
    return this.prisma.schedule.findMany({ where: { patternId } });
  }
}
