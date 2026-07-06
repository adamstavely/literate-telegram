import {
  Component,
  OnInit,
  HostListener,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  DestroyRef,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from './core/services/theme.service';
import { LoggingService } from './core/services/logging.service';
import { AppTheme } from './shared/types';
import { HeaderComponent } from './shared/components/header/header.component';
import { AUTH_FLASH_KEY } from './core/interceptors/auth.interceptor';
import { IconComponent } from './shared/components/icon/icon.component';

@Component({
    selector: 'app-root',
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    imports: [RouterOutlet, HeaderComponent, IconComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly logging = inject(LoggingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly authFlash = signal<string | null>(null);

  ngOnInit(): void {
    const flash = sessionStorage.getItem(AUTH_FLASH_KEY);
    if (flash) {
      this.authFlash.set(flash);
      sessionStorage.removeItem(AUTH_FLASH_KEY);
    }

    // React to theme changes and keep the DOM in sync.
    this.themeService.theme$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((theme: AppTheme) => {
        // ThemeService already applies data-theme/data-accent to <html>;
        // nothing extra needed here, but we can log for observability.
        this.logging.log('info', 'Theme changed', {
          mode: theme.mode,
          accent: theme.accent,
        });
      });
  }

  dismissAuthFlash(): void {
    this.authFlash.set(null);
  }

  /**
   * Global keyboard shortcut: ⌘K / Ctrl+K opens the search palette.
   * Dispatches a custom event that the header/search palette listens to.
   */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('interop:open-search', { bubbles: true }));
    }
  }
}
