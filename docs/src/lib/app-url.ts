/** Origin of the Interop Angular app (empty = same host as docs). */
export function getAppOrigin(): string {
  const fromEnv = import.meta.env.PUBLIC_APP_ORIGIN;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  // Docs dev server (:4321) — registry routes live on the Angular app (:4200).
  if (import.meta.env.DEV) {
    return 'http://localhost:4200';
  }
  return '';
}

/** Build a URL to a registry (Angular) route. */
export function appUrl(path: string): string {
  const origin = getAppOrigin();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}
