import { getOAuthTokens, setOAuthTokens } from "./cache.js";
import { refreshAccessToken, runOAuthFlow, type OAuthResult } from "./oauth.js";
import type { ConnectorContext } from "./types.js";

/**
 * Shared Microsoft Graph helper for the M365 connectors.
 *
 * Auth: OAuth 2.0 authorization-code + PKCE against the v2.0 endpoint, with
 * loopback redirect handled by `runOAuthFlow`. Refresh tokens are cached
 * per-instance via `cache.ts`.
 *
 * The user supplies their own application (client) id from the Azure portal
 * — Elevator does not ship a default client id, since multi-tenant public
 * clients require explicit registration.
 */

export interface GraphConfig {
  tenant: string; // "common" | "organizations" | tenant id/domain
  clientId: string;
  scopes: string[];
}

function authorizeUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
}

function tokenUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

function readGraphConfig(ctx: ConnectorContext, defaultScopes: string[]): GraphConfig {
  return {
    tenant: String(ctx.config.tenant ?? "common"),
    clientId: String(ctx.config.clientId ?? ""),
    scopes: defaultScopes
  };
}

export async function ensureGraphConnect(
  ctx: ConnectorContext,
  defaultScopes: string[]
): Promise<{ ok: boolean; message: string }> {
  const cfg = readGraphConfig(ctx, defaultScopes);
  if (!cfg.clientId) return { ok: false, message: "Microsoft application (client) id is required." };
  const tokens = await getOAuthTokens(ctx.instanceId);
  if (tokens && new Date(tokens.expiresAt).getTime() > Date.now() + 60_000) {
    return { ok: true, message: "Already authorized." };
  }
  if (tokens?.refreshToken) {
    const refreshed = await refreshAccessToken(
      tokenUrl(cfg.tenant),
      cfg.clientId,
      tokens.refreshToken,
      cfg.scopes
    );
    if (refreshed) {
      await setOAuthTokens(ctx.instanceId, refreshed);
      return { ok: true, message: "Refreshed token." };
    }
  }
  const result: OAuthResult = await runOAuthFlow({
    authorizeUrl: authorizeUrl(cfg.tenant),
    tokenUrl: tokenUrl(cfg.tenant),
    clientId: cfg.clientId,
    scopes: [...cfg.scopes, "offline_access"],
    extraAuthParams: { prompt: "select_account" }
  });
  if (!result.ok || !result.tokens) {
    return { ok: false, message: result.message };
  }
  await setOAuthTokens(ctx.instanceId, result.tokens);
  return { ok: true, message: "Authorized." };
}

async function getAccessToken(ctx: ConnectorContext, defaultScopes: string[]): Promise<string | null> {
  const cfg = readGraphConfig(ctx, defaultScopes);
  let tokens = await getOAuthTokens(ctx.instanceId);
  if (tokens && new Date(tokens.expiresAt).getTime() < Date.now() + 60_000 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken(
      tokenUrl(cfg.tenant),
      cfg.clientId,
      tokens.refreshToken,
      cfg.scopes
    );
    if (refreshed) {
      await setOAuthTokens(ctx.instanceId, refreshed);
      tokens = refreshed;
    }
  }
  return tokens?.accessToken ?? null;
}

export async function graphFetch<T>(
  ctx: ConnectorContext,
  defaultScopes: string[],
  path: string,
  query?: Record<string, string>
): Promise<T> {
  const token = await getAccessToken(ctx, defaultScopes);
  if (!token) throw new Error("Not authorized. Run Connect to sign in.");
  const url = new URL(`https://graph.microsoft.com/v1.0${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}
