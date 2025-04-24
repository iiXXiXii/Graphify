import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly prisma: PrismaService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/github/callback',
      scope: ['user', 'repo'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ): Promise<any> {
    try {
      // Extract relevant information from GitHub profile
      const { id, username, displayName, emails, photos } = profile;

      const email = emails && emails.length > 0 ? emails[0].value : null;
      const avatarUrl = photos && photos.length > 0 ? photos[0].value : null;

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { githubId: id.toString() },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            username: username,
            email: email,
            githubId: id.toString(),
            displayName: displayName || username,
            avatarUrl: avatarUrl,
          },
        });
      } else {
        // Update user information in case it changed
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            username: username,
            email: email,
            displayName: displayName || username,
            avatarUrl: avatarUrl,
            lastLogin: new Date(),
          },
        });
      }

      // Store tokens in auth session
      const authSession = await this.prisma.authSession.create({
        data: {
          userId: user.id,
          accessToken,
          refreshToken: refreshToken || '',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
          provider: 'github',
        },
      });

      // Return the authenticated user with tokens
      return {
        user,
        accessToken,
        refreshToken,
        sessionId: authSession.id
      };
    } catch (error) {
      done(error, false);
    }
  }
}
