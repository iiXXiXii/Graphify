import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface JwtPayload {
  sub: string;
  username: string;
  jti?: string;  // JWT ID for revocation tracking
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async createToken(user: User): Promise<string> {
    // Generate a unique JWT ID to enable revocation
    const jti = uuidv4();

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      jti: jti
    };

    // Store token metadata in database for future revocation
    await this.prisma.authToken.create({
      data: {
        jti,
        userId: user.id,
        revoked: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      }
    });

    return this.jwtService.sign(payload);
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token) as JwtPayload;

      if (!payload || !payload.sub) {
        return false;
      }

      // If token has a JWT ID, check if it has been revoked
      if (payload.jti) {
        const tokenRecord = await this.prisma.authToken.findUnique({
          where: { jti: payload.jti }
        });

        // Token is invalid if it's been revoked or not found
        if (!tokenRecord || tokenRecord.revoked) {
          this.logger.warn(`Attempt to use revoked token with jti: ${payload.jti}`);
          return false;
        }
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

  async revokeToken(userId: string, jti?: string): Promise<void> {
    if (jti) {
      // Revoke specific token if JTI is provided
      await this.prisma.authToken.updateMany({
        where: {
          jti,
          userId
        },
        data: { revoked: true }
      });

      this.logger.log(`Token with jti ${jti} revoked for user ${userId}`);
    } else {
      // Revoke all tokens for this user if no specific token is specified
      await this.prisma.authToken.updateMany({
        where: { userId },
        data: { revoked: true }
      });

      this.logger.log(`All tokens revoked for user ${userId}`);
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    // Delete token records that have expired to keep the database clean
    const deleted = await this.prisma.authToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    this.logger.log(`Cleaned up ${deleted.count} expired tokens`);
  }

  async validateUser(username: string, password: string): Promise<any> {
    // GitHub OAuth doesn't use password validation
    // This is included for future authentication methods
    throw new UnauthorizedException('This authentication method is not supported');
  }
}
