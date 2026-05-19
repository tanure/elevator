import type { ComponentType } from "react";

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
