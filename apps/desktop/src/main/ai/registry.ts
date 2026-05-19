import type { AiProviderName } from "@elevator/shared";
import type { AiProvider } from "./provider.js";
import { echoProvider } from "./echo-provider.js";
import { copilotProvider } from "./copilot-provider.js";

const providers = new Map<AiProviderName, AiProvider>();
let activeProvider: AiProviderName = "echo";

export function registerProvider(p: AiProvider): void {
  providers.set(p.name, p);
}

export function getProvider(name?: AiProviderName): AiProvider {
  const resolved = name ?? activeProvider;
  const p = providers.get(resolved);
  if (!p) throw new Error(`AI provider not registered: ${resolved}`);
  return p;
}

export function setActiveProvider(name: AiProviderName): void {
  if (!providers.has(name)) throw new Error(`Unknown provider: ${name}`);
  activeProvider = name;
}

export function getActiveProvider(): AiProviderName {
  return activeProvider;
}

export function listProviders(): AiProviderName[] {
  return [...providers.keys()];
}

export function ensureProvidersRegistered(): void {
  if (providers.size === 0) {
    registerProvider(echoProvider);
    registerProvider(copilotProvider);
  }
}
