export const environment = {
  production: true,
  docsOrigin: '',
  apiBaseUrl: '/api',
  oidc: {
    issuer: '${OIDC_ISSUER}',
    clientId: '${OIDC_CLIENT_ID}',
    redirectUri: '${APP_URL}/callback',
    audience: '${OIDC_AUDIENCE}',
  },
};
