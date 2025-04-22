import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ErrorHandler, ErrorLevel } from '../utils/errorHandler';
import { ValidationService } from './validationService';

/**
 * Interface for configuration options for GitHub service
 */
export interface GitHubConfig {
  token: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * GitHub repository details interface 
 */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  default_branch: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
}

/**
 * GitHub issue details interface
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  body: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  labels: {
    id: number;
    name: string;
    color: string;
  }[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
}

/**
 * Service for interacting with GitHub API
 */
export class GitHubService {
  private static readonly SOURCE = 'GitHubService';
  private client: AxiosInstance;
  private token: string;

  /**
   * Create a new GitHub service
   * @param config Configuration options
   */
  constructor(config: GitHubConfig) {
    this.validateConfig(config);
    this.token = config.token;

    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.github.com',
      timeout: config.timeout || 10000,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate GitHub service configuration
   * @param config Configuration to validate
   */
  private validateConfig(config: GitHubConfig): void {
    if (!ValidationService.hasRequiredProperties(config, ['token'], 'GitHub configuration')) {
      throw new Error('Invalid GitHub configuration: token is required');
    }

    if (!ValidationService.isGitHubToken(config.token)) {
      throw new Error('Invalid GitHub token format');
    }
    
    if (config.baseUrl && !ValidationService.isUrl(config.baseUrl)) {
      throw new Error('Invalid GitHub API base URL');
    }
    
    if (config.timeout !== undefined && 
        !ValidationService.isInRange(config.timeout, 1000, 60000, 'timeout')) {
      throw new Error('Invalid timeout: must be between 1000 and 60000 ms');
    }
  }

  /**
   * Handle GitHub API errors
   * @param error Error from API call
   */
  private handleApiError(error: any): void {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const data = error.response.data;
      const method = error.config.method?.toUpperCase() || 'UNKNOWN';
      const url = error.config.url || 'unknown URL';
      
      let message = `GitHub API error (${status}) on ${method} ${url}`;
      
      if (data && data.message) {
        message += `: ${data.message}`;
      }

      ErrorHandler.handle(
        message,
        this.SOURCE,
        status >= 500 ? ErrorLevel.ERROR : ErrorLevel.WARNING
      );
    } else if (error.request) {
      // The request was made but no response was received
      ErrorHandler.handle(
        `GitHub API request failed (no response received): ${error.message}`,
        this.SOURCE,
        ErrorLevel.ERROR
      );
    } else {
      // Something happened in setting up the request that triggered an Error
      ErrorHandler.handle(
        `GitHub API request setup failed: ${error.message}`,
        this.SOURCE,
        ErrorLevel.ERROR
      );
    }
  }

  /**
   * Get authenticated user information
   * @returns User information
   */
  public async getCurrentUser(): Promise<any> {
    try {
      const response = await this.client.get('/user');
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }

  /**
   * Get repositories for the authenticated user
   * @param perPage Number of results per page
   * @param page Page number
   * @returns List of repositories
   */
  public async getRepositories(perPage = 30, page = 1): Promise<GitHubRepo[]> {
    try {
      const response = await this.client.get('/user/repos', {
        params: {
          per_page: perPage,
          page: page,
          sort: 'updated',
          direction: 'desc'
        }
      });
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }

  /**
   * Get repository by owner and name
   * @param owner Repository owner username
   * @param repo Repository name
   * @returns Repository details
   */
  public async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    if (!ValidationService.isNotEmpty(owner, 'owner') || 
        !ValidationService.isNotEmpty(repo, 'repository name')) {
      throw new Error('Owner and repository name are required');
    }

    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }

  /**
   * Get issues for a repository
   * @param owner Repository owner username
   * @param repo Repository name
   * @param state Filter issues by state
   * @param perPage Number of results per page
   * @param page Page number
   * @returns List of issues
   */
  public async getIssues(
    owner: string, 
    repo: string, 
    state: 'open' | 'closed' | 'all' = 'open',
    perPage = 30,
    page = 1
  ): Promise<GitHubIssue[]> {
    if (!ValidationService.isNotEmpty(owner, 'owner') || 
        !ValidationService.isNotEmpty(repo, 'repository name')) {
      throw new Error('Owner and repository name are required');
    }

    if (!ValidationService.isOneOf(state, ['open', 'closed', 'all'], 'issue state')) {
      throw new Error('Issue state must be one of: open, closed, all');
    }

    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/issues`, {
        params: {
          state,
          per_page: perPage,
          page: page
        }
      });
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }

  /**
   * Create a new issue in a repository
   * @param owner Repository owner username
   * @param repo Repository name
   * @param title Issue title
   * @param body Issue body
   * @param labels Labels to apply to the issue
   * @returns Created issue
   */
  public async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[] = []
  ): Promise<GitHubIssue> {
    if (!ValidationService.isNotEmpty(owner, 'owner') || 
        !ValidationService.isNotEmpty(repo, 'repository name')) {
      throw new Error('Owner and repository name are required');
    }

    if (!ValidationService.isNotEmpty(title, 'issue title')) {
      throw new Error('Issue title is required');
    }

    try {
      const response = await this.client.post(`/repos/${owner}/${repo}/issues`, {
        title,
        body,
        labels
      });
      
      ErrorHandler.handle(
        `Created issue #${response.data.number}: ${title}`,
        this.SOURCE,
        ErrorLevel.INFO
      );
      
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }
  
  /**
   * Get a specific issue from a repository
   * @param owner Repository owner username
   * @param repo Repository name
   * @param issueNumber Issue number
   * @returns Issue details
   */
  public async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue> {
    if (!ValidationService.isNotEmpty(owner, 'owner') || 
        !ValidationService.isNotEmpty(repo, 'repository name')) {
      throw new Error('Owner and repository name are required');
    }

    if (!ValidationService.isInRange(issueNumber, 1, Number.MAX_SAFE_INTEGER, 'issue number')) {
      throw new Error('Invalid issue number');
    }

    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }

  /**
   * Update an existing issue
   * @param owner Repository owner username
   * @param repo Repository name
   * @param issueNumber Issue number
   * @param updates Updates to apply to the issue
   * @returns Updated issue
   */
  public async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
    }
  ): Promise<GitHubIssue> {
    if (!ValidationService.isNotEmpty(owner, 'owner') || 
        !ValidationService.isNotEmpty(repo, 'repository name')) {
      throw new Error('Owner and repository name are required');
    }

    if (!ValidationService.isInRange(issueNumber, 1, Number.MAX_SAFE_INTEGER, 'issue number')) {
      throw new Error('Invalid issue number');
    }

    if (updates.state && !ValidationService.isOneOf(updates.state, ['open', 'closed'], 'issue state')) {
      throw new Error('Issue state must be one of: open, closed');
    }

    try {
      const response = await this.client.patch(
        `/repos/${owner}/${repo}/issues/${issueNumber}`,
        updates
      );
      
      ErrorHandler.handle(
        `Updated issue #${issueNumber}`,
        this.SOURCE,
        ErrorLevel.INFO
      );
      
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }

  /**
   * Create a comment on an issue
   * @param owner Repository owner username
   * @param repo Repository name
   * @param issueNumber Issue number
   * @param body Comment text
   * @returns Created comment
   */
  public async createComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<any> {
    if (!ValidationService.isNotEmpty(owner, 'owner') || 
        !ValidationService.isNotEmpty(repo, 'repository name')) {
      throw new Error('Owner and repository name are required');
    }

    if (!ValidationService.isInRange(issueNumber, 1, Number.MAX_SAFE_INTEGER, 'issue number')) {
      throw new Error('Invalid issue number');
    }

    if (!ValidationService.isNotEmpty(body, 'comment body')) {
      throw new Error('Comment body is required');
    }

    try {
      const response = await this.client.post(
        `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        { body }
      );
      
      ErrorHandler.handle(
        `Added comment to issue #${issueNumber}`,
        this.SOURCE,
        ErrorLevel.INFO
      );
      
      return response.data;
    } catch (error) {
      // Error is already handled by interceptor
      throw error;
    }
  }
} 