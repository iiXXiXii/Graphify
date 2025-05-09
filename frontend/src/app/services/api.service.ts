import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MockDataService } from './mock-data.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private useMockData = environment.useMockData || !this.apiUrl;

  constructor(
    private http: HttpClient,
    private mockService: MockDataService
  ) {}

  // Pattern API methods
  getPatterns(): Observable<any[]> {
    if (this.useMockData) {
      return this.mockService.getPatterns();
    }
    return this.http.get<any[]>(`${this.apiUrl}/patterns`);
  }

  createPattern(pattern: any): Observable<any> {
    if (this.useMockData) {
      return this.mockService.createPattern(pattern);
    }
    return this.http.post<any>(`${this.apiUrl}/patterns`, pattern);
  }

  // Schedule API methods
  getSchedules(): Observable<any[]> {
    if (this.useMockData) {
      return this.mockService.getSchedules();
    }
    return this.http.get<any[]>(`${this.apiUrl}/schedules`);
  }

  createSchedule(schedule: any): Observable<any> {
    if (this.useMockData) {
      return this.mockService.createSchedule(schedule);
    }
    return this.http.post<any>(`${this.apiUrl}/schedules`, schedule);
  }

  // Authentication methods
  login(code: string): Observable<any> {
    if (this.useMockData) {
      return this.mockService.login(code);
    }
    return this.http.post<any>(`${this.apiUrl}/auth/github/callback`, { code });
  }

  getCurrentUser(): Observable<any> {
    if (this.useMockData) {
      return this.mockService.getCurrentUser();
    }
    return this.http.get<any>(`${this.apiUrl}/auth/me`);
  }
}
