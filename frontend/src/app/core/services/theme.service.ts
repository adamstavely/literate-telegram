import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, Subscription } from 'rxjs';
import { AccentColor, AppTheme, ThemeMode } from '../../shared/types';

const STORAGE_KEY = 'interop-theme';

const DEFAULTS: AppTheme = {
  mode: 'system',
  accent: 'cobalt',
};

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly _theme$ = new BehaviorSubject<AppTheme>(this._loadTheme());

  /** Observable that emits the current theme whenever it changes. */
  readonly theme$: Observable<AppTheme> = this._theme$.asObservable();

  private _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private _mediaListener: Subscription;

  constructor() {
    // Apply initial theme to DOM.
    this._apply(this._theme$.value);

    // Re-apply when the OS colour-scheme preference changes (system mode only).
    this._mediaListener = fromEvent<MediaQueryListEvent>(
      this._mediaQuery,
      'change',
    ).subscribe(() => {
      if (this._theme$.value.mode === 'system') {
        this._apply(this._theme$.value);
      }
    });
  }

  ngOnDestroy(): void {
    this._mediaListener.unsubscribe();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Returns a snapshot of the current theme. */
  get snapshot(): AppTheme {
    return this._theme$.value;
  }

  /** Sets the colour mode and persists it. */
  setMode(mode: ThemeMode): void {
    this._update({ ...this._theme$.value, mode });
  }

  /** Sets the accent colour and persists it. */
  setAccent(accent: AccentColor): void {
    this._update({ ...this._theme$.value, accent });
  }

  /**
   * Toggles between light and dark.
   * If the current resolved mode is dark → switches to light; otherwise dark.
   */
  toggleMode(): void {
    const resolved = this._resolveMode(this._theme$.value.mode);
    this.setMode(resolved === 'dark' ? 'light' : 'dark');
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _update(theme: AppTheme): void {
    this._persist(theme);
    this._apply(theme);
    this._theme$.next(theme);
  }

  /** Writes `data-theme` and `data-accent` to `<html>`. */
  private _apply(theme: AppTheme): void {
    const resolved = this._resolveMode(theme.mode);
    document.documentElement.setAttribute('data-theme', resolved);

    if (theme.accent === 'cobalt') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', theme.accent);
    }
  }

  /** Resolves 'system' to the actual OS preference. */
  private _resolveMode(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'system') {
      return this._mediaQuery.matches ? 'dark' : 'light';
    }
    return mode;
  }

  private _persist(theme: AppTheme): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
      // Storage may be unavailable in private browsing; fail silently.
    }
  }

  private _loadTheme(): AppTheme {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppTheme>;
        return {
          mode: this._validMode(parsed.mode) ? parsed.mode : DEFAULTS.mode,
          accent: this._validAccent(parsed.accent)
            ? parsed.accent
            : DEFAULTS.accent,
        };
      }
    } catch {
      // Fall through to defaults.
    }
    return { ...DEFAULTS };
  }

  private _validMode(v: unknown): v is ThemeMode {
    return v === 'light' || v === 'dark' || v === 'system';
  }

  private _validAccent(v: unknown): v is AccentColor {
    return (
      v === 'cobalt' ||
      v === 'iris' ||
      v === 'emerald' ||
      v === 'ember' ||
      v === 'mono'
    );
  }
}
