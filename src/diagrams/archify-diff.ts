import type { ArchifyDiagramIR, ArchifyNode, ArchifyEdge } from './archify.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('archify-diff');

export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface NodeChange {
  changeType: ChangeType;
  node: ArchifyNode;
  previousNode?: ArchifyNode;
  details?: string[];
}

export interface EdgeChange {
  changeType: ChangeType;
  edge: ArchifyEdge;
  previousEdge?: ArchifyEdge;
}

export interface ArchifyDiffResult {
  title: string;
  before: ArchifyDiagramIR;
  after: ArchifyDiagramIR;
  nodeChanges: NodeChange[];
  edgeChanges: EdgeChange[];
  summary: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    edgesAdded: number;
    edgesRemoved: number;
    totalChanges: number;
  };
}

/**
 * Computes deterministic architecture diff between two Archify IR snapshots (Before vs After).
 */
export function compareArchifyIR(
  before: ArchifyDiagramIR,
  after: ArchifyDiagramIR,
  title: string = 'Architecture Delta'
): ArchifyDiffResult {
  const beforeNodesMap = new Map<string, ArchifyNode>(before.nodes.map((n) => [n.id, n]));
  const afterNodesMap = new Map<string, ArchifyNode>(after.nodes.map((n) => [n.id, n]));

  const nodeChanges: NodeChange[] = [];

  // Check After nodes against Before nodes
  for (const [id, afterNode] of afterNodesMap.entries()) {
    const beforeNode = beforeNodesMap.get(id);
    if (!beforeNode) {
      nodeChanges.push({
        changeType: 'added',
        node: afterNode,
      });
    } else {
      // Compare fields to detect modifications
      const details: string[] = [];
      if (beforeNode.role !== afterNode.role) {
        details.push(`Role changed from ${beforeNode.role} to ${afterNode.role}`);
      }
      if (beforeNode.layer !== afterNode.layer) {
        details.push(`Layer changed from ${beforeNode.layer} to ${afterNode.layer}`);
      }
      const beforeResp = (beforeNode.responsibilities || []).join('|');
      const afterResp = (afterNode.responsibilities || []).join('|');
      if (beforeResp !== afterResp) {
        details.push('Responsibilities updated');
      }

      if (details.length > 0) {
        nodeChanges.push({
          changeType: 'modified',
          node: afterNode,
          previousNode: beforeNode,
          details,
        });
      } else {
        nodeChanges.push({
          changeType: 'unchanged',
          node: afterNode,
        });
      }
    }
  }

  // Check for removed nodes
  for (const [id, beforeNode] of beforeNodesMap.entries()) {
    if (!afterNodesMap.has(id)) {
      nodeChanges.push({
        changeType: 'removed',
        node: beforeNode,
      });
    }
  }

  // Compare Edges
  const beforeEdgesMap = new Map<string, ArchifyEdge>(before.edges.map((e) => [`${e.from}->${e.to}`, e]));
  const afterEdgesMap = new Map<string, ArchifyEdge>(after.edges.map((e) => [`${e.from}->${e.to}`, e]));

  const edgeChanges: EdgeChange[] = [];

  for (const [key, afterEdge] of afterEdgesMap.entries()) {
    const beforeEdge = beforeEdgesMap.get(key);
    if (!beforeEdge) {
      edgeChanges.push({
        changeType: 'added',
        edge: afterEdge,
      });
    } else {
      edgeChanges.push({
        changeType: 'unchanged',
        edge: afterEdge,
      });
    }
  }

  for (const [key, beforeEdge] of beforeEdgesMap.entries()) {
    if (!afterEdgesMap.has(key)) {
      edgeChanges.push({
        changeType: 'removed',
        edge: beforeEdge,
      });
    }
  }

  const nodesAdded = nodeChanges.filter((c) => c.changeType === 'added').length;
  const nodesRemoved = nodeChanges.filter((c) => c.changeType === 'removed').length;
  const nodesModified = nodeChanges.filter((c) => c.changeType === 'modified').length;
  const edgesAdded = edgeChanges.filter((c) => c.changeType === 'added').length;
  const edgesRemoved = edgeChanges.filter((c) => c.changeType === 'removed').length;

  const diffResult: ArchifyDiffResult = {
    title,
    before,
    after,
    nodeChanges,
    edgeChanges,
    summary: {
      nodesAdded,
      nodesRemoved,
      nodesModified,
      edgesAdded,
      edgesRemoved,
      totalChanges: nodesAdded + nodesRemoved + nodesModified + edgesAdded + edgesRemoved,
    },
  };

  log.debug(diffResult.summary, 'Archify IR comparison completed');
  return diffResult;
}

/**
 * Compiles Archify Diff Result into an interactive HTML report with Before / Delta / After tabs.
 */
export function compileArchifyDiffHtml(diff: ArchifyDiffResult): string {
  const jsonDiff = JSON.stringify(diff, null, 2);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${diff.title} — Archify Architecture Diff</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --added-bg: rgba(16, 185, 129, 0.15);
      --added-border: #10b981;
      --removed-bg: rgba(239, 68, 68, 0.15);
      --removed-border: #ef4444;
      --modified-bg: rgba(245, 158, 11, 0.15);
      --modified-border: #f59e0b;
    }

    body.light {
      --bg: #f8fafc;
      --panel: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #0284c7;
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

    .tabs { display: flex; gap: 0.5rem; background: var(--bg); padding: 0.25rem; border-radius: 8px; border: 1px solid var(--border); }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.4rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn.active { background: var(--panel); color: var(--accent); shadow: 0 2px 4px rgba(0,0,0,0.1); }

    main { display: flex; flex: 1; overflow: hidden; }
    .view-pane { flex: 1; padding: 2rem; overflow: auto; display: none; }
    .view-pane.active { display: block; }

    .metrics-bar {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      flex: 1;
      text-align: center;
    }
    .metric-num { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
    .metric-added { color: var(--added-border); }
    .metric-removed { color: var(--removed-border); }
    .metric-modified { color: var(--modified-border); }

    .grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
    }

    .change-card {
      background-color: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem;
      position: relative;
    }
    .change-card.added { background-color: var(--added-bg); border-color: var(--added-border); }
    .change-card.removed { background-color: var(--removed-bg); border-color: var(--removed-border); opacity: 0.8; }
    .change-card.modified { background-color: var(--modified-bg); border-color: var(--modified-border); }

    .change-tag {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .tag-added { background: var(--added-border); color: #fff; }
    .tag-removed { background: var(--removed-border); color: #fff; }
    .tag-modified { background: var(--modified-border); color: #fff; }
    .tag-unchanged { background: var(--border); color: var(--text-muted); }

    .card-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.4rem; }
    .details-list { font-size: 0.82rem; color: var(--text-muted); margin-top: 0.5rem; padding-left: 1rem; }
  </style>
</head>
<body class="dark">
  <header>
    <div class="title-group">
      <h1>${diff.title}</h1>
      <p>Comparing ${diff.before.meta.title} (Before) ➔ ${diff.after.meta.title} (After)</p>
    </div>
    <div class="tabs">
      <button class="tab-btn" onclick="showTab('before')">Before (${diff.before.nodes.length})</button>
      <button class="tab-btn active" onclick="showTab('delta')">Delta (${diff.summary.totalChanges} changes)</button>
      <button class="tab-btn" onclick="showTab('after')">After (${diff.after.nodes.length})</button>
    </div>
  </header>

  <main>
    <!-- Delta View -->
    <div id="pane-delta" class="view-pane active">
      <div class="metrics-bar">
        <div class="metric-card">
          <p>Nodes Added</p>
          <div class="metric-num metric-added">+${diff.summary.nodesAdded}</div>
        </div>
        <div class="metric-card">
          <p>Nodes Removed</p>
          <div class="metric-num metric-removed">-${diff.summary.nodesRemoved}</div>
        </div>
        <div class="metric-card">
          <p>Nodes Modified</p>
          <div class="metric-num metric-modified">~${diff.summary.nodesModified}</div>
        </div>
        <div class="metric-card">
          <p>Dependencies Changed</p>
          <div class="metric-num">+${diff.summary.edgesAdded} / -${diff.summary.edgesRemoved}</div>
        </div>
      </div>

      <h2 style="margin-bottom: 1rem; font-size: 1.1rem;">Component Architecture Delta</h2>
      <div class="grid-container">
        ${diff.nodeChanges
          .filter((c) => c.changeType !== 'unchanged')
          .map(
            (c) => `
          <div class="change-card ${c.changeType}">
            <span class="change-tag tag-${c.changeType}">${c.changeType}</span>
            <div class="card-title">${c.node.label}</div>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Layer: ${c.node.layer}</p>
            ${
              c.details && c.details.length > 0
                ? `<ul class="details-list">${c.details.map((d) => `<li>${d}</li>`).join('')}</ul>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- Before View -->
    <div id="pane-before" class="view-pane">
      <h2 style="margin-bottom: 1rem; font-size: 1.1rem;">Initial Architecture (${diff.before.meta.title})</h2>
      <div class="grid-container">
        ${diff.before.nodes
          .map(
            (n) => `
          <div class="change-card">
            <span class="change-tag tag-unchanged">${n.role}</span>
            <div class="card-title">${n.label}</div>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${n.layer}</p>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- After View -->
    <div id="pane-after" class="view-pane">
      <h2 style="margin-bottom: 1rem; font-size: 1.1rem;">Updated Architecture (${diff.after.meta.title})</h2>
      <div class="grid-container">
        ${diff.after.nodes
          .map(
            (n) => `
          <div class="change-card">
            <span class="change-tag tag-unchanged">${n.role}</span>
            <div class="card-title">${n.label}</div>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${n.layer}</p>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  </main>

  <script>
    const diffData = ${jsonDiff};

    function showTab(name) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.view-pane').forEach(pane => pane.classList.remove('active'));
      
      const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(name));
      if (targetBtn) targetBtn.classList.add('active');
      
      const pane = document.getElementById('pane-' + name);
      if (pane) pane.classList.add('active');
    }
  </script>
</body>
</html>`;
}
