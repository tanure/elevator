import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { shell } from "electron";

/**
 * Minimal PKCE loopback OAuth helper for desktop apps.
 *
 * Flow:
 *   1. Spin up an ephemeral HTTP server on 127.0.0.1 (random free port).
 *   2. Generate a PKCE verifier + S256 challenge and a CSRF state token.
 *   3. Open the provider authorize URL in the user's default browser.
 *   4. Wait for the redirect to `http://127.0.0.1:<port>/callback`.
 *   5. Validate `state`, exchange the `code` for tokens, return them.
 *
 * Bound only to loopback. No state crosses Electron's renderer.
 */

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  scopes: string[];
  /** Provider redirect must be registered as `http://127.0.0.1/<callbackPath>` */
  callbackPath?: string;
  /** Extra params merged into the authorize URL (e.g. `prompt=select_account`). */
  extraAuthParams?: Record<string, string>;
  /** Wait this many ms before giving up. Defaults to 5 minutes. */
  timeoutMs?: number;
}

export interface OAuthResult {
  ok: boolean;
  message: string;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
    scope?: string;
    tokenType?: string;
  };
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makePkce(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export async function runOAuthFlow(cfg: OAuthConfig): Promise<OAuthResult> {
  const callbackPath = cfg.callbackPath ?? "/callback";
  const timeoutMs = cfg.timeoutMs ?? 5 * 60_000;
  const state = base64UrlEncode(randomBytes(16));
  const { verifier, challenge } = makePkce();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: OAuthResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        server.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, message: "Authorization timed out." }),
      timeoutMs
    );

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1`);
        if (url.pathname !== callbackPath) {
          res.writeHead(404).end("Not found");
          return;
        }
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
          finish({ ok: false, message: `Provider returned error: ${error}` });
          return;
        }
        if (!code || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Invalid response</h1>");
          finish({ ok: false, message: "Invalid authorization response (state mismatch)." });
          return;
        }

        // Exchange code → tokens.
        const port = (server.address() as AddressInfo).port;
        const redirectUri = `http://127.0.0.1:${port}${callbackPath}`;
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: cfg.clientId,
          code_verifier: verifier
        });
        const tokenRes = await fetch(cfg.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body
        });
        if (!tokenRes.ok) {
          const text = await tokenRes.text();
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>Token exchange failed</h1><pre>${text}</pre>`);
          finish({ ok: false, message: `Token exchange failed: ${tokenRes.status}` });
          return;
        }
        const payload = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          scope?: string;
          token_type?: string;
        };
        const expiresAt = new Date(
          Date.now() + (payload.expires_in ?? 3600) * 1000
        ).toISOString();
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Authorization complete</h1><p>You can close this window and return to Elevator.</p>"
        );
        finish({
          ok: true,
          message: "Authorization successful.",
          tokens: {
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt,
            scope: payload.scope,
            tokenType: payload.token_type
          }
        });
      } catch (err) {
        try {
          res.writeHead(500).end("Internal error");
        } catch {
          // ignore
        }
        finish({
          ok: false,
          message: err instanceof Error ? err.message : String(err)
        });
      }
    });

    server.on("error", (err) =>
      finish({ ok: false, message: `Loopback server error: ${err.message}` })
    );

    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      const redirectUri = `http://127.0.0.1:${port}${callbackPath}`;
      const params = new URLSearchParams({
        response_type: "code",
        client_id: cfg.clientId,
        redirect_uri: redirectUri,
        scope: cfg.scopes.join(" "),
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        ...(cfg.extraAuthParams ?? {})
      });
      const authorizeUrl = `${cfg.authorizeUrl}?${params.toString()}`;
      void shell.openExternal(authorizeUrl);
    });
  });
}

/**
 * Refresh an OAuth access token. Returns null on failure (caller should
 * trigger a fresh `runOAuthFlow`).
 */
export async function refreshAccessToken(
  tokenUrl: string,
  clientId: string,
  refreshToken: string,
  scopes?: string[]
): Promise<OAuthResult["tokens"] | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId
  });
  if (scopes && scopes.length > 0) body.set("scope", scopes.join(" "));
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: payload.scope,
    tokenType: payload.token_type
  };
}
