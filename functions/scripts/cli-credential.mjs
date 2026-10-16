import { createRequire } from 'node:module';
import { join } from 'node:path';

// Use only an explicitly selected, already-authorized CLI account. Never write tokens.
export function createCliCredential(cliPath, email) {
  process.env.DEBUG = '';
  const require = createRequire(import.meta.url);
  const cliAuth = require(join(cliPath, 'lib/auth.js'));
  const cliApi = require(join(cliPath, 'lib/api.js'));
  const account = cliAuth.findAccountByEmail(email);
  if (!account?.tokens?.refresh_token) throw new Error('Sign in to the selected Firebase CLI account first.');
  let cached;
  return { async getAccessToken() {
    if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;
    // OAuth refresh is form-encoded; do not use the CLI's multipart refresh fallback.
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: account.tokens.refresh_token,
        client_id: cliApi.clientId(), client_secret: cliApi.clientSecret() }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 60) {
      throw new Error('Firebase CLI account refresh failed. Reauthenticate the selected account.');
    }
    const token = { access_token: data.access_token, expires_in: data.expires_in };
    cached = { token, expiresAt: Date.now() + data.expires_in * 1000 };
    return token;
  } };
}
