import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the agents-api helper and the m365-agent connector logic.
 * We mock `fetch` globally and the cache/oauth modules.
 */

// ── Mock cache module ───────────────────────────────────────────────────────

vi.mock("../cache.js", () => ({
  getOAuthTokens: vi.fn(),
  setOAuthTokens: vi.fn(),
  setSyncCache: vi.fn()
}));

vi.mock("../oauth.js", () => ({
  runOAuthFlow: vi.fn(),
  refreshAccessToken: vi.fn()
}));

import { getOAuthTokens, setSyncCache } from "../cache.js";
import { agentsFetch, readAgentsConfig } from "../agents-api.js";
import { m365AgentConnector } from "../connectors/m365-agent.js";
import type { ConnectorContext } from "../types.js";

const mockGetOAuthTokens = vi.mocked(getOAuthTokens);
const mockSetSyncCache = vi.mocked(setSyncCache);

function makeCtx(overrides: Partial<ConnectorContext["config"]> = {}): ConnectorContext {
  return {
    instanceId: "test-instance-1",
    config: {
      tenant: "common",
      clientId: "test-client-id",
      agentId: "test-agent-id",
      ...overrides
    }
  };
}

function validTokens() {
  return {
    accessToken: "test-access-token",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    scope: "ChatMessage.Send Chat.ReadWrite User.Read"
  };
}

describe("readAgentsConfig", () => {
  it("reads config with defaults", () => {
    const ctx = makeCtx();
    const cfg = readAgentsConfig(ctx, ["User.Read"]);
    expect(cfg.tenant).toBe("common");
    expect(cfg.clientId).toBe("test-client-id");
    expect(cfg.agentId).toBe("test-agent-id");
    expect(cfg.baseUrl).toBe("https://graph.microsoft.com/beta");
  });

  it("rejects disallowed endpoint hosts", () => {
    const ctx = makeCtx({ endpoint: "https://evil.example.com/v1" });
    expect(() => readAgentsConfig(ctx, ["User.Read"])).toThrow("not in the allowed list");
  });

  it("rejects non-HTTPS endpoints", () => {
    const ctx = makeCtx({ endpoint: "http://graph.microsoft.com/beta" });
    expect(() => readAgentsConfig(ctx, ["User.Read"])).toThrow("Only HTTPS");
  });

  it("accepts allowed hosts", () => {
    const ctx = makeCtx({ endpoint: "https://graph.microsoft.com/v1.0" });
    const cfg = readAgentsConfig(ctx, ["User.Read"]);
    expect(cfg.baseUrl).toBe("https://graph.microsoft.com/v1.0");
  });
});

describe("agentsFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockGetOAuthTokens.mockResolvedValue(validTokens());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("makes authenticated GET requests", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ displayName: "Test User" }),
      headers: new Map()
    });

    const ctx = makeCtx();
    const result = await agentsFetch<{ displayName: string }>(ctx, ["User.Read"], "/me");
    expect(result.displayName).toBe("Test User");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain("/me");
    expect(opts.headers.Authorization).toBe("Bearer test-access-token");
  });

  it("retries on 429 for GET requests", async () => {
    const headers = new Map([["Retry-After", "0"]]);
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, headers, text: async () => "rate limited" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "ok" }), headers: new Map() });

    const ctx = makeCtx();
    const result = await agentsFetch<{ id: string }>(ctx, ["User.Read"], "/test", { maxRetries: 1 });
    expect(result.id).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry POST by default", async () => {
    const headers = new Map([["Retry-After", "1"]]);
    fetchMock.mockResolvedValue({ ok: false, status: 429, headers, text: async () => "rate limited" });

    const ctx = makeCtx();
    await expect(
      agentsFetch(ctx, ["User.Read"], "/test", { method: "POST", body: { x: 1 } })
    ).rejects.toThrow("429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when not authorized", async () => {
    mockGetOAuthTokens.mockResolvedValue(null);
    const ctx = makeCtx();
    await expect(agentsFetch(ctx, ["User.Read"], "/me")).rejects.toThrow("Not authorized");
  });
});

describe("m365AgentConnector.callTool", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockGetOAuthTokens.mockResolvedValue(validTokens());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns error for unknown tool", async () => {
    const ctx = makeCtx();
    const result = await m365AgentConnector.callTool(ctx, "nonexistent.tool", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });

  it("returns error when message is empty for invoke", async () => {
    const ctx = makeCtx();
    const result = await m365AgentConnector.callTool(ctx, "m365agent.invoke", { message: "" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("message is required");
  });

  it("routes m365agent.threads.list correctly", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ value: [{ id: "thread-1", topic: "Test", lastUpdatedDateTime: "2026-01-01T00:00:00Z" }] }),
      headers: new Map()
    });
    const ctx = makeCtx();
    const result = await m365AgentConnector.callTool(ctx, "m365agent.threads.list", { top: 5 });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.output)).toBe(true);
  });

  it("returns error when threadId missing for threads.read", async () => {
    const ctx = makeCtx();
    const result = await m365AgentConnector.callTool(ctx, "m365agent.threads.read", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("threadId is required");
  });
});

describe("m365AgentConnector.sync", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockGetOAuthTokens.mockResolvedValue(validTokens());
    mockSetSyncCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns typed sync data and writes cache", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        value: [
          { id: "t1", topic: "Recap", lastUpdatedDateTime: "2026-01-01T10:00:00Z" },
          { id: "t2", topic: "Planning", createdDateTime: "2026-01-01T09:00:00Z" }
        ]
      }),
      headers: new Map()
    });

    const ctx = makeCtx();
    const data = await m365AgentConnector.sync!(ctx);
    expect(data.kind).toBe("custom");
    expect(data.integrationId).toBe("test-instance-1");
    expect((data.raw as { type: string }).type).toBe("m365-agent.activity.v1");
    expect((data.raw as { threads: unknown[] }).threads).toHaveLength(2);
    expect(mockSetSyncCache).toHaveBeenCalledWith("test-instance-1", data);
  });

  it("returns empty threads on fetch failure (best-effort)", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));

    const ctx = makeCtx();
    const data = await m365AgentConnector.sync!(ctx);
    expect(data.kind).toBe("custom");
    expect((data.raw as { threads: unknown[] }).threads).toHaveLength(0);
  });
});
