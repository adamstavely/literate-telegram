import { docsUrl } from './docs-url';

describe('docsUrl', () => {
  it('uses docs origin in development', () => {
    expect(docsUrl('/docs/overview')).toBe('http://localhost:4321/docs/overview');
  });

  it('normalizes paths without a leading slash', () => {
    expect(docsUrl('docs/overview')).toBe('http://localhost:4321/docs/overview');
  });
});
