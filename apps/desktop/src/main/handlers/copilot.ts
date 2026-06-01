import { ipcMain } from "electron";
import type {
  CopilotAuthStatus,
  CopilotDeviceLogin,
  CopilotDeviceLoginPoll,
  CopilotModel,
  CopilotStatus
} from "@elevator/shared";
import {
  clearCopilotToken,
  encryptionAvailable,
  getCopilotEndpoint,
  getCopilotModel,
  hasCopilotToken,
  setCopilotEndpoint,
  setCopilotModel,
  setCopilotToken
} from "../ai/copilot-token.js";
import { setActiveProvider } from "../ai/registry.js";
import {
  getCopilotClient,
  shutdownCopilotProvider
} from "../ai/copilot-provider.js";
import {
  pollDeviceCode,
  requestDeviceCode
} from "../ai/github-device-flow.js";

export function registerCopilotHandlers(): void {
  ipcMain.handle("copilot:getStatus", async (): Promise<CopilotStatus> => {
    const [configured, model, endpoint] = await Promise.all([
      hasCopilotToken(),
      getCopilotModel(),
      getCopilotEndpoint()
    ]);
    return {
      configured,
      encryptionAvailable: encryptionAvailable(),
      model,
      endpoint
    };
  });

  ipcMain.handle("copilot:setToken", async (_e, token: string): Promise<void> => {
    await setCopilotToken(token);
    // Drop the cached client so the new token is picked up on next call.
    await shutdownCopilotProvider();
    try {
      setActiveProvider("copilot");
    } catch {
      /* provider not registered yet — startup will pick it up */
    }
  });

  ipcMain.handle("copilot:clearToken", async (): Promise<void> => {
    await clearCopilotToken();
    await shutdownCopilotProvider();
    try {
      setActiveProvider("echo");
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle("copilot:setModel", async (_e, model: string): Promise<void> => {
    await setCopilotModel(model);
  });

  ipcMain.handle(
    "copilot:setEndpoint",
    async (_e, endpoint: string): Promise<void> => {
      await setCopilotEndpoint(endpoint);
    }
  );

  ipcMain.handle(
    "copilot:getAuthStatus",
    async (): Promise<CopilotAuthStatus> => {
      try {
        const client = await getCopilotClient();
        const status = await client.getAuthStatus();
        return {
          isAuthenticated: status.isAuthenticated,
          ...(status.authType !== undefined && { authType: status.authType }),
          ...(status.host !== undefined && { host: status.host }),
          ...(status.login !== undefined && { login: status.login }),
          ...(status.statusMessage !== undefined && {
            statusMessage: status.statusMessage
          })
        };
      } catch (err) {
        return {
          isAuthenticated: false,
          statusMessage: err instanceof Error ? err.message : String(err)
        };
      }
    }
  );

  ipcMain.handle(
    "copilot:listModels",
    async (): Promise<CopilotModel[]> => {
      const client = await getCopilotClient();
      const models = await client.listModels();
      return models.map((m) => ({
        id: m.id,
        name: m.name,
        ...(m.policy?.state && { policy: m.policy.state }),
        ...(m.billing?.multiplier !== undefined && {
          multiplier: m.billing.multiplier
        }),
        ...(m.capabilities?.limits?.max_context_window_tokens !== undefined && {
          maxContextWindowTokens: m.capabilities.limits.max_context_window_tokens
        }),
        ...(m.capabilities?.supports?.vision !== undefined && {
          supportsVision: m.capabilities.supports.vision
        })
      }));
    }
  );

  ipcMain.handle(
    "copilot:startDeviceLogin",
    async (): Promise<CopilotDeviceLogin> => {
      const res = await requestDeviceCode();
      return {
        deviceCode: res.device_code,
        userCode: res.user_code,
        verificationUri: res.verification_uri,
        interval: res.interval,
        expiresIn: res.expires_in
      };
    }
  );

  ipcMain.handle(
    "copilot:pollDeviceLogin",
    async (_e, deviceCode: string): Promise<CopilotDeviceLoginPoll> => {
      const outcome = await pollDeviceCode(deviceCode);
      switch (outcome.kind) {
        case "pending":
          return { status: "pending" };
        case "slow_down":
          return { status: "slow_down", interval: outcome.interval };
        case "expired":
          return { status: "expired" };
        case "denied":
          return { status: "denied" };
        case "error":
          return { status: "error", error: outcome.message };
        case "success": {
          // Persist the token using the same path as the manual flow so the
          // provider picks it up and the rest of the app behaves identically.
          await setCopilotToken(outcome.token);
          await shutdownCopilotProvider();
          try {
            setActiveProvider("copilot");
          } catch {
            /* provider not registered yet — startup will pick it up */
          }
          // Try to fetch the login name for a friendlier UI message; failures
          // are non-fatal.
          let login: string | undefined;
          try {
            const client = await getCopilotClient();
            const status = await client.getAuthStatus();
            if (status.login) login = status.login;
          } catch {
            /* ignore */
          }
          return login ? { status: "success", login } : { status: "success" };
        }
      }
    }
  );
}
