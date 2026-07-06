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
  ChangeDetectionStrategy
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
import { FocusTrapFactory } from '@angular/cdk/a11y';
import { activateFocusTrap } from '../../utils/focus-trap.util';
import { AuthenticatedUser, Notification } from '../../types';
import { docsUrl } from '../../../core/utils/docs-url';

@Component({
    selector: 'app-header',
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    imports: [RouterLink, RouterLinkActive, FormsModule, IconComponent, AvatarComponent, DatePipe],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly registryService = inject(RegistryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly focusTrapFactory = inject(FocusTrapFactory);
  private releaseFocusTrap: (() => void) | null = null;
  private releaseAppsTrap: (() => void) | null = null;
  private releaseMenuTrap: (() => void) | null = null;

  @ViewChild('notifBtn') notifBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('notifDropdown') notifDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('appsBtn') appsBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('appsPop') appsPop?: ElementRef<HTMLDivElement>;
  @ViewChild('hamburgerBtn') hamburgerBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('primaryNav') primaryNav?: ElementRef<HTMLElement>;

  /** Whether the mobile nav menu is open. */
  readonly menuOpen = signal(false);

  /** Current authenticated user (signal-based for template binding). */
  readonly currentUser = signal<AuthenticatedUser | null>(null);

  /** Whether the user is authenticated. */
  readonly isAuthenticated = signal(false);

  /** Whether the user is an admin. */
  readonly isAdmin = computed(() =>
    this.currentUser()?.roles?.some((r) => r.toLowerCase() === 'admin') ?? false,
  );

  /** Docs overview — Astro site in dev, same host in production. */
  readonly docsOverviewUrl = docsUrl('/docs/overview');

  /** Platform "app switcher" (waffle) menu. */
  readonly appsOpen = signal(false);
  readonly platformApps: Array<{
    id: string;
    name: string;
    icon: string;
    accent: string;
    desc: string;
    route?: string;
    soon?: boolean;
  }> = [
    { id: 'registry', name: 'Registry', icon: 'box', accent: '#3b5bff', desc: 'Discover & publish servers, tools, and skills', route: '/' },
    { id: 'gateway', name: 'Gateway', icon: 'globe', accent: '#0d9aa6', desc: 'Route traffic & serve virtual servers', soon: true },
    { id: 'governance', name: 'Governance', icon: 'shield', accent: '#1f9d62', desc: 'Policies, approvals & data tiers', route: '/admin/policy' },
    { id: 'insights', name: 'Insights', icon: 'bolt', accent: '#c2820b', desc: 'Usage, traffic & health', soon: true },
    { id: 'admin', name: 'Admin', icon: 'user', accent: '#8b46d6', desc: 'Org, teams & access', route: '/admin' },
    { id: 'docs', name: 'Docs', icon: 'book', accent: '#5a63d8', desc: 'Guides & API reference', route: '/docs/overview' },
  ];

  /** Current theme mode for the toggle button label. */
  readonly isDarkMode = signal(false);

  /** Notifications state */
  readonly notificationsOpen = signal(false);
  readonly notifTab = signal<'all' | 'unread'>('all');
  readonly notifications = signal<Notification[]>([]);
  readonly notificationsLoading = signal(false);
  readonly notificationsError = signal<string | null>(null);
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);
  readonly filteredNotifications = computed(() =>
    this.notifTab() === 'unread'
      ? this.notifications().filter(n => !n.read)
      : this.notifications(),
  );
  readonly displayName = computed(() =>
    this.isAuthenticated() ? (this.currentUser()?.name ?? 'Signed-in user') : 'Guest',
  );

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

  onNotifTabKeydown(event: KeyboardEvent, current: 'all' | 'unread'): void {
    const tabs: Array<'all' | 'unread'> = ['all', 'unread'];
    const idx = tabs.indexOf(current);
    if (idx < 0) return;

    let next = idx;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (idx + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (idx - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabs[next];
    this.setNotifTab(nextTab);
    document.getElementById(`notif-tab-${nextTab}`)?.focus();
  }

  ngOnDestroy(): void {
    this.releaseFocusTrap?.();
    this.releaseAppsTrap?.();
    this.releaseMenuTrap?.();
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    // ⌘K / Ctrl+K is handled once at the app root, which dispatches
    // 'interop:open-search' (see the listener wired in ngOnInit). Don't also
    // handle it here or the shortcut fires twice.
    if (event.key === 'Escape' && this.notificationsOpen()) {
      this.closeNotifications();
    }
    if (event.key === 'Escape' && this.appsOpen()) {
      this.closeApps();
    }
    if (event.key === 'Escape' && this.menuOpen()) {
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    const dropdown = this.notifDropdown?.nativeElement;
    const btn = this.notifBtn?.nativeElement;
    if (dropdown && btn && !dropdown.contains(target) && !btn.contains(target)) {
      this.closeNotifications();
    }
    const appsPop = this.appsPop?.nativeElement;
    const appsBtn = this.appsBtn?.nativeElement;
    if (this.appsOpen() && appsPop && appsBtn && !appsPop.contains(target) && !appsBtn.contains(target)) {
      this.closeApps();
    }
  }

  toggleApps(): void {
    if (this.appsOpen()) {
      this.closeApps();
      return;
    }
    this.appsOpen.set(true);
    queueMicrotask(() => {
      const el = this.appsPop?.nativeElement;
      if (el) {
        this.releaseAppsTrap = activateFocusTrap(
          this.focusTrapFactory,
          el,
          this.appsBtn?.nativeElement,
        );
      }
    });
  }

  closeApps(): void {
    this.appsOpen.set(false);
    this.releaseAppsTrap?.();
    this.releaseAppsTrap = null;
  }

  isCurrentApp(a: { id: string; route?: string }): boolean {
    const url = this.router.url.split('?')[0];
    if (a.id === 'registry') {
      return (
        url === '/' ||
        url.startsWith('/entry') ||
        url.startsWith('/collections') ||
        url.startsWith('/register')
      );
    }
    if (a.id === 'governance') return url.startsWith('/admin/policy');
    if (a.id === 'admin') return url.startsWith('/admin') && !url.startsWith('/admin/policy');
    if (a.id === 'docs') return url.startsWith('/docs');
    return a.route ? url.startsWith(a.route) && a.route !== '/' : false;
  }

  navigateApp(a: { route?: string; soon?: boolean; id: string }): void {
    if (a.soon || !a.route || this.isCurrentApp(a)) return;
    this.closeApps();
    if (a.route.startsWith('/docs')) {
      window.location.assign(docsUrl(a.route));
      return;
    }
    void this.router.navigate([a.route]);
  }

  toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.menuOpen.set(true);
    queueMicrotask(() => {
      const el = this.primaryNav?.nativeElement;
      if (el) {
        this.releaseMenuTrap = activateFocusTrap(
          this.focusTrapFactory,
          el,
          this.hamburgerBtn?.nativeElement,
        );
      }
    });
  }

  closeMenu(): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.releaseMenuTrap?.();
    this.releaseMenuTrap = null;
  }

  toggleTheme(): void {
    this.themeService.toggleMode();
  }

  login(): void {
    this.auth.login();
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
    const willOpen = !this.notificationsOpen();
    if (willOpen) {
      this.notificationsOpen.set(true);
      this.loadNotifications();
      queueMicrotask(() => {
        const el = this.notifDropdown?.nativeElement;
        if (el) {
          this.releaseFocusTrap = activateFocusTrap(
            this.focusTrapFactory,
            el,
            this.notifBtn?.nativeElement,
          );
        }
      });
    } else {
      this.closeNotifications();
    }
  }

  closeNotifications(): void {
    this.notificationsOpen.set(false);
    this.releaseFocusTrap?.();
    this.releaseFocusTrap = null;
    this.notifBtn?.nativeElement.focus();
  }

  loadNotifications(): void {
    this.notificationsLoading.set(true);
    this.notificationsError.set(null);
    this.registryService.getNotifications().subscribe({
      next: notifs => {
        this.notifications.set(notifs);
        this.notificationsLoading.set(false);
      },
      error: () => {
        this.notificationsError.set('Could not load notifications.');
        this.notificationsLoading.set(false);
      },
    });
  }

  markAllRead(): void {
    this.registryService.markAllRead().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notifications.update(notifs => notifs.map(n => ({ ...n, read: true })));
      },
      error: () => {
        this.notificationsError.set('Could not mark notifications as read.');
      },
    });
  }

  markRead(id: string): void {
    this.registryService.markNotificationRead(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notifications.update(notifs =>
          notifs.map(n => n.id === id ? { ...n, read: true } : n)
        );
      },
      error: () => {
        this.notificationsError.set('Could not update notification.');
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
