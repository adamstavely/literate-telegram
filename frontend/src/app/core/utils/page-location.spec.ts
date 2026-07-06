import { safePageLocation } from './page-location';

describe('safePageLocation', () => {
  const originalHref = window.location.href;

  afterEach(() => {
    window.history.replaceState({}, '', originalHref);
  });

  it('redacts known auth query parameters', () => {
    window.history.replaceState({}, '', '/callback?code=abc&state=xyz&foo=bar');
    expect(safePageLocation()).toBe('/callback?code=%5Bredacted%5D&state=%5Bredacted%5D&foo=bar');
  });

  it('redacts sensitive key patterns such as refresh_token and api_key', () => {
    window.history.replaceState({}, '', '/?refresh_token=secret&api_key=abc123');
    const location = safePageLocation();
    expect(location).toContain('refresh_token=%5Bredacted%5D');
    expect(location).toContain('api_key=%5Bredacted%5D');
  });

  it('omits hash fragments', () => {
    window.history.replaceState({}, '', '/docs/overview#section');
    expect(safePageLocation()).toBe('/docs/overview');
  });
});
