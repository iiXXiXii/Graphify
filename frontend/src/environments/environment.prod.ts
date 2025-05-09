import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  // For GitHub Pages without a backend, use mock data
  useMockData: true,  // Flag to use mock data instead of API calls
  apiUrl: 'https://iiXXiXii.github.io/Graphify', // Placeholder URL
  graphqlUrl: 'https://iiXXiXii.github.io/Graphify', // Placeholder URL
  deploymentPlatform: 'production' // Indicate this is the production environment
};
