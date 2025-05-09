import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';

/**
 * Home page component for Graphify
 *
 * This component displays the main landing page with a sample contribution graph visualization,
 * feature overview, and information about the application.
 *
 * The component adapts its behavior based on the current deployment platform
 * (development, production, or GitHub Pages).
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule], // CommonModule required for *ngFor
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  title = 'Graphify';
  deploymentPlatform = environment.deploymentPlatform || 'development';
  isGitHubPages = environment.deploymentPlatform === 'github-pages';

  /**
   * Returns a random color class for the contribution graph visualization
   * Simulates different contribution levels using Tailwind's color classes
   *
   * @returns A Tailwind CSS background color class representing a contribution intensity
   */
  getRandomColorClass(): string {
    // Generate weighted random levels for more realistic distribution
    const rand = Math.random();

    if (rand > 0.85) {
      return 'bg-primary'; // High intensity - primary color
    } else if (rand > 0.70) {
      return 'bg-blue-300'; // Medium-high intensity
    } else if (rand > 0.55) {
      return 'bg-blue-200'; // Medium intensity
    } else if (rand > 0.35) {
      return 'bg-blue-100'; // Low intensity
    } else {
      return 'bg-gray-100'; // Very low/no activity
    }
  }
}
