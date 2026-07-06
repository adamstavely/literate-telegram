/**
 * Hydrates SiteHeader.astro — mirrors frontend HeaderComponent behavior on static docs pages.
 */
import { ICON_PATHS, type IconName } from './icons';

const API = '/api';
const THEME_KEY = 'interop-theme';
const MOCK_AUTH_KEY = 'mock-auth';

interface User {
  sub: string;
  email?: string;
  name?: string;
  roles: string[];
}

interface Notification {
  id: string;
  type: 'governance' | 'security' | 'update' | 'skill';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface PlatformApp {
  id: string;
  name: string;
  icon: IconName;
  accent: string;
  desc: string;
  route?: string;
  soon?: boolean;
}

const PLATFORM_APPS: PlatformApp[] = [
  { id: 'registry', name: 'Registry', icon: 'box', accent: '#3b5bff', desc: 'Discover & publish servers, tools, and skills', route: '/' },
  { id: 'gateway', name: 'Gateway', icon: 'globe', accent: '#0d9aa6', desc: 'Route traffic & serve virtual servers', soon: true },
  { id: 'governance', name: 'Governance', icon: 'shield', accent: '#1f9d62', desc: 'Policies, approvals & data tiers', route: '/admin/policy' },
  { id: 'insights', name: 'Insights', icon: 'bolt', accent: '#c2820b', desc: 'Usage, traffic & health', soon: true },
  { id: 'admin', name: 'Admin', icon: 'user', accent: '#8b46d6', desc: 'Org, teams & access', route: '/admin' },
  { id: 'docs', name: 'Docs', icon: 'book', accent: '#5a63d8', desc: 'Guides & API reference', route: '/docs/overview' },
];

const NOTIF_ICONS: Record<Notification['type'], IconName> = {
  governance: 'shield',
  security: 'lock',
  update: 'refresh',
  skill: 'skill',
};

function iconSvg(name: IconName, size = 16): string {
  const body = ICON_PATHS[name] ?? '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userFromToken(token: string | null): User | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== 'string') return null;
  const custom = payload['https://interop.io/roles'];
  const direct = payload.roles;
  const raw = Array.isArray(custom) ? custom : Array.isArray(direct) ? direct : [];
  const roles = raw.filter((r): r is string => typeof r === 'string').map((r) => r.toLowerCase());
  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    roles,
  };
}

function readMockUser(): User | null {
  const raw = localStorage.getItem(MOCK_AUTH_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as User & { accessToken?: string };
    return { sub: p.sub, email: p.email, name: p.name, roles: p.roles?.map((r) => r.toLowerCase()) ?? [] };
  } catch {
    return null;
  }
}

function getAccessToken(): string | null {
  const raw = localStorage.getItem(MOCK_AUTH_KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw) as { accessToken?: string };
      if (p.accessToken) return p.accessToken;
    } catch {}
  }
  for (const storage of [sessionStorage, localStorage]) {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      if (key === 'access_token' || key.endsWith('-access_token')) {
        const v = storage.getItem(key);
        if (v) return v;
      }
    }
  }
  return null;
}

function getCurrentUser(): User | null {
  return readMockUser() ?? userFromToken(getAccessToken());
}

function isAdmin(user: User | null): boolean {
  return user?.roles.some((r) => r === 'admin') ?? false;
}

function avatarInitials(name: string): string {
  return name
    .split(/[\s/]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function isCurrentApp(app: PlatformApp): boolean {
  const url = window.location.pathname;
  if (app.id === 'registry') {
    return url === '/' || url.startsWith('/entry') || url.startsWith('/collections') || url.startsWith('/register');
  }
  if (app.id === 'governance') return url.startsWith('/admin/policy');
  if (app.id === 'admin') return url.startsWith('/admin') && !url.startsWith('/admin/policy');
  if (app.id === 'docs') return url.startsWith('/docs');
  return app.route ? url.startsWith(app.route) && app.route !== '/' : false;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  return fetch(`${API}${path}`, { ...init, headers, credentials: 'same-origin' });
}

export function initSiteHeader(): void {
  const hdr = document.querySelector('.hdr');
  const appOrigin = (hdr?.getAttribute('data-app-origin') ?? '').replace(/\/$/, '');
  const appPath = (path: string): string => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return appOrigin ? `${appOrigin}${normalized}` : normalized;
  };

  const menuBtn = document.getElementById('hdr-menu-btn');
  const nav = document.getElementById('primary-nav');
  const themeBtn = document.getElementById('theme-toggle');
  const searchInput = document.getElementById('header-search') as HTMLInputElement | null;
  const adminLink = document.getElementById('hdr-admin-link');
  const avatarEl = document.getElementById('hdr-avatar');
  const notifBtn = document.getElementById('hdr-notif-btn');
  const notifPop = document.getElementById('hdr-notif-pop');
  const notifList = document.getElementById('hdr-notif-list');
  const notifBadge = document.getElementById('hdr-notif-badge');
  const notifHeadCount = document.getElementById('hdr-notif-head-count');
  const notifMarkAll = document.getElementById('hdr-notif-mark-all');
  const notifError = document.getElementById('hdr-notif-error');
  const notifTabAll = document.getElementById('hdr-notif-tab-all');
  const notifTabUnread = document.getElementById('hdr-notif-tab-unread');
  const notifFoot = document.getElementById('hdr-notif-foot');
  const appsBtn = document.getElementById('hdr-apps-btn');
  const appsPop = document.getElementById('hdr-apps-pop');
  const appsGrid = document.getElementById('hdr-apps-grid');

  let user = getCurrentUser();
  let notifications: Notification[] = [];
  let notifTab: 'all' | 'unread' = 'all';
  let notifOpen = false;
  let appsOpen = false;
  let menuOpen = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  function resolveMode(mode: string): 'light' | 'dark' {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode === 'dark' ? 'dark' : 'light';
  }

  function loadTheme(): { mode: string; accent?: string } {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { mode: 'system' };
  }

  function applyTheme(theme: { mode: string; accent?: string }) {
    const resolved = resolveMode(theme.mode);
    document.documentElement.setAttribute('data-theme', resolved);
    if (theme.accent && theme.accent !== 'cobalt') {
      document.documentElement.setAttribute('data-accent', theme.accent);
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
    const iconEl = document.getElementById('theme-icon');
    if (iconEl) {
      iconEl.innerHTML = iconSvg(resolved === 'dark' ? 'sun' : 'moon', 18);
    }
    themeBtn?.setAttribute('aria-label', resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn?.setAttribute('title', resolved === 'dark' ? 'Switch to light' : 'Switch to dark');
  }

  function syncAuthUi() {
    user = getCurrentUser();
    const name = user?.name ?? 'Guest';
    if (avatarEl) {
      avatarEl.textContent = avatarInitials(name);
      avatarEl.setAttribute('aria-label', name);
    }
    if (adminLink) adminLink.hidden = !isAdmin(user);
    if (notifFoot) notifFoot.hidden = !isAdmin(user);
  }

  function closeMenu() {
    menuOpen = false;
    nav?.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded', 'false');
    const iconSlot = menuBtn?.querySelector('[data-menu-icon]');
    if (iconSlot) iconSlot.innerHTML = iconSvg('list', 20);
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
    nav?.classList.toggle('open', menuOpen);
    menuBtn?.setAttribute('aria-expanded', String(menuOpen));
    const iconSlot = menuBtn?.querySelector('[data-menu-icon]');
    if (iconSlot) iconSlot.innerHTML = iconSvg(menuOpen ? 'close' : 'list', 20);
  }

  function closeNotifications() {
    notifOpen = false;
    if (notifPop) notifPop.hidden = true;
    notifBtn?.setAttribute('aria-expanded', 'false');
  }

  function closeApps() {
    appsOpen = false;
    if (appsPop) appsPop.hidden = true;
    appsBtn?.classList.remove('on');
    appsBtn?.setAttribute('aria-expanded', 'false');
  }

  function renderAppsGrid() {
    if (!appsGrid) return;
    appsGrid.innerHTML = PLATFORM_APPS.map((a) => {
      const current = isCurrentApp(a);
      const soon = a.soon ? ' soon' : '';
      const cur = current ? ' current' : '';
      const disabled = a.soon ? ' disabled' : '';
      return `<button type="button" class="app-tile${cur}${soon}" role="menuitem" data-app-id="${a.id}"${disabled}>
        <span class="app-tile-ic" style="color:${a.accent};background:color-mix(in oklch, ${a.accent} 12%, var(--cm));border-color:color-mix(in oklch, ${a.accent} 26%, var(--cm))">
          ${iconSvg(a.icon, 18)}
        </span>
        <span class="app-tile-body">
          <span class="app-tile-name">${a.name}${current ? ' <span class="app-tile-dot" title="Current app"></span>' : ''}${a.soon ? ' <span class="app-tile-soon">Soon</span>' : ''}</span>
          <span class="app-tile-desc">${a.desc}</span>
        </span>
      </button>`;
    }).join('');
    appsGrid.querySelectorAll('[data-app-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-app-id');
        const app = PLATFORM_APPS.find((a) => a.id === id);
        if (!app || app.soon || !app.route || isCurrentApp(app)) return;
        closeApps();
        window.location.assign(app.route.startsWith('/docs') ? app.route : appPath(app.route));
      });
    });
  }

  function unreadCount(): number {
    return notifications.filter((n) => !n.read).length;
  }

  function filteredNotifications(): Notification[] {
    return notifTab === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  }

  function formatShortDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function renderNotifications() {
    const unread = unreadCount();
    if (notifBadge) notifBadge.hidden = unread === 0;
    if (notifHeadCount) {
      notifHeadCount.textContent = String(unread);
      notifHeadCount.hidden = unread === 0;
    }
    if (notifMarkAll) notifMarkAll.hidden = unread === 0;

    if (notifTabUnread) {
      const unread = unreadCount();
      notifTabUnread.textContent = unread > 0 ? `Unread · ${unread}` : 'Unread';
    }
    notifTabAll?.classList.toggle('on', notifTab === 'all');
    notifTabUnread?.classList.toggle('on', notifTab === 'unread');
    notifTabAll?.setAttribute('aria-selected', notifTab === 'all' ? 'true' : 'false');
    notifTabUnread?.setAttribute('aria-selected', notifTab === 'unread' ? 'true' : 'false');

    if (!notifList) return;
    const items = filteredNotifications();
    if (items.length === 0 && !notifError?.textContent) {
      notifList.innerHTML = `<div class="notif-empty">
        <div class="notif-empty-ic">${iconSvg('check', 20)}</div>
        <div style="font-size:14px;font-weight:540;color:var(--ink)">You're all caught up</div>
        <div style="font-size:12.5px;margin-top:3px">No unread notifications.</div>
      </div>`;
      return;
    }
    notifList.innerHTML = items
      .map(
        (n) => `<div class="notif-item${n.read ? '' : ' unread'}" role="button" tabindex="0" data-notif-id="${n.id}" aria-label="Mark notification read: ${n.title}">
        <div class="notif-ic ${n.type}">${iconSvg(NOTIF_ICONS[n.type], 16)}</div>
        <div class="notif-body">
          <div class="notif-t"><b>${n.title}</b></div>
          <div class="notif-d">${n.body}</div>
          <time class="notif-time" datetime="${n.createdAt}">${formatShortDate(n.createdAt)}</time>
        </div>
        ${n.read ? '' : '<span class="notif-unread-dot" aria-hidden="true"></span>'}
      </div>`,
      )
      .join('');

    notifList.querySelectorAll('[data-notif-id]').forEach((el) => {
      const mark = () => {
        const id = el.getAttribute('data-notif-id');
        if (id) void markRead(id);
      };
      el.addEventListener('click', mark);
      el.addEventListener('keydown', (e) => {
        if (!(e instanceof KeyboardEvent)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          mark();
        }
      });
    });
  }

  async function loadNotifications() {
    if (!user) return;
    if (notifError) {
      notifError.textContent = '';
      notifError.hidden = true;
    }
    if (notifList) notifList.innerHTML = '<div class="notif-empty" aria-busy="true">Loading…</div>';
    try {
      const res = await apiFetch('/notifications');
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as { hits?: Notification[] };
      notifications = data.hits ?? [];
      renderNotifications();
    } catch {
      if (notifError) {
        notifError.innerHTML = 'Could not load notifications. <button type="button" class="inline-link" id="hdr-notif-retry">Retry</button>';
        notifError.hidden = false;
        document.getElementById('hdr-notif-retry')?.addEventListener('click', () => void loadNotifications());
      }
      if (notifList) notifList.innerHTML = '';
    }
  }

  async function markRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
      notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      renderNotifications();
    } catch {
      if (notifError) {
        notifError.textContent = 'Could not update notification.';
        notifError.hidden = false;
      }
    }
  }

  async function markAllRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' });
      notifications = notifications.map((n) => ({ ...n, read: true }));
      renderNotifications();
    } catch {
      if (notifError) {
        notifError.textContent = 'Could not mark notifications as read.';
        notifError.hidden = false;
      }
    }
  }

  function navigateSearch(q: string) {
    const root = appPath('/');
    const url = q.trim() ? `${root}?q=${encodeURIComponent(q.trim())}` : root;
    window.location.assign(url);
  }

  // Theme
  applyTheme(loadTheme());
  themeBtn?.addEventListener('click', () => {
    const theme = loadTheme();
    const resolved = resolveMode(theme.mode);
    const next = resolved === 'dark' ? 'light' : 'dark';
    const updated = { ...theme, mode: next };
    localStorage.setItem(THEME_KEY, JSON.stringify(updated));
    applyTheme(updated);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const theme = loadTheme();
    if (theme.mode === 'system') applyTheme(theme);
  });

  // Mobile nav
  menuBtn?.addEventListener('click', toggleMenu);
  nav?.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  // Search
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => navigateSearch(searchInput.value), 300);
  });
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimer);
      navigateSearch(searchInput.value);
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
    if (e.key === 'Escape') {
      if (notifOpen) closeNotifications();
      if (appsOpen) closeApps();
      if (menuOpen) closeMenu();
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target as Node;
    if (notifOpen && notifPop && notifBtn && !notifPop.contains(t) && !notifBtn.contains(t)) {
      closeNotifications();
    }
    if (appsOpen && appsPop && appsBtn && !appsPop.contains(t) && !appsBtn.contains(t)) {
      closeApps();
    }
  });

  // Notifications
  notifBtn?.addEventListener('click', () => {
    notifOpen = !notifOpen;
    if (notifOpen) {
      if (notifPop) notifPop.hidden = false;
      notifBtn.setAttribute('aria-expanded', 'true');
      void loadNotifications();
    } else {
      closeNotifications();
    }
  });
  notifTabAll?.addEventListener('click', () => {
    notifTab = 'all';
    renderNotifications();
  });
  notifTabUnread?.addEventListener('click', () => {
    notifTab = 'unread';
    renderNotifications();
  });
  notifMarkAll?.addEventListener('click', () => void markAllRead());
  document.getElementById('hdr-notif-admin')?.addEventListener('click', () => {
    closeNotifications();
    window.location.assign(appPath('/admin'));
  });

  // Apps switcher
  renderAppsGrid();
  appsBtn?.addEventListener('click', () => {
    appsOpen = !appsOpen;
    if (appsOpen) {
      if (appsPop) appsPop.hidden = false;
      appsBtn.classList.add('on');
      appsBtn.setAttribute('aria-expanded', 'true');
    } else {
      closeApps();
    }
  });

  // Auth
  window.addEventListener('storage', (e) => {
    if (e.key === MOCK_AUTH_KEY || e.key?.includes('access_token')) syncAuthUi();
  });

  syncAuthUi();
}
