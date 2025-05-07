import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GitHubStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      clientID: configService.get('GITHUB_CLIENT_ID'),
      clientSecret: configService.get('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get('GITHUB_CALLBACK_URL'),
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
      this.logger.debug(`Validating GitHub profile: ${profile.username}`);

      // Extract relevant information from GitHub profile
      const { id, username, displayName, emails, photos } = profile;

      const email = emails && emails.length > 0 ? emails[0].value : null;
      const avatarUrl = photos && photos.length > 0 ? photos[0].value : null;

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { githubId: id.toString() },
      });

      if (!user) {
        this.logger.log(`Creating new user for GitHub ID: ${id}`);
        user = await this.prisma.user.create({
          data: {
            username: username,
            email: email,
            githubId: id.toString(),
            githubLogin: username,
            name: displayName || username,
            avatarUrl: avatarUrl,
          },
        });
      } else {
        // Update user information in case it changed
        this.logger.debug(`Updating existing user: ${user.username}`);
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            username: username,
            email: email,
            name: displayName || username,
            avatarUrl: avatarUrl,
            updatedAt: new Date(),
          },
        });
      }

      // Calculate token expiration (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Store tokens in auth session
      const authSession = await this.prisma.authSession.create({
        data: {
          userId: user.id,
          accessToken,
          refreshToken: refreshToken || '',
          expiresAt,
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
      this.logger.error(`Error validating GitHub profile: ${error.message}`, error.stack);
      done(error, false);
    }
  }
}
