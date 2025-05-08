import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Pattern API methods
  getPatterns(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/patterns`);
  }

  createPattern(pattern: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/patterns`, pattern);
  }

  // Schedule API methods
  getSchedules(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/schedules`);
  }

  createSchedule(schedule: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedules`, schedule);
  }

  // Authentication methods
  login(code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/github/callback`, { code });
  }

  getCurrentUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/auth/me`);
  }
}
