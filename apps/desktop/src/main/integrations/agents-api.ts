import { getOAuthTokens, setOAuthTokens } from "./cache.js";
import { refreshAccessToken, runOAuthFlow, type OAuthResult } from "./oauth.js";
import type { ConnectorContext } from "./types.js";

/**
 * Microsoft 365 Agents API helper — isolated from the Graph helper so that
 * token caches and scopes remain separate from Calendar/Mail connectors.
 *
 * Token isolation is naturally achieved because each integration instance has
 * its own cache file keyed by `instanceId`.
 *
 * The default base URL targets the Graph beta surface where the Agents API is
 * currently exposed. An endpoint override is accepted only if it belongs to a
 * known Microsoft host (security: prevents bearer token exfiltration to
 * arbitrary endpoints).
 */

const DEFAULT_BASE_URL = "https://graph.microsoft.com/beta";

const ALLOWED_HOSTS = new Set([
  "graph.microsoft.com",
  "substrate.office.com",
  "api.microsoft.com"
]);

export interface AgentsConfig {
  tenant: string;
  clientId: string;
  scopes: string[];
  agentId: string;
  baseUrl: string;
}

function authorizeUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
}

function tokenUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

function resolveBaseUrl(endpoint?: string): string {
  if (!endpoint) return DEFAULT_BASE_URL;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS endpoints are allowed.");
    }
    if (!ALLOWED_HOSTS.has(url.hostname)) {
      throw new Error(
        `Endpoint host "${url.hostname}" is not in the allowed list. ` +
          `Allowed: ${[...ALLOWED_HOSTS].join(", ")}.`
      );
    }
    return endpoint.replace(/\/$/, "");
  } catch (err) {
    if (err instanceof Error && err.message.includes("allowed")) throw err;
    throw new Error(`Invalid endpoint URL: ${endpoint}`);
  }
}

export function readAgentsConfig(ctx: ConnectorContext, scopes: string[]): AgentsConfig {
  return {
    tenant: String(ctx.config.tenant ?? "common"),
    clientId: String(ctx.config.clientId ?? ""),
    agentId: String(ctx.config.agentId ?? ""),
    scopes,
    baseUrl: resolveBaseUrl(ctx.config.endpoint as string | undefined)
  };
}

export async function ensureAgentsConnect(
  ctx: ConnectorContext,
  defaultScopes: string[]
): Promise<{ ok: boolean; message: string }> {
  const cfg = readAgentsConfig(ctx, defaultScopes);
  if (!cfg.clientId) return { ok: false, message: "Application (client) id is required." };
  if (!cfg.agentId) return { ok: false, message: "Agent id is required." };

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

async function getAccessToken(ctx: ConnectorContext, scopes: string[]): Promise<string | null> {
  const cfg = readAgentsConfig(ctx, scopes);
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

/**
 * Parse Retry-After header (supports seconds or HTTP-date).
 * Returns delay in milliseconds, or null if not parseable.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

export interface AgentsFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string>;
  maxRetries?: number;
}

/**
 * Authenticated fetch against the Agents API surface with automatic retry on
 * 429 (rate-limited) and 503 (service unavailable). Only retries safe
 * operations (GET) by default — POST retries are opt-in via maxRetries > 0
 * and should include idempotency headers where the API supports them.
 */
export async function agentsFetch<T>(
  ctx: ConnectorContext,
  scopes: string[],
  path: string,
  opts: AgentsFetchOptions = {}
): Promise<T> {
  const token = await getAccessToken(ctx, scopes);
  if (!token) throw new Error("Not authorized. Run Connect to sign in.");

  const cfg = readAgentsConfig(ctx, scopes);
  const url = new URL(`${cfg.baseUrl}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }

  const method = opts.method ?? "GET";
  const maxRetries = opts.maxRetries ?? (method === "GET" ? 2 : 0);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    };
    if (opts.body) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });

    if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
      const delay = parseRetryAfter(res.headers.get("Retry-After")) ?? (attempt + 1) * 2000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 30_000)));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agents API ${res.status}: ${text.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  }

  throw new Error("Agents API request failed after retries.");
}
