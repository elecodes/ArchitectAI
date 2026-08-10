import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../lib/api';
import TopBar from '../components/TopBar';
import Sheet from '../components/Sheet';
import Kicker from '../components/Kicker';
import { Button } from '../components/Button';
import { TextAreaField } from '../components/Field';
import { IconArrowLeft, IconArrowRight, IconDownload, IconCheck, IconUpload } from '../components/icons';
import MermaidDiagram from '../components/MermaidDiagram';
import { renderMermaidToSvg, svgToSvgBlob, svgToPngBlob } from '../lib/mermaid';

type PipelineStatus = 'idle' | 'running' | 'complete' | 'failed';
type StageStatus = 'pending' | 'running' | 'complete' | 'failed';

interface Stage {
  key: string;
  label: string;
  status: StageStatus;
  artifactId?: string;
}

interface Artifacts {
  spec?: any;
  architecture?: any;
  tasks?: any;
  vision?: any;
  risks?: any;
  diagrams?: any;
}

function StageGlyph({ status }: { status: StageStatus }) {
  if (status === 'complete') return <IconCheck className="h-3.5 w-3.5 text-accent" />;
  if (status === 'running')
    return <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />;
  if (status === 'failed') return <span className="h-2 w-2 rounded-full bg-red-600" />;
  return <span className="h-2 w-2 rounded-full border border-hairline-strong" />;
}

function FeedbackWidget({ artifactId }: { artifactId: string }) {
  const [submitted, setSubmitted] = useState(false);
  async function submit(rating: 'helpful' | 'needs_improvement') {
    await api.submitFeedback(artifactId, rating).catch(() => {});
    setSubmitted(true);
  }
  if (submitted) return <span className="font-mono text-xs text-faint">✓ recorded</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={() => submit('helpful')}
        className="font-mono text-xs text-faint transition-colors hover:text-accent"
        title="Helpful"
      >
        [helpful]
      </button>
      <span className="text-hairline-strong">/</span>
      <button
        onClick={() => submit('needs_improvement')}
        className="font-mono text-xs text-faint transition-colors hover:text-amber"
        title="Needs work"
      >
        [needs work]
      </button>
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles =
    priority === 'must'
      ? 'text-red-700 border-red-300'
      : priority === 'should'
        ? 'text-amber border-amber/50'
        : 'text-ink-soft border-hairline-strong';
  return (
    <span
      className={`border px-1.5 py-px font-mono text-[11px] uppercase tracking-[0.1em] ${styles}`}
    >
      {priority}
    </span>
  );
}

export default function Generate() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [error, setError] = useState('');
  const [stages, setStages] = useState<Stage[]>([
    { key: 'vision', label: 'Vision', status: 'pending' },
    { key: 'spec', label: 'Requirements', status: 'pending' },
    { key: 'architecture', label: 'Architecture', status: 'pending' },
    { key: 'diagrams', label: 'Diagrams', status: 'pending' },
    { key: 'tasks', label: 'Tasks', status: 'pending' },
    { key: 'risks', label: 'Risks', status: 'pending' },
  ]);
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [activeTab, setActiveTab] = useState<
    'vision' | 'spec' | 'architecture' | 'diagrams' | 'tasks' | 'risks'
  >('vision');
  const [metadata, setMetadata] = useState<any>(null);
  const [storageStatus, setStorageStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );

  useEffect(() => {
    if (projectId) {
      api.listProjects().then((projects) => {
        const p = projects.find((proj: any) => proj.id === projectId);
        if (p) {
          setProject(p);
          if (p.description) setDescription(p.description);
        }
      });
    }
  }, [projectId]);

  const activeStage = stages.find((s) => s.status === 'running');

  function updateStage(key: string, status: StageStatus) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));
  }

  async function runPipeline() {
    if (!projectId || description.length < 10) return;
    setPipelineStatus('running');
    setError('');
    setArtifacts({});
    setStages([
      { key: 'vision', label: 'Vision', status: 'pending' },
      { key: 'spec', label: 'Requirements', status: 'pending' },
      { key: 'architecture', label: 'Architecture', status: 'pending' },
      { key: 'diagrams', label: 'Diagrams', status: 'pending' },
      { key: 'tasks', label: 'Tasks', status: 'pending' },
      { key: 'risks', label: 'Risks', status: 'pending' },
    ]);

    try {
      // Step 1: Product Vision
      updateStage('vision', 'running');
      const visionResult = await api.generateVision(projectId, description);
      setArtifacts((prev) => ({ ...prev, vision: visionResult.artifact }));
      setMetadata(visionResult.provenance);
      updateStage('vision', 'complete');

      // Step 2: Specification
      updateStage('spec', 'running');
      const specResult = await api.generateSpec(projectId, description);
      setArtifacts((prev) => ({ ...prev, spec: specResult.artifact }));
      updateStage('spec', 'complete');

      // Step 3: Architecture
      updateStage('architecture', 'running');
      const archResult = await api.generateArchitecture(specResult.artifact.id);
      setArtifacts((prev) => ({ ...prev, architecture: archResult.artifact }));
      updateStage('architecture', 'complete');

      // Step 4: Diagrams (deterministic, fast)
      updateStage('diagrams', 'running');
      const diagramResult = await api.generateDiagrams(archResult.artifact.id, project?.name);
      setArtifacts((prev) => ({ ...prev, diagrams: diagramResult.artifact }));
      updateStage('diagrams', 'complete');

      // Step 5: Tasks
      updateStage('tasks', 'running');
      const taskResult = await api.generateTasks(archResult.artifact.id);
      setArtifacts((prev) => ({ ...prev, tasks: taskResult.artifact }));
      updateStage('tasks', 'complete');

      // Step 6: Risk Assessment
      updateStage('risks', 'running');
      const riskResult = await api.generateRisks(specResult.artifact.id, archResult.artifact.id);
      setArtifacts((prev) => ({ ...prev, risks: riskResult.artifact }));
      updateStage('risks', 'complete');

      setPipelineStatus('complete');
    } catch (err) {
      setError((err as Error).message);
      setPipelineStatus('failed');
      setStages((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'failed' } : s)),
      );
    }
  }

  async function handleExport() {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const name = project?.name || 'project';

    zip.file(
      'README.md',
      `# ${name} — Engineering Package\n\nGenerated by ArchitectAI.\n\n> ${description}\n`,
    );
    if (artifacts.vision)
      zip.file('01-product-vision/vision.md', formatVision(artifacts.vision.content));
    if (artifacts.spec)
      zip.file('02-requirements/requirements.md', formatSpec(artifacts.spec.content));
    if (artifacts.architecture)
      zip.file('03-architecture/architecture.md', formatArch(artifacts.architecture.content));
    if (artifacts.diagrams) {
      const d = artifacts.diagrams.content;
      const sources: Record<string, string> = {};
      if (d.componentDiagram) sources['component'] = d.componentDiagram;
      if (d.containerDiagram) sources['container'] = d.containerDiagram;
      if (d.dataFlowDiagram) sources['data-flow'] = d.dataFlowDiagram;
      if (d.contextDiagram) sources['context'] = d.contextDiagram;
      for (const [slug, src] of Object.entries(sources)) {
        zip.file(`04-diagrams/${slug}.mmd`, src);
        try {
          const svg = await renderMermaidToSvg(src);
          zip.file(`04-diagrams/${slug}.svg`, svgToSvgBlob(svg));
          zip.file(`04-diagrams/${slug}.png`, await svgToPngBlob(svg));
        } catch {
          // image export is best-effort — keep the .mmd source
        }
      }
    }
    if (artifacts.risks)
      zip.file('06-risk-assessment/risks.md', formatRisks(artifacts.risks.content));
    if (artifacts.tasks) zip.file('07-tasks/tasks.md', formatTasks(artifacts.tasks.content));
    zip.file(
      '04_Metadata.md',
      `# Metadata\n\n- **Model:** ${metadata?.model || 'unknown'}\n- **Prompt:** ${metadata?.promptVersion || 'unknown'}\n- **Generated:** ${new Date().toISOString()}\n`,
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveToStorage() {
    if (!projectId) return;
    setStorageStatus('saving');
    try {
      await api.exportToStorage(projectId);
      setStorageStatus('saved');
    } catch {
      setStorageStatus('failed');
    }
  }

  async function handleDownloadStored() {
    if (!projectId) return;
    try {
      const blob = await api.getStoredExport(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project?.name || 'project').replace(/\s+/g, '_')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStorageStatus('failed');
    }
  }

  function formatSpec(c: any): string {
    let md = '# Requirements\n\n';
    c.functionalRequirements?.forEach((r: any) => {
      md += `## ${r.id}: ${r.description}\n\n**Priority:** ${r.priority}\n\n`;
    });
    md += '## Acceptance Criteria\n\n';
    c.acceptanceCriteria?.forEach((a: string) => {
      md += `- ${a}\n`;
    });
    md += '\n## Constraints\n\n';
    c.constraints?.forEach((x: string) => {
      md += `- ${x}\n`;
    });
    md += '\n## Dependencies\n\n';
    c.dependencies?.forEach((x: string) => {
      md += `- ${x}\n`;
    });
    return md;
  }

  function formatArch(c: any): string {
    let md = '# Architecture\n\n';
    c.components?.forEach((x: any) => {
      md += `## ${x.name} [${x.layer}]\n\n${x.responsibilities?.map((r: string) => `- ${r}`).join('\n')}\n\n`;
    });
    md += '## Bounded Contexts\n\n';
    c.boundedContexts?.forEach((x: any) => {
      md += `### ${x.name}\n\nAggregates: ${x.aggregates?.join(', ')}\n\n`;
    });
    return md;
  }

  function formatTasks(c: any): string {
    let md = `# Tasks\n\nCoverage: ${c.traceabilityCoverage}%\n\n`;
    c.tasks?.forEach((t: any) => {
      md += `## ${t.id}: ${t.title}\n\nComplexity: ${t.complexity}/5\n\n${t.description}\n\n`;
    });
    return md;
  }

  function formatVision(c: any): string {
    let md = '# Product Vision\n\n';
    md += `## Vision\n${c.vision}\n\n`;
    md += `## Problem\n${c.problem}\n\n`;
    md += '## Target Users\n';
    c.targetUsers?.forEach((u: string) => {
      md += `- ${u}\n`;
    });
    md += '\n## Business Goals\n';
    c.businessGoals?.forEach((g: string) => {
      md += `- ${g}\n`;
    });
    md += '\n## Core Capabilities\n';
    c.coreCapabilities?.forEach((cap: string) => {
      md += `- ${cap}\n`;
    });
    md += '\n## Success Metrics\n';
    c.successMetrics?.forEach((m: string) => {
      md += `- ${m}\n`;
    });
    md += '\n## MVP Boundaries\n\n### Included\n';
    c.mvpBoundaries?.included?.forEach((i: string) => {
      md += `- ${i}\n`;
    });
    md += '\n### Excluded\n';
    c.mvpBoundaries?.excluded?.forEach((e: string) => {
      md += `- ${e}\n`;
    });
    return md;
  }

  function formatRisks(c: any): string {
    let md = '# Risk Assessment\n\n';
    c.risks?.forEach((r: any) => {
      md += `## ${r.id}: ${r.description}\n\n`;
      md += `- **Category:** ${r.category}\n`;
      md += `- **Probability:** ${r.probability}\n`;
      md += `- **Impact:** ${r.impact}\n`;
      md += `- **Severity:** ${r.severity}\n`;
      md += `- **Mitigation:** ${r.mitigation}\n`;
      md += `- **Status:** ${r.status}\n\n`;
    });
    return md;
  }

  function renderArtifact(artifact: any) {
    if (!artifact)
      return (
        <div className="py-10 text-center font-mono text-xs text-faint">not generated yet</div>
      );
    const c = artifact.content;

    if (activeTab === 'spec')
      return (
        <div className="space-y-5">
          {c.functionalRequirements?.map((r: any) => (
            <div key={r.id} className="border-l-2 border-accent-soft pl-4">
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-accent">{r.id}</code>
                <PriorityBadge priority={r.priority} />
              </div>
              <p className="mt-1 text-base text-ink">{r.description}</p>
            </div>
          ))}
          {c.acceptanceCriteria?.length > 0 && (
            <div className="border-t border-hairline pt-4">
              <Kicker className="mb-3 block">Acceptance Criteria</Kicker>
              {c.acceptanceCriteria.map((a: string, i: number) => (
                <p key={i} className="py-0.5 font-mono text-sm text-ink-soft">
                  ▪ {a}
                </p>
              ))}
            </div>
          )}
          {c.constraints?.length > 0 && (
            <div className="border-t border-hairline pt-4">
              <Kicker className="mb-3 block">Constraints</Kicker>
              {c.constraints.map((x: string, i: number) => (
                <p key={i} className="py-0.5 text-sm text-ink-soft">
                  — {x}
                </p>
              ))}
            </div>
          )}
        </div>
      );

    if (activeTab === 'architecture')
      return (
        <div className="space-y-3">
          {c.components?.map((comp: any, i: number) => (
            <div key={i} className="border border-hairline bg-paper/50 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-base font-semibold text-ink">{comp.name}</span>
                <code className="border border-accent-soft bg-accent-soft/50 px-1.5 py-px font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                  {comp.layer}
                </code>
              </div>
              <ul className="space-y-0.5 text-sm text-ink-soft">
                {comp.responsibilities?.map((r: string, j: number) => (
                  <li key={j} className="flex gap-2">
                    <span className="font-mono text-xs text-faint">→</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {c.boundedContexts?.length > 0 && (
            <div className="border-t border-hairline pt-4">
              <Kicker className="mb-3 block">Bounded Contexts</Kicker>
              {c.boundedContexts.map((bc: any, i: number) => (
                <div key={i} className="py-1 text-sm text-ink-soft">
                  <span className="font-medium text-ink">{bc.name}</span>
                  <span className="text-faint"> — </span>
                  {bc.aggregates?.join(', ')}
                </div>
              ))}
            </div>
          )}
        </div>
      );

    if (activeTab === 'tasks')
      return (
        <div className="space-y-1">
          <div className="mb-3 flex items-center gap-3 font-mono text-xs text-faint">
            <span>{c.tasks?.length} tasks</span>
            <span className="h-1 w-1 rounded-full bg-hairline-strong" />
            <span>{c.traceabilityCoverage}% coverage</span>
          </div>
          {c.tasks?.map((t: any) => (
            <div
              key={t.id}
              className="flex items-start gap-3 border-b border-hairline py-3 last:border-0"
            >
              <code className="mt-px whitespace-nowrap font-mono text-xs text-accent">{t.id}</code>
              <div className="min-w-0 flex-1">
                <p className="text-base text-ink">{t.title}</p>
                <p className="mt-0.5 truncate text-sm text-faint">{t.description}</p>
              </div>
              <span className="whitespace-nowrap border border-hairline-strong px-1.5 py-px font-mono text-[11px] text-ink-soft">
                {t.complexity}/5
              </span>
            </div>
          ))}
        </div>
      );

    if (activeTab === 'vision') {
      return (
        <div className="space-y-4">
          <div>
            <Kicker className="mb-1.5 block">Vision</Kicker>
            <p className="text-base text-ink">{c.vision}</p>
          </div>
          <div>
            <Kicker className="mb-1.5 block">Problem</Kicker>
            <p className="text-sm text-ink-soft">{c.problem}</p>
          </div>
          <div>
            <Kicker className="mb-1.5 block">Target Users</Kicker>
            <div className="flex flex-wrap gap-1">
              {c.targetUsers?.map((u: string, i: number) => (
                <span
                  key={i}
                  className="border border-accent-soft bg-accent-soft/50 px-2 py-0.5 font-mono text-xs text-accent"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
          <div>
            <Kicker className="mb-1.5 block">Business Goals</Kicker>
            {c.businessGoals?.map((g: string, i: number) => (
              <p key={i} className="py-0.5 text-sm text-ink-soft">
                • {g}
              </p>
            ))}
          </div>
          <div>
            <Kicker className="mb-1.5 block">Success Metrics</Kicker>
            {c.successMetrics?.map((m: string, i: number) => (
              <p key={i} className="py-0.5 text-sm text-ink-soft">
                • {m}
              </p>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'diagrams') {
      return (
        <div className="space-y-4">
          <MermaidDiagram source={c.componentDiagram} title="Component Diagram" slug="component" />
          <MermaidDiagram source={c.containerDiagram} title="Container Diagram" slug="container" />
          <MermaidDiagram source={c.dataFlowDiagram} title="Data Flow" slug="data-flow" />
          <MermaidDiagram source={c.contextDiagram} title="System Context" slug="context" />
        </div>
      );
    }

    if (activeTab === 'risks') {
      if (!c.risks) return null;
      const severityChip: Record<string, string> = {
        critical: 'border-red-700 bg-red-soft text-red-700',
        high: 'border-red-700 bg-red-soft/60 text-red-700',
        medium: 'border-amber bg-amber/15 text-amber',
        low: 'border-hairline-strong bg-paper text-ink-soft',
      };
      return (
        <div className="space-y-3">
          {c.risks.map((risk: any) => (
            <div key={risk.id} className="border border-hairline bg-white p-3">
              <div className="mb-1 flex items-center gap-2">
                <code className="font-mono text-xs text-accent">{risk.id}</code>
                <span
                  className={`border px-1.5 py-0.5 font-mono text-[11px] ${severityChip[risk.severity] || ''}`}
                >
                  {risk.severity}
                </span>
                <span className="border border-hairline-strong bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
                  {risk.category}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink">{risk.description}</p>
              <p className="mt-1 text-xs text-ink-soft">→ {risk.mitigation}</p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  return (
    <div className="bg-grid min-h-screen">
      <TopBar
        left={
          <>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-mono text-sm text-faint transition-colors hover:text-ink"
            >
              <IconArrowLeft className="h-3.5 w-3.5" /> projects
            </Link>
            <span className="font-mono text-[11px] text-hairline-strong">//</span>
            <span className="truncate text-base font-medium text-ink">{project?.name || '…'}</span>
          </>
        }
        right={
          pipelineStatus === 'complete' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToStorage}
                disabled={storageStatus === 'saving'}
                title="Store the engineering package on the configured storage provider"
              >
                <IconUpload className="h-3.5 w-3.5" />
                {storageStatus === 'saving'
                  ? 'Saving…'
                  : storageStatus === 'saved'
                    ? 'Saved'
                    : 'Save to storage'}
              </Button>
              {storageStatus === 'saved' && (
                <Button variant="ghost" size="sm" onClick={handleDownloadStored}>
                  <IconDownload className="h-3.5 w-3.5" /> Download stored
                </Button>
              )}
              <Button size="sm" onClick={handleExport}>
                <IconDownload className="h-3.5 w-3.5" /> Export .zip
              </Button>
            </div>
          )
        }
      />

      {pipelineStatus !== 'idle' && (
        <div className="border-b border-hairline bg-paper">
          <div className="mx-auto flex max-w-4xl items-center px-6 py-3">
            {stages.map((stage, i) => (
              <div key={stage.key} className="flex items-center">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-faint">0{i + 1}</span>
                  <StageGlyph status={stage.status} />
                  <span
                    className={`font-mono text-[13px] tracking-[0.05em] ${
                      stage.status === 'running'
                        ? 'text-accent'
                        : stage.status === 'complete'
                          ? 'text-ink'
                          : stage.status === 'failed'
                            ? 'text-red-600'
                            : 'text-faint'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
                {i < stages.length - 1 && <span className="mx-4 h-px w-8 bg-hairline-strong" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6 py-8">
        {pipelineStatus === 'idle' && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <Kicker>Project brief</Kicker>
              <span className="font-mono text-[11px] text-faint">SHEET 03 — INPUT</span>
            </div>
            <TextAreaField
              label="Describe the system"
              hint={`${description.length} chars`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the system you want to architect…"
              rows={10}
            />
            <Button onClick={runPipeline} disabled={description.length < 10}>
              Run pipeline <IconArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {pipelineStatus === 'running' && (
          <div className="py-10">
            <div className="mb-3 flex items-center justify-between font-mono text-xs text-faint">
              <span>{activeStage?.label || 'Pipeline'}</span>
              <span>generating…</span>
            </div>
            <div className="h-px w-full overflow-hidden bg-hairline">
              <div className="h-full w-1/3 animate-pulse bg-accent" />
            </div>
            <p className="mt-3 font-mono text-xs text-faint">typically 15–60 seconds per stage</p>
          </div>
        )}

        {pipelineStatus === 'failed' && (
          <div className="border border-hairline border-l-2 border-l-red-600 bg-white p-5">
            <Kicker className="mb-2 block text-red-700">Pipeline failed</Kicker>
            <p className="font-mono text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setPipelineStatus('idle')}
            >
              Retry
            </Button>
          </div>
        )}

        {pipelineStatus === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1 border-b border-hairline overflow-x-auto">
              {(['vision', 'spec', 'architecture', 'diagrams', 'tasks', 'risks'] as const).map(
                (tab, i) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`-mb-px flex items-center gap-2 border-b px-3 py-2.5 font-mono text-[13px] tracking-[0.05em] transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? 'border-ink text-ink'
                        : 'border-transparent text-faint hover:text-ink-soft'
                    }`}
                  >
                    <span className="text-[11px] text-faint">0{i + 1}</span>
                    {tab === 'vision'
                      ? 'Vision'
                      : tab === 'spec'
                        ? 'Requirements'
                        : tab === 'architecture'
                          ? 'Architecture'
                          : tab === 'diagrams'
                            ? 'Diagrams'
                            : tab === 'tasks'
                              ? 'Tasks'
                              : 'Risks'}
                  </button>
                ),
              )}
              <div className="flex-1" />
              {artifacts[activeTab] && <FeedbackWidget artifactId={artifacts[activeTab].id} />}
            </div>

            <Sheet className="px-6 py-5">{renderArtifact(artifacts[activeTab])}</Sheet>

            {metadata && (
              <div className="flex items-center gap-3 font-mono text-xs text-faint">
                <span>model {metadata.model}</span>
                <span className="text-hairline-strong">/</span>
                <span>prompt {metadata.promptVersion}</span>
                <span className="text-hairline-strong">/</span>
                <span>chunks {metadata.ragChunksUsed}</span>
                <span className="text-hairline-strong">/</span>
                <span>retries {metadata.retryCount}</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
