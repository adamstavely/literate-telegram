export const environment = {
  production: false,
  /** Astro docs dev server; empty in production (nginx serves /docs on the same host). */
  docsOrigin: 'http://localhost:4321',
  apiBaseUrl: 'http://localhost:3000/api',
  oidc: {
    issuer: '',
    clientId: '',
    redirectUri: 'http://localhost:4200/callback',
    audience: '',
  },
};
