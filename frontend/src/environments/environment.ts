import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  useMockData: false, // Set to true to use mock data without a backend
  apiUrl: 'http://localhost:3000/api/v1', // Local development API URL
  graphqlUrl: 'http://localhost:3000/graphql', // Local GraphQL endpoint
  deploymentPlatform: 'development' // Indicate this is the development environment
};
