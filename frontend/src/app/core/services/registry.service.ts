import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { retry } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  EntryType,
  Notification,
  PendingEntry,
  RegistryEntry,
  SearchParams,
  SearchResult,
  AppStats,
} from '../../shared/types/index';

export type { AppStats as RegistryStats } from '../../shared/types/index';

@Injectable({ providedIn: 'root' })
export class RegistryService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ── Search & Browse ──────────────────────────────────────────────────────

  searchEntries(params: SearchParams): Observable<SearchResult<RegistryEntry>> {
    let httpParams = new HttpParams();
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.type) httpParams = httpParams.set('type', params.type);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.client) httpParams = httpParams.set('client', params.client);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params.size != null) httpParams = httpParams.set('size', String(params.size));

    return this.http
      .get<SearchResult<RegistryEntry>>(`${this.base}/entries`, { params: httpParams })
      .pipe(retry({ count: 1, delay: 1000, resetOnSuccess: true }));
  }

  getEntry(type: EntryType, slug: string): Observable<RegistryEntry> {
    return this.http
      .get<RegistryEntry>(`${this.base}/entries/${type}/${slug}`)
      .pipe(retry({ count: 1, delay: 1000, resetOnSuccess: true }));
  }

  getStats(): Observable<AppStats> {
    return this.http
      .get<AppStats>(`${this.base}/entries/stats`)
      .pipe(retry({ count: 1, delay: 1000, resetOnSuccess: true }));
  }

  submitEntry(entry: Partial<RegistryEntry>): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/entries`, entry);
  }

  // ── Admin / Pending ──────────────────────────────────────────────────────

  getPending(
    filters?: Partial<{ status: string; type: EntryType; risk: string }>,
  ): Observable<SearchResult<PendingEntry>> {
    let httpParams = new HttpParams();
    if (filters?.status) httpParams = httpParams.set('status', filters.status);
    if (filters?.type) httpParams = httpParams.set('type', filters.type);
    if (filters?.risk) httpParams = httpParams.set('risk', filters.risk);

    return this.http
      .get<SearchResult<PendingEntry>>(`${this.base}/pending`, { params: httpParams })
      .pipe(retry({ count: 1, delay: 1000, resetOnSuccess: true }));
  }

  approvePending(id: string): Observable<void> {
    return this.http.put<void>(`${this.base}/pending/${id}/approve`, {});
  }

  rejectPending(id: string, reason: string): Observable<void> {
    return this.http.put<void>(`${this.base}/pending/${id}/reject`, { reason });
  }

  // ── Notifications ────────────────────────────────────────────────────────

  getNotifications(): Observable<Notification[]> {
    return this.http
      .get<Notification[]>(`${this.base}/notifications`)
      .pipe(retry({ count: 1, delay: 1000, resetOnSuccess: true }));
  }

  markNotificationRead(id: string): Observable<void> {
    return this.http.put<void>(`${this.base}/notifications/${id}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.put<void>(`${this.base}/notifications/read-all`, {});
  }
}
