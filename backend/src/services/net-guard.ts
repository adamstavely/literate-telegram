import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../config/index.js';
import { HttpError } from '../middleware/error-handler.js';

/**
 * SSRF guardrails for server-initiated outbound requests (OpenAPI spec import,
 * API try-it-out proxy). Validates the URL scheme, rejects targets that resolve
 * to private/loopback/link-local/metadata addresses, and performs a size- and
 * time-bounded fetch that re-validates every redirect hop.
 *
 * Note: validation resolves DNS and checks the returned addresses; a fully
 * rebind-proof implementation would additionally pin the connection to the
 * validated IP (requires a custom dispatcher). That hardening is a follow-up.
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

const V4_BLOCKED: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8], // "this" network / unspecified
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (incl. 169.254.169.254 cloud metadata)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved (incl. 255.255.255.255)
];

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → unsafe
  return V4_BLOCKED.some(([base, bits]) => {
    const baseInt = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (baseInt & mask);
  });
}

/** Expand an IPv6 literal (incl. embedded IPv4) to 16 bytes, or null if invalid. */
function expandV6(ip: string): number[] | null {
  let addr = ip;
  const pct = addr.indexOf('%');
  if (pct >= 0) addr = addr.slice(0, pct); // strip zone id

  let embeddedV4: number[] | null = null;
  if (addr.includes('.')) {
    const i = addr.lastIndexOf(':');
    const v4 = addr.slice(i + 1);
    const n = ipv4ToInt(v4);
    if (n === null) return null;
    embeddedV4 = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    addr = addr.slice(0, i + 1) + '0:0'; // placeholder hextets; overwritten below
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];

  const groups: number[] = [];
  for (const h of head) groups.push(parseInt(h || '0', 16));
  if (halves.length === 2) {
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return null;
    for (let k = 0; k < missing; k++) groups.push(0);
  } else if (head.length !== 8) {
    return null;
  }
  for (const h of tail) groups.push(parseInt(h || '0', 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) {
    return null;
  }

  const bytes: number[] = [];
  for (const g of groups) bytes.push((g >>> 8) & 255, g & 255);
  if (embeddedV4) {
    bytes[12] = embeddedV4[0];
    bytes[13] = embeddedV4[1];
    bytes[14] = embeddedV4[2];
    bytes[15] = embeddedV4[3];
  }
  return bytes;
}

function isBlockedV6(ip: string): boolean {
  const b = expandV6(ip);
  if (!b) return true;
  // IPv4-mapped ::ffff:0:0/96 → classify the embedded IPv4.
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return isBlockedV4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // NAT64 64:ff9b::/96 → classify the embedded IPv4.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && b.slice(4, 12).every((x) => x === 0)) {
    return isBlockedV4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  if (b.every((x) => x === 0)) return true; // :: unspecified
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return true; // ::1 loopback
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (b[0] === 0xff) return true; // ff00::/8 multicast
  return false;
}

/** True if an IP literal is a private/loopback/link-local/reserved address. */
export function isBlockedAddress(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return isBlockedV4(ip);
  if (fam === 6) return isBlockedV6(ip);
  return true; // not a valid IP → treat as unsafe
}

/** Parse + scheme-check a target URL. Throws HttpError(400) when disallowed. */
export function assertAllowedTarget(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, 'Invalid URL');
  }
  const httpsOnly = !config.outbound.allowHttp;
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !httpsOnly)) {
    throw new HttpError(400, httpsOnly ? 'Only https:// URLs are allowed' : 'Only http(s):// URLs are allowed');
  }
  return url;
}

/** Resolve a hostname and reject if any address is private/blocked. */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (!config.outbound.blockPrivateAddresses) return;

  // Host may itself be an IP literal (URL hostname strips brackets from IPv6).
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new HttpError(400, 'Target address is not allowed');
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new HttpError(400, 'Could not resolve target host');
  }
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new HttpError(400, 'Target host resolves to a disallowed address');
  }
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** If set, every hop's host must equal this (case-insensitive). */
  pinnedHost?: string;
}

export interface SafeFetchResult {
  status: number;
  statusText: string;
  headers: Headers;
  bodyText: string;
  truncated: boolean;
  finalUrl: string;
}

async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: '', truncated: false };
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > maxBytes) {
      const remaining = maxBytes - total;
      if (remaining > 0) chunks.push(Buffer.from(value.subarray(0, remaining)));
      truncated = true;
      await reader.cancel();
      break;
    }
    total += value.byteLength;
    chunks.push(Buffer.from(value));
  }
  return { text: Buffer.concat(chunks).toString('utf8'), truncated };
}

/**
 * Fetch a URL with SSRF, timeout, redirect, and response-size guards. Every
 * redirect hop is re-validated through assertAllowedTarget + assertPublicHost.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? config.outbound.timeoutMs;
  const maxBytes = opts.maxBytes ?? config.outbound.maxResponseBytes;
  const maxRedirects = opts.maxRedirects ?? 3;

  let current = rawUrl;
  for (let hop = 0; ; hop++) {
    const url = assertAllowedTarget(current);
    if (opts.pinnedHost && url.host.toLowerCase() !== opts.pinnedHost.toLowerCase()) {
      throw new HttpError(400, 'Target host is not permitted for this entry');
    }
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        body: opts.body,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HttpError(504, 'Upstream request timed out');
      }
      throw new HttpError(502, 'Upstream request failed');
    }

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location && hop < maxRedirects) {
      // Follow the redirect (re-validated on the next loop iteration). When the
      // redirect budget is exhausted (or maxRedirects is 0), fall through and
      // return the 3xx response as-is rather than following it off-host.
      clearTimeout(timer);
      current = new URL(location, url).toString();
      continue;
    }

    try {
      const { text, truncated } = await readCapped(res, maxBytes);
      return {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        bodyText: text,
        truncated,
        finalUrl: url.toString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
