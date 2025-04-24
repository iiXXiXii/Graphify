import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';

let authToken: string | null = null;

export async function authenticateWithGitHub() {
  const auth = createOAuthDeviceAuth({
    clientType: 'oauth-app',
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    onVerification: ({ verification_uri, user_code }) => {
      console.log('Open this URL in your browser:', verification_uri);
      console.log('Enter this code:', user_code);
    },
  });

  const { token } = await auth({ type: 'oauth' });
  authToken = token;
  console.log('Authentication successful!');
}

export function getAuthToken() {
  if (!authToken) {
    throw new Error('Not authenticated. Please log in first.');
  }
  return authToken;
}
