import { Environment } from './environment.interface';

/**
 * GitHub Pages specific environment configuration for Graphify
 *
 * This configuration is used when deploying to GitHub Pages.
 * It enables mock data mode since we don't have backend services on GitHub Pages,
 * and sets the appropriate URLs based on the GitHub username.
 */
export const environment: Environment = {
  production: true,
  // Use mock data since we don't have a backend on GitHub Pages
  useMockData: true,
  // GitHub Pages URLs based on your username
  apiUrl: 'https://iiXXiXii.github.io/Graphify',
  graphqlUrl: 'https://iiXXiXii.github.io/Graphify',
  // Flag to indicate we're running on GitHub Pages
  deploymentPlatform: 'github-pages'
};
