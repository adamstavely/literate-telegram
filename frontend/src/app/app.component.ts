import {
  Component,
  OnInit,
  HostListener,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  DestroyRef,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { LoggingService } from './core/services/logging.service';
import { AppTheme } from './shared/types';
import { HeaderComponent } from './shared/components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly logging = inject(LoggingService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
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
