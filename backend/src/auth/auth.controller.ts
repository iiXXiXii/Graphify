import { Controller, Get, Req, Res, UseGuards, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {
    // GitHub authentication is handled by passport
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(@Req() req, @Res() res: Response) {
    const { user, accessToken } = req.user;

    // Generate JWT token
    const token = await this.authService.createToken(user);

    // Redirect to frontend with token
    const frontendUrl = this.configService.get('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }

  @Post('token/validate')
  async validateToken(@Body() body: { token: string }) {
    if (!body.token) {
      throw new UnauthorizedException('Token is required');
    }

    const isValid = await this.authService.validateToken(body.token);

    if (!isValid) {
      throw new UnauthorizedException('Invalid token');
    }

    return { valid: true };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req) {
    await this.authService.revokeToken(req.user.id);
    return { success: true };
  }
}
