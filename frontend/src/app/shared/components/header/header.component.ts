import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  DestroyRef,
  HostListener,
  ElementRef,
  ViewChild,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { RegistryService } from '../../../core/services/registry.service';
import { IconComponent } from '../icon/icon.component';
import { AvatarComponent } from '../avatar/avatar.component';
import { AuthenticatedUser, Notification } from '../../types';

@Component({
  selector: 'app-header',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [RouterLink, RouterLinkActive, FormsModule, IconComponent, AvatarComponent, DatePipe],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly registryService = inject(RegistryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('notifBtn') notifBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('notifDropdown') notifDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  /** Whether the mobile nav menu is open. */
  readonly menuOpen = signal(false);

  /** Current authenticated user (signal-based for template binding). */
  readonly currentUser = signal<AuthenticatedUser | null>(null);

  /** Whether the user is authenticated. */
  readonly isAuthenticated = signal(false);

  /** Whether the user is an admin. */
  readonly isAdmin = computed(() => this.currentUser()?.roles?.includes('admin') ?? false);

  /** Current theme mode for the toggle button label. */
  readonly isDarkMode = signal(false);

  /** Notifications state */
  readonly notificationsOpen = signal(false);
  readonly notifTab = signal<'all' | 'unread'>('all');
  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);
  readonly filteredNotifications = computed(() =>
    this.notifTab() === 'unread'
      ? this.notifications().filter(n => !n.read)
      : this.notifications(),
  );
  readonly displayName = computed(() => this.currentUser()?.name ?? 'You');

  /** Search */
  searchQuery = '';
  private readonly searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(q => {
      void this.router.navigate(['/'], {
        queryParams: q ? { q } : {},
        queryParamsHandling: 'merge',
      });
    });
  }

  ngOnInit(): void {
    this.auth.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        this.currentUser.set(user);
        this.isAuthenticated.set(user !== null);
        this.loadNotifications();
      });

    this.themeService.theme$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(theme => {
        const resolved =
          theme.mode === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : theme.mode === 'dark';
        this.isDarkMode.set(resolved);
      });

    // Listen for global search shortcut dispatched by AppComponent.
    document.addEventListener('interop:open-search', () => {
      this.focusSearch();
    });
  }

  setNotifTab(tab: 'all' | 'unread'): void {
    this.notifTab.set(tab);
  }

  ngOnDestroy(): void {}

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.focusSearch();
    }
    if (event.key === 'Escape' && this.notificationsOpen()) {
      this.notificationsOpen.set(false);
      this.notifBtn?.nativeElement.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    const dropdown = this.notifDropdown?.nativeElement;
    const btn = this.notifBtn?.nativeElement;
    if (dropdown && btn && !dropdown.contains(target) && !btn.contains(target)) {
      this.notificationsOpen.set(false);
    }
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleMode();
  }

  login(): void {
    this.auth.login();
  }

  logout(): void {
    this.auth.logout();
  }

  focusSearch(): void {
    const input = document.querySelector<HTMLInputElement>('[data-search-input]');
    input?.focus();
  }

  onSearchInput(value: string): void {
    this.searchQuery = value;
    this.searchSubject.next(value);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.router.navigate(['/'], {
        queryParams: this.searchQuery ? { q: this.searchQuery } : {},
      });
    }
  }

  toggleNotifications(): void {
    this.notificationsOpen.update(v => !v);
  }

  loadNotifications(): void {
    this.registryService.getNotifications().subscribe({
      next: notifs => this.notifications.set(notifs),
      error: () => {},
    });
  }

  markAllRead(): void {
    this.registryService.markAllRead().subscribe({
      next: () => {
        this.notifications.update(notifs => notifs.map(n => ({ ...n, read: true })));
      },
    });
  }

  markRead(id: string): void {
    this.registryService.markNotificationRead(id).subscribe({
      next: () => {
        this.notifications.update(notifs =>
          notifs.map(n => n.id === id ? { ...n, read: true } : n)
        );
      },
    });
  }

  notifIcon(type: Notification['type']): string {
    const map: Record<string, string> = {
      governance: 'shield',
      security: 'lock',
      update: 'refresh',
      skill: 'skill',
    };
    return map[type] ?? 'bell';
  }
}
