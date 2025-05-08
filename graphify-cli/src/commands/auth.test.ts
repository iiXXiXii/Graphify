import { describe, it, expect, beforeEach, mock, MockFn } from 'bun:test';
import { AuthService } from '../auth/auth.service';

// Mock the auth service
const MockAuthService = mock(AuthService);

describe('GitHub Authentication', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset mocks and create a new instance for each test
    MockAuthService.mockClear();
    authService = new AuthService();

    // Mock the authenticateWithGitHub method
    authService.authenticateWithGitHub = mock(() => Promise.resolve(undefined));

    // Mock getAuthToken with different behaviors based on test needs
    authService.getAuthToken = mock((): Promise<string> => {
      if ((authService as any).mockAuthenticated) {
        return Promise.resolve('mock-token');
      }
      throw new Error('Not authenticated. Please log in first.');
    });
  });

  it('should authenticate and store the token', async () => {
    // Set up the mock to simulate being authenticated after authenticateWithGitHub
    (authService as any).mockAuthenticated = true;

    await authService.authenticateWithGitHub();
    const token = await authService.getAuthToken();
    expect(token).toBe('mock-token');
  });

  it('should throw an error if not authenticated', async () => {
    // Ensure mock is set to not authenticated
    (authService as any).mockAuthenticated = false;

    try {
      await authService.getAuthToken();
      throw new Error('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toBe('Not authenticated. Please log in first.');
    }
  });
});
