import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';

/** True when build-time OIDC settings look configured (not empty / placeholders). */
export function isOidcConfigured(): boolean {
  const { issuer, clientId } = environment.oidc;
  if (!issuer || !clientId) return false;
  if (issuer.includes('${') || clientId.includes('${')) return false;
  return true;
}

export function buildAuthConfig(): AuthConfig {
  const config: AuthConfig = {
    issuer: environment.oidc.issuer,
    clientId: environment.oidc.clientId,
    redirectUri: environment.oidc.redirectUri,
    responseType: 'code',
    scope: 'openid profile email',
    showDebugInformation: !environment.production,
    requireHttps: environment.production,
    strictDiscoveryDocumentValidation: environment.production,
  };
  if (environment.oidc.audience) {
    config.customQueryParams = { audience: environment.oidc.audience };
  }
  return config;
}
