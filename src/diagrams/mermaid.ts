import type { ArchitectureDocument } from '../generation/schemas.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('diagrams');

export interface DiagramSet {
  componentDiagram: string;
  containerDiagram: string;
  dataFlowDiagram: string;
  contextDiagram: string;
}

/**
 * Generate Mermaid diagrams directly from architecture data.
 * No LLM call — purely deterministic transformation.
 */
export function generateDiagrams(
  arch: ArchitectureDocument,
  projectName: string = 'System',
): DiagramSet {
  return {
    componentDiagram: generateComponentDiagram(arch),
    containerDiagram: generateContainerDiagram(arch, projectName),
    dataFlowDiagram: generateDataFlowDiagram(arch),
    contextDiagram: generateContextDiagram(arch, projectName),
  };
}

function generateComponentDiagram(arch: ArchitectureDocument): string {
  let mermaid = 'graph TD\n';

  // Group components by layer
  const layers = new Map<string, string[]>();
  for (const comp of arch.components) {
    if (!layers.has(comp.layer)) layers.set(comp.layer, []);
    layers.get(comp.layer)!.push(comp.name);
  }

  // Create subgraphs per layer
  const layerOrder = ['interface', 'application', 'domain', 'infrastructure'];
  for (const layer of layerOrder) {
    const components = layers.get(layer);
    if (!components || components.length === 0) continue;
    const safeLayer = layer.charAt(0).toUpperCase() + layer.slice(1);
    mermaid += `    subgraph ${safeLayer}\n`;
    for (const comp of components) {
      const safeId = comp.replace(/[^a-zA-Z0-9]/g, '_');
      mermaid += `        ${safeId}[${comp}]\n`;
    }
    mermaid += '    end\n';
  }

  // Add dependency edges
  for (const edge of arch.dependencyGraph) {
    const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `    ${fromId} --> ${toId}\n`;
  }

  log.debug(
    { components: arch.components.length, edges: arch.dependencyGraph.length },
    'Component diagram generated',
  );
  return mermaid;
}

function generateContainerDiagram(arch: ArchitectureDocument, projectName: string): string {
  let mermaid = 'graph TB\n';
  mermaid += `    subgraph "${projectName}"\n`;

  for (const comp of arch.components) {
    const safeId = comp.name.replace(/[^a-zA-Z0-9]/g, '_');
    const shape = comp.layer === 'infrastructure' ? `[(${comp.name})]` : `[${comp.name}]`;
    mermaid += `        ${safeId}${shape}\n`;
  }

  mermaid += '    end\n';

  // External dependencies (inferred from infrastructure layer)
  const infraComponents = arch.components
    .filter((c) => c.layer === 'infrastructure')
    .map((c) => c.name);

  for (const infra of infraComponents) {
    const safeId = infra.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `    ${safeId} -.-> DB[(Database)]\n`;
  }

  return mermaid;
}

function generateDataFlowDiagram(arch: ArchitectureDocument): string {
  let mermaid = 'flowchart LR\n';

  // Show data flow following dependency direction
  for (const edge of arch.dependencyGraph) {
    const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `    ${fromId} -->|uses| ${toId}\n`;
  }

  // If no edges, show components linearly
  if (arch.dependencyGraph.length === 0) {
    const names = arch.components.map((c) => c.name.replace(/[^a-zA-Z0-9]/g, '_'));
    for (let i = 0; i < names.length - 1; i++) {
      mermaid += `    ${names[i]} --> ${names[i + 1]}\n`;
    }
  }

  return mermaid;
}

function generateContextDiagram(arch: ArchitectureDocument, projectName: string): string {
  let mermaid = 'graph TB\n';

  // System boundary
  const safeProject = projectName.replace(/[^a-zA-Z0-9]/g, '_');
  mermaid += `    ${safeProject}[("${projectName}")]\n`;

  // Bounded contexts as external systems/actors
  for (const bc of arch.boundedContexts) {
    const safeId = bc.name.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `    ${safeId}[${bc.name}]\n`;
    mermaid += `    ${safeId} --> ${safeProject}\n`;
  }

  // Add user actor
  mermaid += '    User((User))\n';
  mermaid += `    User --> ${safeProject}\n`;

  return mermaid;
}

/**
 * Basic Mermaid syntax validation — checks for common issues.
 * Does NOT render — just validates structure.
 */
export function validateMermaid(source: string): { valid: boolean; error?: string } {
  if (!source.trim()) return { valid: false, error: 'Empty diagram' };

  const firstLine = source.trim().split('\n')[0].trim();
  const validStarts = [
    'graph ',
    'flowchart ',
    'sequenceDiagram',
    'classDiagram',
    'erDiagram',
    'gantt',
    'pie',
  ];
  if (!validStarts.some((s) => firstLine.startsWith(s))) {
    return { valid: false, error: `Invalid diagram type: "${firstLine}"` };
  }

  // Check for unmatched brackets
  const open = (source.match(/\[/g) || []).length;
  const close = (source.match(/\]/g) || []).length;
  if (open !== close) {
    return { valid: false, error: `Unmatched brackets: ${open} open, ${close} close` };
  }

  return { valid: true };
}
