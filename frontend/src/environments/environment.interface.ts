/**
 * Interface defining the structure of environment configuration objects
 * Used for type-checking across different environment files
 */
export interface Environment {
  production: boolean;
  useMockData: boolean;
  apiUrl: string;
  graphqlUrl: string;
  deploymentPlatform: 'development' | 'production' | 'github-pages';
}
