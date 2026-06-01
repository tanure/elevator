/**
 * GitHub OAuth device flow used to obtain a Copilot-capable token without
 * requiring the `gh` CLI. The client id below is the well-known public
 * OAuth client used by the official Copilot editor integrations; the device
 * flow is anonymous and safe to embed.
 *
 * Docs: https://docs.github.com/apps/oauth/authenticating-with-a-github-app/authorizing-oauth-apps#device-flow
 */

const GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const SCOPE = "read:user";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

const HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "Elevator-Desktop"
} as const;

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: SCOPE })
  });
  if (!res.ok) {
    throw new Error(
      `GitHub device-code request failed: ${res.status} ${res.statusText}`
    );
  }
  const json = (await res.json()) as Partial<DeviceCodeResponse> & {
    error?: string;
    error_description?: string;
  };
  if (json.error) {
    throw new Error(json.error_description ?? json.error);
  }
  if (
    !json.device_code ||
    !json.user_code ||
    !json.verification_uri ||
    typeof json.interval !== "number" ||
    typeof json.expires_in !== "number"
  ) {
    throw new Error("Malformed device-code response from GitHub");
  }
  return {
    device_code: json.device_code,
    user_code: json.user_code,
    verification_uri: json.verification_uri,
    interval: json.interval,
    expires_in: json.expires_in
  };
}

export type PollOutcome =
  | { kind: "pending" }
  | { kind: "slow_down"; interval: number }
  | { kind: "success"; token: string }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export async function pollDeviceCode(deviceCode: string): Promise<PollOutcome> {
  let res: Response;
  try {
    res = await fetch(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      })
    });
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err)
    };
  }

  if (!res.ok) {
    return {
      kind: "error",
      message: `GitHub token poll failed: ${res.status} ${res.statusText}`
    };
  }

  const json = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    interval?: number;
  };

  if (json.access_token) {
    return { kind: "success", token: json.access_token };
  }

  switch (json.error) {
    case "authorization_pending":
      return { kind: "pending" };
    case "slow_down":
      return { kind: "slow_down", interval: json.interval ?? 5 };
    case "expired_token":
      return { kind: "expired" };
    case "access_denied":
      return { kind: "denied" };
    default:
      return {
        kind: "error",
        message: json.error_description ?? json.error ?? "Unknown GitHub error"
      };
  }
}
