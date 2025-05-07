import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Pattern } from '@prisma/client';

export interface PatternInput {
  name: string;
  description?: string;
  grid: number[][];
  rows: number;
  columns: number;
  isPublic?: boolean;
  tags?: string[];
}

@Injectable()
export class PatternService {
  private readonly logger = new Logger(PatternService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPattern(userId: string, input: PatternInput): Promise<Pattern> {
    try {
      const { name, description, grid, rows, columns, isPublic = false, tags = [] } = input;

      // Validate pattern dimensions
      if (grid.length !== rows || grid.some(row => row.length !== columns)) {
        throw new BadRequestException('Pattern grid dimensions do not match specified rows and columns');
      }

      // Create pattern
      return this.prisma.pattern.create({
        data: {
          name,
          description,
          grid: JSON.stringify(grid), // Storing grid as JSON string in DB
          rows,
          columns,
          isPublic,
          tags,
          userId
        }
      });
    } catch (error) {
      this.logger.error(`Error creating pattern: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePattern(id: string, userId: string, input: PatternInput): Promise<Pattern> {
    try {
      // Verify pattern exists and belongs to user
      const pattern = await this.prisma.pattern.findFirst({
        where: {
          id,
          userId
        }
      });

      if (!pattern) {
        throw new NotFoundException('Pattern not found or access denied');
      }

      const { name, description, grid, rows, columns, isPublic, tags } = input;

      // Update pattern
      return this.prisma.pattern.update({
        where: { id },
        data: {
          name,
          description,
          grid: JSON.stringify(grid),
          rows,
          columns,
          isPublic,
          tags,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      this.logger.error(`Error updating pattern: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePattern(id: string, userId: string): Promise<boolean> {
    try {
      // Verify pattern exists and belongs to user
      const pattern = await this.prisma.pattern.findFirst({
        where: {
          id,
          userId
        }
      });

      if (!pattern) {
        throw new NotFoundException('Pattern not found or access denied');
      }

      // Check if pattern is used in any schedules
      const usedInSchedules = await this.prisma.schedule.findFirst({
        where: {
          patternId: id
        }
      });

      if (usedInSchedules) {
        throw new BadRequestException('Cannot delete pattern that is used in schedules');
      }

      // Delete pattern
      await this.prisma.pattern.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      this.logger.error(`Error deleting pattern: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPatternById(id: string): Promise<Pattern | null> {
    try {
      const pattern = await this.prisma.pattern.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      if (!pattern) {
        return null;
      }

      // Parse grid from JSON string for API response
      (pattern as any).parsedGrid = JSON.parse(pattern.grid as string);

      return pattern;
    } catch (error) {
      this.logger.error(`Error getting pattern: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPatternsByUser(userId: string): Promise<Pattern[]> {
    try {
      const patterns = await this.prisma.pattern.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Parse grids from JSON string for API response
      patterns.forEach(pattern => {
        (pattern as any).parsedGrid = JSON.parse(pattern.grid as string);
      });

      return patterns;
    } catch (error) {
      this.logger.error(`Error getting patterns by user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPublicPatterns(): Promise<Pattern[]> {
    try {
      const patterns = await this.prisma.pattern.findMany({
        where: { isPublic: true },
        orderBy: { updatedAt: 'desc' },
        take: 100, // Limit to 100 most recent patterns
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Parse grids from JSON string for API response
      patterns.forEach(pattern => {
        (pattern as any).parsedGrid = JSON.parse(pattern.grid as string);
      });

      return patterns;
    } catch (error) {
      this.logger.error(`Error getting public patterns: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPatternsByTags(tags: string[]): Promise<Pattern[]> {
    try {
      if (!tags || tags.length === 0) {
        return [];
      }

      const patterns = await this.prisma.pattern.findMany({
        where: {
          isPublic: true,
          tags: {
            hasSome: tags
          }
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Parse grids from JSON string for API response
      patterns.forEach(pattern => {
        (pattern as any).parsedGrid = JSON.parse(pattern.grid as string);
      });

      return patterns;
    } catch (error) {
      this.logger.error(`Error getting patterns by tags: ${error.message}`, error.stack);
      throw error;
    }
  }

  async searchPatterns(query: string, userId?: string): Promise<Pattern[]> {
    try {
      const patterns = await this.prisma.pattern.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: [query] } }
          ],
          AND: {
            OR: [
              { isPublic: true },
              { userId }
            ]
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 50, // Limit results
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Parse grids from JSON string for API response
      patterns.forEach(pattern => {
        (pattern as any).parsedGrid = JSON.parse(pattern.grid as string);
      });

      return patterns;
    } catch (error) {
      this.logger.error(`Error searching patterns: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Gallery management - featured patterns
  async getFeaturedPatterns(): Promise<Pattern[]> {
    try {
      const patterns = await this.prisma.pattern.findMany({
        where: { isPublic: true },
        orderBy: [
          // Order by some popularity metric like usage count
          { updatedAt: 'desc' }
        ],
        take: 12, // Just get a few for the gallery
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Parse grids from JSON string for API response
      patterns.forEach(pattern => {
        (pattern as any).parsedGrid = JSON.parse(pattern.grid as string);
      });

      return patterns;
    } catch (error) {
      this.logger.error(`Error getting featured patterns: ${error.message}`, error.stack);
      throw error;
    }
  }
}

