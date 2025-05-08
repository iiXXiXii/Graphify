import { AuthService } from './auth.service';

// Create a singleton instance of the AuthService
const authService = new AuthService();

// Export the instance methods for backward compatibility
export const authenticateWithGitHub = () => authService.authenticateWithGitHub();
export const loadAuthData = () => authService.loadAuthData();
export const saveAuthData = (authData: any) => authService.saveAuthData(authData);
export const getAuthToken = () => authService.getAuthToken();
export const getStorageLocation = () => authService.getStorageLocation();
export const logout = () => authService.logout();
export const isAuthenticated = () => authService.isAuthenticated();
export const getUserInfo = () => authService.getUserInfo();

// Also export the AuthService class itself for new code
export { AuthService };
