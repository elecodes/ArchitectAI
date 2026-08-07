import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../lib/api';
import TopBar from '../components/TopBar';
import Sheet from '../components/Sheet';
import Kicker from '../components/Kicker';
import { Button } from '../components/Button';
import { TextAreaField } from '../components/Field';
import {
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconCheck,
} from '../components/icons';

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
}

function StageGlyph({ status }: { status: StageStatus }) {
  if (status === 'complete') return <IconCheck className="h-3.5 w-3.5 text-blueprint" />;
  if (status === 'running') return <span className="h-2 w-2 animate-pulse rounded-full bg-blueprint" />;
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
        className="font-mono text-xs text-faint transition-colors hover:text-blueprint"
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
    { key: 'spec', label: 'Requirements', status: 'pending' },
    { key: 'architecture', label: 'Architecture', status: 'pending' },
    { key: 'tasks', label: 'Tasks', status: 'pending' },
  ]);
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [activeTab, setActiveTab] = useState<'spec' | 'architecture' | 'tasks'>('spec');
  const [metadata, setMetadata] = useState<any>(null);

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
      { key: 'spec', label: 'Requirements', status: 'pending' },
      { key: 'architecture', label: 'Architecture', status: 'pending' },
      { key: 'tasks', label: 'Tasks', status: 'pending' },
    ]);

    try {
      updateStage('spec', 'running');
      const specResult = await api.generateSpec(projectId, description);
      setArtifacts((prev) => ({ ...prev, spec: specResult.artifact }));
      setMetadata(specResult.provenance);
      updateStage('spec', 'complete');

      updateStage('architecture', 'running');
      const archResult = await api.generateArchitecture(specResult.artifact.id);
      setArtifacts((prev) => ({ ...prev, architecture: archResult.artifact }));
      updateStage('architecture', 'complete');

      updateStage('tasks', 'running');
      const taskResult = await api.generateTasks(archResult.artifact.id);
      setArtifacts((prev) => ({ ...prev, tasks: taskResult.artifact }));
      updateStage('tasks', 'complete');

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
    if (artifacts.spec) zip.file('01_Requirements.md', formatSpec(artifacts.spec.content));
    if (artifacts.architecture)
      zip.file('02_Architecture.md', formatArch(artifacts.architecture.content));
    if (artifacts.tasks) zip.file('03_Tasks.md', formatTasks(artifacts.tasks.content));
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

  function renderArtifact(artifact: any) {
    if (!artifact)
      return <div className="py-10 text-center font-mono text-xs text-faint">not generated yet</div>;
    const c = artifact.content;

    if (activeTab === 'spec')
      return (
        <div className="space-y-5">
          {c.functionalRequirements?.map((r: any) => (
            <div key={r.id} className="border-l-2 border-blueprint-soft pl-4">
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-blueprint">{r.id}</code>
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
                <code className="border border-blueprint-soft bg-blueprint-soft/50 px-1.5 py-px font-mono text-[11px] uppercase tracking-[0.1em] text-blueprint">
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
              <code className="mt-px whitespace-nowrap font-mono text-xs text-blueprint">
                {t.id}
              </code>
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
            <span className="truncate text-base font-medium text-ink">
              {project?.name || '…'}
            </span>
          </>
        }
        right={
          pipelineStatus === 'complete' && (
            <Button size="sm" onClick={handleExport}>
              <IconDownload className="h-3.5 w-3.5" /> Export .zip
            </Button>
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
                        ? 'text-blueprint'
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
              <div className="h-full w-1/3 animate-pulse bg-blueprint" />
            </div>
            <p className="mt-3 font-mono text-xs text-faint">
              typically 15–60 seconds per stage
            </p>
          </div>
        )}

        {pipelineStatus === 'failed' && (
          <div className="border border-hairline border-l-2 border-l-red-600 bg-white p-5">
            <Kicker className="mb-2 block text-red-700">Pipeline failed</Kicker>
            <p className="font-mono text-sm text-red-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setPipelineStatus('idle')}>
              Retry
            </Button>
          </div>
        )}

        {pipelineStatus === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1 border-b border-hairline">
              {(['spec', 'architecture', 'tasks'] as const).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`-mb-px flex items-center gap-2 border-b px-3 py-2.5 font-mono text-[13px] tracking-[0.05em] transition-colors ${
                    activeTab === tab
                      ? 'border-ink text-ink'
                      : 'border-transparent text-faint hover:text-ink-soft'
                  }`}
                >
                  <span className="text-[11px] text-faint">0{i + 1}</span>
                  {tab === 'spec' ? 'Requirements' : tab === 'architecture' ? 'Architecture' : 'Tasks'}
                </button>
              ))}
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
