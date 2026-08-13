import type { AgentDefinition } from './contract.js';

const registry = new Map<string, AgentDefinition<any, any>>();

export function registerAgent<I, O>(def: AgentDefinition<I, O>): void {
  registry.set(def.id, def);
}

export function getAgentDefinition(id: string): AgentDefinition<any, any> | undefined {
  return registry.get(id);
}

export function listAgentDefinitions(): AgentDefinition<any, any>[] {
  return Array.from(registry.values());
}
