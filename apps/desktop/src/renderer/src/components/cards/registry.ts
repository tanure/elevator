import { createElement, type ComponentType } from "react";
import type { ExtensionRecord } from "@elevator/shared";
import { ExtensionCard } from "./ExtensionCard";

export interface CardDefinition {
  id: string;
  title: string;
  Component: ComponentType;
}

const registry = new Map<string, CardDefinition>();

export function registerCard(def: CardDefinition): void {
  registry.set(def.id, def);
}

export function getCard(id: string): CardDefinition | undefined {
  return registry.get(id);
}

export function listBuiltInCardDefs(): CardDefinition[] {
  return Array.from(registry.values());
}

/**
 * Build a combined list of card definitions for picker/selection UI:
 * built-in cards followed by one synthesised definition per enabled
 * extension. Disabled extensions are skipped.
 */
export function listAllCardDefs(extensions: ExtensionRecord[]): CardDefinition[] {
  const builtins = listBuiltInCardDefs();
  const ext = extensions
    .filter((e) => e.isEnabled && e.kind === "card")
    .map<CardDefinition>((e) => ({
      id: `extension:${e.id}`,
      title: e.title,
      Component: () => createElement(ExtensionCard, { extension: e })
    }));
  return [...builtins, ...ext];
}

/**
 * Resolve a card id (which may be `extension:<id>` or a view-context id)
 * against the registry, falling back to a synthesized definition when an
 * extension matches.
 */
export function resolveCardDef(
  cardId: string,
  extensions: ExtensionRecord[]
): CardDefinition | undefined {
  const direct = registry.get(cardId);
  if (direct) return direct;
  if (cardId.startsWith("extension:")) {
    const extId = cardId.slice("extension:".length);
    const ext = extensions.find((e) => e.id === extId);
    if (!ext) return undefined;
    return {
      id: cardId,
      title: ext.title,
      Component: () => createElement(ExtensionCard, { extension: ext })
    };
  }
  return undefined;
}

