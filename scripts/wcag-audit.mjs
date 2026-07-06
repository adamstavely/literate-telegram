#!/usr/bin/env node
/**
 * WCAG 2.2 AA automated audit across Interop frontend routes.
 * Uses axe-core with wcag22aa tags + supplemental checks.
 */
import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { writeFileSync } from 'node:fs';

const BASE = process.env.WCAG_BASE_URL ?? 'http://localhost:4300';

const MOCK_AUTH = JSON.stringify({
  sub: 'dev-user-1',
  email: 'dev@example.com',
  name: 'Dev User',
  roles: ['admin'],
  accessToken: 'mock-token',
});

const STATIC_ROUTES = [
  '/',
  '/collections',
  '/docs',
  '/docs/getting-started',
  '/register',
  '/admin',
  '/admin/policy',
  '/collections/new',
  '/callback',
  '/nonexistent-page-for-404',
  // Representative detail pages (all entry types)
  '/entry/server/github',
  '/entry/tool/create-issue',
  '/entry/skill/pr-review',
  '/entry/agent/release-captain',
  '/entry/api/stripe-api',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

const THEMES = ['light', 'dark'];

async function discoverDynamicRoutes(page) {
  const routes = [];
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 15000 }).catch(() => {});

  const entryLinks = await page.$$eval('a[href^="/entry/"]', (els) =>
    [...new Set(els.map((a) => a.getAttribute('href')).filter(Boolean))].slice(0, 4),
  );
  routes.push(...entryLinks);

  await page.goto(`${BASE}/collections`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  const collectionLinks = await page.$$eval('a[href^="/collections/"]', (els) =>
    [...new Set(els.map((a) => a.getAttribute('href')).filter(Boolean))]
      .filter((h) => h !== '/collections/new')
      .slice(0, 2),
  );
  routes.push(...collectionLinks);

  return routes;
}

async function injectMockAuth(page) {
  await page.evaluateOnNewDocument((auth) => {
    localStorage.setItem('mock-auth', auth);
  }, MOCK_AUTH);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
}

async function auditPage(page, url, viewport, theme) {
  await page.setViewport({ width: viewport.width, height: viewport.height });
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 15000 }).catch(() => {});
  await setTheme(page, theme);
  // Allow Angular hydration / lazy chunks
  await new Promise((r) => setTimeout(r, 800));

  const title = await page.title();
  const lang = await page.evaluate(() => document.documentElement.lang || '(missing)');
  const h1Count = await page.evaluate(() => document.querySelectorAll('h1').length);

  const axeResults = await new AxePuppeteer(page)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();

  const supplemental = await page.evaluate(() => {
    const issues = [];
    const html = document.documentElement;

    if (!html.lang) issues.push({ id: 'html-lang', impact: 'serious', description: '<html> missing lang attribute' });

    const skipLink = document.querySelector('a.skip-link, a[href="#main-content"]');
    if (!skipLink) issues.push({ id: 'skip-link', impact: 'moderate', description: 'No skip-to-main-content link found' });

    const main = document.querySelector('main, [role="main"]');
    if (!main) issues.push({ id: 'main-landmark', impact: 'moderate', description: 'No <main> landmark found' });

    const images = [...document.querySelectorAll('img')];
    for (const img of images) {
      const alt = img.getAttribute('alt');
      const decorative = alt === '' || img.getAttribute('aria-hidden') === 'true';
      if (!decorative && (alt === null || alt.trim() === '')) {
        issues.push({
          id: 'img-alt',
          impact: 'critical',
          description: `Image missing alt text: ${img.src?.slice(-60) ?? '(unknown)'}`,
          target: img.outerHTML.slice(0, 120),
        });
      }
    }

    const iconOnlyButtons = [...document.querySelectorAll('button, a.iconbtn, [role="button"]')].filter((el) => {
      const text = (el.textContent ?? '').trim();
      const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      const hasTitle = el.getAttribute('title');
      return !text && !hasAria && !hasTitle;
    });
    for (const btn of iconOnlyButtons.slice(0, 5)) {
      issues.push({
        id: 'icon-button-name',
        impact: 'serious',
        description: 'Control with no visible text and no accessible name',
        target: btn.outerHTML.slice(0, 120),
      });
    }

    const smallTargets = [...document.querySelectorAll('button, a, input, select, [role="button"], [role="tab"]')].filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0) return false;
      return rect.width < 24 || rect.height < 24;
    });
    if (smallTargets.length > 0) {
      issues.push({
        id: 'target-size-22',
        impact: 'moderate',
        description: `WCAG 2.5.8: ${smallTargets.length} interactive target(s) smaller than 24×24 CSS px`,
        count: smallTargets.length,
      });
    }

    const autofocus = document.querySelector('[autofocus]');
    if (autofocus) {
      issues.push({ id: 'autofocus', impact: 'moderate', description: 'Page contains autofocus attribute (2.4.3)' });
    }

    return issues;
  });

  const violations = axeResults.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    wcagTags: v.tags.filter((t) => t.startsWith('wcag')),
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target),
    html: v.nodes.slice(0, 2).map((n) => n.html?.slice(0, 150)),
  }));

  const incomplete = axeResults.incomplete.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
  }));

  return {
    url,
    fullUrl: `${BASE}${url}`,
    viewport: viewport.name,
    theme,
    title,
    lang,
    h1Count,
    violationCount: violations.length,
    violations,
    incomplete,
    supplemental,
    passes: axeResults.passes.length,
  };
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await injectMockAuth(page);

  console.log(`Auditing ${BASE} for WCAG 2.2 AA…\n`);

  const dynamicRoutes = await discoverDynamicRoutes(page);
  const allRoutes = [...new Set([...STATIC_ROUTES, ...dynamicRoutes])];

  console.log(`Routes (${allRoutes.length}): ${allRoutes.join(', ')}\n`);

  const results = [];
  for (const route of allRoutes) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        process.stdout.write(`  ${route} [${viewport.name}/${theme}]… `);
        try {
          const result = await auditPage(page, route, viewport, theme);
          results.push(result);
          const supp = result.supplemental.length;
          console.log(`${result.violationCount} violations, ${supp} supplemental`);
        } catch (err) {
          console.log(`ERROR: ${err.message}`);
          results.push({ url: route, viewport: viewport.name, theme, error: err.message });
        }
      }
    }
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    standard: 'WCAG 2.2 Level AA',
    tool: 'axe-core + supplemental checks',
    routeCount: allRoutes.length,
    scanCount: results.length,
    results,
    summary: buildSummary(results),
  };

  const outPath = 'wcag-audit-report.json';
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  printSummary(report);
  console.log(`\nFull JSON report: ${outPath}`);
}

function buildSummary(results) {
  const ok = results.filter((r) => !r.error);
  const totalViolations = ok.reduce((s, r) => s + r.violationCount, 0);
  const uniqueViolationIds = new Set();
  const byId = {};

  for (const r of ok) {
    for (const v of r.violations ?? []) {
      uniqueViolationIds.add(v.id);
      byId[v.id] ??= { count: 0, impact: v.impact, description: v.description, help: v.help };
      byId[v.id].count += v.nodes ?? 1;
    }
    for (const s of r.supplemental ?? []) {
      uniqueViolationIds.add(s.id);
      byId[s.id] ??= { count: 0, impact: s.impact, description: s.description, supplemental: true };
      byId[s.id].count += s.count ?? 1;
    }
  }

  const cleanPages = ok.filter((r) => r.violationCount === 0 && (r.supplemental?.length ?? 0) === 0).length;

  return {
    pagesScanned: ok.length,
    pagesWithZeroIssues: cleanPages,
    totalViolationInstances: totalViolations,
    uniqueIssueTypes: [...uniqueViolationIds].sort(),
    issuesByType: byId,
  };
}

function printSummary(report) {
  const { summary, results } = report;
  console.log('\n' + '='.repeat(72));
  console.log('WCAG 2.2 AA AUDIT SUMMARY');
  console.log('='.repeat(72));
  console.log(`Scans: ${report.scanCount} (${report.routeCount} routes × 2 viewports × 2 themes)`);
  console.log(`Clean scans (0 axe violations + 0 supplemental): ${summary.pagesWithZeroIssues}/${summary.pagesScanned}`);
  console.log(`Total axe violation instances: ${summary.totalViolationInstances}`);
  console.log(`Unique issue types: ${summary.uniqueIssueTypes.length}`);

  if (summary.uniqueIssueTypes.length > 0) {
    console.log('\nIssues by type:');
    for (const [id, info] of Object.entries(summary.issuesByType).sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  [${info.impact}] ${id} (${info.count}×) — ${info.description}`);
    }
  }

  const failing = results.filter((r) => !r.error && (r.violationCount > 0 || (r.supplemental?.length ?? 0) > 0));
  if (failing.length > 0) {
    console.log('\nFailing scans:');
    for (const r of failing) {
      const ids = [
        ...(r.violations ?? []).map((v) => v.id),
        ...(r.supplemental ?? []).map((s) => s.id),
      ];
      console.log(`  ${r.url} [${r.viewport}/${r.theme}]: ${[...new Set(ids)].join(', ')}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
