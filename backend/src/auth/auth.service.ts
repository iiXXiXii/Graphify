import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async createToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token);

      if (!payload || !payload.sub) {
        return false;
      }

      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      return !!user;
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      return false;
    }
  }

  async revokeToken(userId: string): Promise<void> {
    // In a real implementation, you might add the token to a blacklist
    // For now, we'll just log the revocation
    this.logger.log(`Token revoked for user ${userId}`);
  }

  async validateUser(username: string, password: string): Promise<any> {
    // GitHub OAuth doesn't use password validation
    // This is included for future authentication methods
    throw new UnauthorizedException('This authentication method is not supported');
  }
}
