import simpleGit, { SimpleGit } from 'simple-git';
import { GraphifyConfig } from '../config/default';

/**
 * Git utilities for Graphify
 */
export class GitService {
  private git: SimpleGit;
  private config: GraphifyConfig;
  private initialized: boolean = false;

  /**
   * Creates a new GitService instance
   * @param config Graphify configuration
   */
  constructor(config: GraphifyConfig) {
    this.config = config;
    this.git = simpleGit(config.repoPath);
  }

  /**
   * Initializes the Git service, checking if we're in a repository
   * and ensuring the branch exists
   */
  async initialize(): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Current directory is not a Git repository. Please run this in a Git repository or initialize one first.');
      }

      // Get current branch
      const branchSummary = await this.git.branch();
      const currentBranch = branchSummary.current;
      console.log(`Current branch: ${currentBranch}`);

      // If remote branch is different from current, handle it
      if (this.config.remoteBranch !== currentBranch) {
        console.log(`Note: Current branch '${currentBranch}' differs from configured remote branch '${this.config.remoteBranch}'`);
        
        // Update config to use current branch
        this.config.remoteBranch = currentBranch;
        console.log(`Using current branch '${currentBranch}' for pushes`);
      }

      // Check remote
      try {
        const remotes = await this.git.getRemotes(true);
        if (remotes.length === 0) {
          console.warn('Warning: No remote repositories found. Commits will be local only.');
          // Disable pushing
          this.config.pushToRemote = false;
        } else {
          console.log(`Remote repositories: ${remotes.map(r => `${r.name} (${r.refs.fetch})`).join(', ')}`);
          
          // Store the first remote name
          this.config.remoteName = remotes[0].name;
        }
      } catch (error) {
        console.warn('Warning: Could not check remote repositories. Commits will be local only.');
        this.config.pushToRemote = false;
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Git service:', error);
      throw error;
    }
  }

  /**
   * Adds files to git staging area
   * @param files Files to add
   * @returns Promise resolving when files are added
   */
  async addFiles(files: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      await this.git.add(files);
    } catch (error) {
      console.error('Error adding files to Git:', error);
      throw error;
    }
  }

  /**
   * Creates a commit with the specified date
   * @param message Commit message
   * @param date Date for the commit
   * @returns Promise resolving when commit is created
   */
  async commit(message: string, date: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      await this.git.commit(message, { '--date': date });
    } catch (error) {
      console.error('Error creating commit:', error);
      throw error;
    }
  }

  /**
   * Pushes changes to the remote repository
   * @returns Promise resolving when changes are pushed
   */
  async push(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Skip push if disabled
    if (this.config.pushToRemote === false) {
      console.log('Skipping push to remote (disabled in config)');
      return;
    }
    
    try {
      const remoteName = this.config.remoteName || 'origin';
      await this.git.push(['-u', remoteName, this.config.remoteBranch]);
    } catch (error) {
      console.error(`Error pushing to remote. You may need to set up the remote repository or use --no-push to skip pushing.`, error);
      throw error;
    }
  }

  /**
   * Creates a commit and pushes changes
   * @param files Files to add
   * @param message Commit message
   * @param date Date for the commit
   * @returns Promise resolving when commit and push are complete
   */
  async commitAndPush(files: string[], message: string, date: string): Promise<void> {
    try {
      await this.addFiles(files);
      await this.commit(message, date);
      
      // Only push if enabled
      if (this.config.pushToRemote !== false) {
        await this.push();
      }
    } catch (error) {
      console.error('Error during git operations:', error);
      throw error;
    }
  }
} 