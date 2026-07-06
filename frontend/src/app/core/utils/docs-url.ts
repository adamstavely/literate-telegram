import { environment } from '../../../environments/environment';

/** Origin of the Astro docs site (empty = same host as the registry app). */
export function getDocsOrigin(): string {
  const fromEnv = environment.docsOrigin;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  return '';
}

/** Build a URL to a docs route. */
export function docsUrl(path: string): string {
  const origin = getDocsOrigin();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}
