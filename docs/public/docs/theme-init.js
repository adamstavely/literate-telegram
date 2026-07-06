// Theme boot for the docs site. Loaded as an external, same-origin script from
// <head> so it runs render-blocking (no FOUC) while remaining compatible with a
// strict `script-src 'self'` CSP — an inline <script> would be blocked. Keep in
// sync with the Angular app's theme storage (localStorage['interop-theme']).
(function () {
  try {
    var raw = localStorage.getItem('interop-theme');
    if (!raw) return;
    var theme = JSON.parse(raw);
    var mode = theme.mode;
    if (mode === 'system') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (mode === 'light' || mode === 'dark') {
      document.documentElement.setAttribute('data-theme', mode);
    }
    if (theme.accent && theme.accent !== 'cobalt') {
      document.documentElement.setAttribute('data-accent', theme.accent);
    }
  } catch (_) {}
})();
