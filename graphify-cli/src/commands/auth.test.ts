import { authenticateWithGitHub, getAuthToken } from './auth';

jest.mock('@octokit/auth', () => ({
  createOAuthDeviceAuth: jest.fn(() => ({
    onVerification: jest.fn(),
    auth: jest.fn(() => ({ token: 'mock-token' })),
  })),
}));

describe('GitHub Authentication', () => {
  it('should authenticate and store the token', async () => {
    await authenticateWithGitHub();
    const token = getAuthToken();
    expect(token).toBe('mock-token');
  });

  it('should throw an error if not authenticated', () => {
    expect(() => getAuthToken()).toThrow('Not authenticated. Please log in first.');
  });
});
