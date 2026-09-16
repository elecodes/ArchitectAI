import type { ArchitectureDocument } from '../generation/schemas.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('archify');

/**
 * Archify JSON IR (Intermediate Representation) Specification
 */
export interface ArchifyNode {
  id: string;
  label: string;
  role: 'interface' | 'application' | 'domain' | 'infrastructure' | 'database' | 'external';
  layer: string;
  responsibilities: string[];
  boundedContext?: string;
}

export interface ArchifyEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  flowType?: 'sync' | 'async' | 'data';
}

export interface ArchifyCluster {
  id: string;
  name: string;
  nodes: string[];
  responsibilities?: string[];
}

export interface ArchifyStoryChapter {
  id: string;
  title: string;
  description: string;
  activeNodes: string[];
  activeEdges: string[];
}

export interface ArchifyDiagramIR {
  version: '2.17.0';
  meta: {
    title: string;
    description: string;
    preset: 'signal-flow' | 'blueprint' | 'classic' | 'minimal';
    theme: 'dark' | 'light';
    solidNotes?: string[];
  };
  nodes: ArchifyNode[];
  edges: ArchifyEdge[];
  clusters: ArchifyCluster[];
  stories: ArchifyStoryChapter[];
}

/**
 * Deterministically transforms an ArchitectureDocument into an Archify Diagram IR.
 */
export function generateArchifyIR(
  arch: ArchitectureDocument,
  projectName: string = 'System Architecture'
): ArchifyDiagramIR {
  const sanitizeId = (name: string) => name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const components = Array.isArray(arch.components) ? arch.components : [];
  const dependencyGraph = Array.isArray(arch.dependencyGraph) ? arch.dependencyGraph : [];
  const boundedContexts = Array.isArray(arch.boundedContexts) ? arch.boundedContexts : [];

  // Map components to Archify Nodes
  const nodes: ArchifyNode[] = components.map((comp) => {
    let role: ArchifyNode['role'] = comp.layer;
    if (comp.layer === 'infrastructure' && comp.name.toLowerCase().includes('data')) {
      role = 'database';
    }

    return {
      id: sanitizeId(comp.name),
      label: comp.name,
      role,
      layer: comp.layer,
      responsibilities: comp.responsibilities || [],
    };
  });

  // Map dependency graph to Archify Edges
  const edges: ArchifyEdge[] = dependencyGraph.map((edge, idx) => ({
    id: `edge_${idx}_${sanitizeId(edge.from)}_${sanitizeId(edge.to)}`,
    from: sanitizeId(edge.from),
    to: sanitizeId(edge.to),
    label: 'uses',
    flowType: 'sync',
  }));

  // Map Bounded Contexts to Clusters
  const clusters: ArchifyCluster[] = boundedContexts.map((bc) => {
    const clusterId = sanitizeId(bc.name);
    // Find nodes matching bc aggregates or name
    const clusterNodes = nodes
      .filter(
        (node) =>
          (bc.aggregates || []).some((agg) => node.label.toLowerCase().includes(agg.toLowerCase())) ||
          node.label.toLowerCase().includes(bc.name.toLowerCase())
      )
      .map((n) => n.id);

    return {
      id: clusterId,
      name: bc.name,
      nodes: clusterNodes.length > 0 ? clusterNodes : nodes.slice(0, 2).map((n) => n.id),
      responsibilities: bc.responsibilities,
    };
  });

  // Build default story chapter (Data Flow Story)
  const stories: ArchifyStoryChapter[] = [
    {
      id: 'full-flow',
      title: 'Full System Interaction',
      description: 'Step-by-step traversal of system components and dependencies',
      activeNodes: nodes.map((n) => n.id),
      activeEdges: edges.map((e) => e.id),
    },
  ];

  const ir: ArchifyDiagramIR = {
    version: '2.17.0',
    meta: {
      title: projectName,
      description: `Interactive Archify System Map for ${projectName}`,
      preset: 'signal-flow',
      theme: 'dark',
      solidNotes: arch.solidNotes || [],
    },
    nodes,
    edges,
    clusters,
    stories,
  };

  log.debug({ nodesCount: nodes.length, edgesCount: edges.length }, 'Archify IR generated');
  return ir;
}

/**
 * Compiles Archify Diagram IR into a self-contained interactive HTML page.
 */
export function compileArchifyHtml(ir: ArchifyDiagramIR): string {
  const jsonIr = JSON.stringify(ir, null, 2);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ir.meta.title} — Archify System Map</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.2);
      --interface: #a855f7;
      --application: #3b82f6;
      --domain: #10b981;
      --infrastructure: #f59e0b;
      --database: #ec4899;
    }

    body.light {
      --bg: #f8fafc;
      --panel: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #0284c7;
      --accent-glow: rgba(2, 132, 199, 0.15);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    header {
      background-color: var(--panel);
      border-bottom: 1px solid var(--border);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .title-group h1 { font-size: 1.25rem; font-weight: 700; color: var(--accent); }
    .title-group p { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem; }

    .controls { display: flex; gap: 0.75rem; align-items: center; }
    .btn {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { border-color: var(--accent); color: var(--accent); }

    .search-input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.85rem;
      width: 200px;
    }
    .search-input:focus { outline: none; border-color: var(--accent); }

    main { display: flex; flex: 1; overflow: hidden; }

    #viewport {
      flex: 1;
      position: relative;
      background-image: radial-gradient(var(--border) 1px, transparent 1px);
      background-size: 24px 24px;
      overflow: auto;
      padding: 3rem;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .diagram-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      width: 100%;
      max-width: 1100px;
    }

    .node-card {
      background-color: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem;
      position: relative;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    .node-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
      box-shadow: 0 8px 24px var(--accent-glow);
    }
    .node-card.highlighted {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent);
    }
    .node-card.dimmed { opacity: 0.35; }

    .node-badge {
      display: inline-block;
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.75rem;
    }
    .badge-interface { background: rgba(168, 85, 247, 0.15); color: var(--interface); }
    .badge-application { background: rgba(59, 130, 246, 0.15); color: var(--application); }
    .badge-domain { background: rgba(16, 185, 129, 0.15); color: var(--domain); }
    .badge-infrastructure { background: rgba(245, 158, 11, 0.15); color: var(--infrastructure); }
    .badge-database { background: rgba(236, 72, 153, 0.15); color: var(--database); }

    .node-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.5rem; }
    .node-resp-list { list-style: none; font-size: 0.85rem; color: var(--text-muted); }
    .node-resp-list li { margin-bottom: 0.3rem; padding-left: 0.8rem; position: relative; }
    .node-resp-list li::before { content: "•"; position: absolute; left: 0; color: var(--accent); }

    sidebar {
      width: 320px;
      background-color: var(--panel);
      border-left: 1px solid var(--border);
      padding: 1.5rem;
      overflow-y: auto;
    }

    .sidebar-section { margin-bottom: 1.5rem; }
    .sidebar-section h3 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.75rem; }

    .edge-list, .cluster-list { list-style: none; font-size: 0.85rem; }
    .edge-item {
      padding: 0.5rem 0.75rem;
      background: var(--bg);
      border-radius: 6px;
      margin-bottom: 0.4rem;
      border: 1px solid var(--border);
    }
    .edge-arrow { color: var(--accent); font-weight: bold; margin: 0 0.3rem; }

    .solid-note {
      background: rgba(56, 189, 248, 0.1);
      border-left: 3px solid var(--accent);
      padding: 0.6rem 0.8rem;
      font-size: 0.82rem;
      margin-bottom: 0.5rem;
      border-radius: 0 6px 6px 0;
    }
  </style>
</head>
<body class="dark">
  <header>
    <div class="title-group">
      <h1>${ir.meta.title}</h1>
      <p>${ir.meta.description}</p>
    </div>
    <div class="controls">
      <input type="text" id="searchInput" class="search-input" placeholder="Search node..." oninput="filterNodes(this.value)">
      <button class="btn" onclick="toggleTheme()">Toggle Theme</button>
      <button class="btn" onclick="exportJSON()">Export IR JSON</button>
    </div>
  </header>

  <main>
    <div id="viewport">
      <div class="diagram-container" id="diagramContainer">
        ${ir.nodes
          .map(
            (node) => `
          <div class="node-card" id="node-${node.id}" data-id="${node.id}">
            <span class="node-badge badge-${node.role}">${node.role}</span>
            <div class="node-title">${node.label}</div>
            <ul class="node-resp-list">
              ${node.responsibilities.map((r) => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <sidebar>
      <div class="sidebar-section">
        <h3>Bounded Contexts</h3>
        <ul class="cluster-list">
          ${ir.clusters
            .map(
              (c) => `
            <li class="edge-item">
              <strong>${c.name}</strong> (${c.nodes.length} nodes)
            </li>
          `
            )
            .join('')}
        </ul>
      </div>

      <div class="sidebar-section">
        <h3>Dependencies (${ir.edges.length})</h3>
        <ul class="edge-list">
          ${ir.edges
            .map(
              (e) => `
            <li class="edge-item">
              <span>${e.from}</span>
              <span class="edge-arrow">➔</span>
              <span>${e.to}</span>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>

      ${
        ir.meta.solidNotes && ir.meta.solidNotes.length > 0
          ? `
      <div class="sidebar-section">
        <h3>SOLID Compliance</h3>
        ${ir.meta.solidNotes.map((n) => `<div class="solid-note">${n}</div>`).join('')}
      </div>
      `
          : ''
      }
    </sidebar>
  </main>

  <script>
    const irData = ${jsonIr};

    function toggleTheme() {
      document.body.classList.toggle('dark');
      document.body.classList.toggle('light');
    }

    function filterNodes(query) {
      const q = query.toLowerCase().trim();
      const cards = document.querySelectorAll('.node-card');
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          card.classList.remove('dimmed');
          if (q && text.includes(q)) card.classList.add('highlighted');
          else card.classList.remove('highlighted');
        } else {
          card.classList.add('dimmed');
          card.classList.remove('highlighted');
        }
      });
    }

    function exportJSON() {
      const blob = new Blob([JSON.stringify(irData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${ir.meta.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_archify.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;
}
