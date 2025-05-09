import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  private mockPatterns = [
    { id: '1', name: 'Daily Commit', description: 'Commit code every day', type: 'git' },
    { id: '2', name: 'Weekly Review', description: 'Review code every week', type: 'review' },
    { id: '3', name: 'Monthly Planning', description: 'Plan tasks for the month', type: 'planning' }
  ];

  private mockSchedules = [
    { id: '1', patternId: '1', startDate: '2025-05-01', endDate: '2025-05-31', frequency: 'daily' },
    { id: '2', patternId: '2', startDate: '2025-05-01', endDate: '2025-12-31', frequency: 'weekly' }
  ];

  private mockUser = {
    id: 'mock-user-id',
    username: 'demo-user',
    email: 'demo@example.com',
    avatarUrl: 'https://github.com/identicons/iiXXiXii.png'
  };

  constructor() {
    // Initialize mock data from localStorage if available
    const storedPatterns = localStorage.getItem('mock_patterns');
    const storedSchedules = localStorage.getItem('mock_schedules');

    if (storedPatterns) {
      this.mockPatterns = JSON.parse(storedPatterns);
    }

    if (storedSchedules) {
      this.mockSchedules = JSON.parse(storedSchedules);
    }
  }

  // Pattern API methods
  getPatterns(): Observable<any[]> {
    return of(this.mockPatterns);
  }

  createPattern(pattern: any): Observable<any> {
    const newPattern = {
      ...pattern,
      id: Date.now().toString()
    };
    this.mockPatterns.push(newPattern);
    localStorage.setItem('mock_patterns', JSON.stringify(this.mockPatterns));
    return of(newPattern);
  }

  // Schedule API methods
  getSchedules(): Observable<any[]> {
    return of(this.mockSchedules);
  }

  createSchedule(schedule: any): Observable<any> {
    const newSchedule = {
      ...schedule,
      id: Date.now().toString()
    };
    this.mockSchedules.push(newSchedule);
    localStorage.setItem('mock_schedules', JSON.stringify(this.mockSchedules));
    return of(newSchedule);
  }

  // Authentication methods
  login(code: string): Observable<any> {
    // Simulate successful login
    return of({
      user: this.mockUser,
      token: 'mock-token-' + Date.now()
    });
  }

  getCurrentUser(): Observable<any> {
    return of(this.mockUser);
  }
}
