import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../lib/api';

type Step = 'idle' | 'spec' | 'architecture' | 'tasks' | 'done' | 'error';

interface Artifacts {
  spec?: any;
  architecture?: any;
  tasks?: any;
}

function FeedbackWidget({ artifactId }: { artifactId: string }) {
  const [submitted, setSubmitted] = useState<string | null>(null);

  async function handleFeedback(rating: 'helpful' | 'needs_improvement') {
    try {
      await api.submitFeedback(artifactId, rating);
      setSubmitted(rating);
    } catch (err) {
      console.error(err);
    }
  }

  if (submitted) {
    return <p className="text-xs text-gray-400 mt-4">Thanks for your feedback!</p>;
  }

  return (
    <div className="mt-4 pt-4 border-t flex items-center gap-3">
      <span className="text-xs text-gray-500">Was this helpful?</span>
      <button
        onClick={() => handleFeedback('helpful')}
        className="text-lg hover:scale-110 transition"
        title="Helpful"
      >
        👍
      </button>
      <button
        onClick={() => handleFeedback('needs_improvement')}
        className="text-lg hover:scale-110 transition"
        title="Needs improvement"
      >
        👎
      </button>
    </div>
  );
}

export default function Generate() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [activeTab, setActiveTab] = useState<'spec' | 'architecture' | 'tasks'>('spec');

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

  async function handleGenerate() {
    if (!projectId || description.length < 10) return;
    setError('');
    setArtifacts({});

    try {
      // Step 1: Generate Specification
      setStep('spec');
      const specResult = await api.generateSpec(projectId, description);
      setArtifacts((prev) => ({ ...prev, spec: specResult.artifact }));

      // Step 2: Generate Architecture
      setStep('architecture');
      const archResult = await api.generateArchitecture(specResult.artifact.id);
      setArtifacts((prev) => ({ ...prev, architecture: archResult.artifact }));

      // Step 3: Generate Tasks
      setStep('tasks');
      const taskResult = await api.generateTasks(archResult.artifact.id);
      setArtifacts((prev) => ({ ...prev, tasks: taskResult.artifact }));

      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('error');
    }
  }

  function renderProgress() {
    const steps = [
      { key: 'spec', label: 'Specification' },
      { key: 'architecture', label: 'Architecture' },
      { key: 'tasks', label: 'Tasks' },
    ];

    const currentIndex = steps.findIndex((s) => s.key === step);
    const isDone = step === 'done';
    const isError = step === 'error';

    return (
      <div className="space-y-3">
        {steps.map((s, i) => {
          let status = '○';
          let color = 'text-gray-400';
          if (i < currentIndex || isDone) {
            status = '✓';
            color = 'text-green-600';
          } else if (i === currentIndex && !isDone && !isError) {
            status = '⏳';
            color = 'text-blue-600';
          }
          const isActive = i === currentIndex && !isDone && !isError;
          return (
            <div key={s.key} className={`flex items-center gap-3 ${color}`}>
              <span className="text-lg w-6">{status}</span>
              <span className="font-medium">{s.label}</span>
              {isActive && <span className="text-xs text-gray-400 ml-2">generating...</span>}
            </div>
          );
        })}
      </div>
    );
  }

  function renderArtifactContent(artifact: any) {
    if (!artifact) return null;
    const content = artifact.content;

    if (activeTab === 'spec') {
      return (
        <div className="space-y-6">
          <section>
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Functional Requirements</h3>
            {content.functionalRequirements?.map((r: any) => (
              <div key={r.id} className="p-3 bg-gray-50 rounded mb-2">
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-blue-600">{r.id}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${r.priority === 'must' ? 'bg-red-100 text-red-700' : r.priority === 'should' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {r.priority}
                  </span>
                </div>
                <p className="text-sm mt-1">{r.description}</p>
              </div>
            ))}
          </section>
          <section>
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Acceptance Criteria</h3>
            <ul className="space-y-1">
              {content.acceptanceCriteria?.map((c: string, i: number) => (
                <li key={i} className="text-sm text-gray-600 pl-4 border-l-2 border-blue-200">
                  {c}
                </li>
              ))}
            </ul>
          </section>
          {content.constraints?.length > 0 && (
            <section>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Constraints</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {content.constraints.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}
          {content.dependencies?.length > 0 && (
            <section>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Dependencies</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {content.dependencies.map((d: string, i: number) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      );
    }

    if (activeTab === 'architecture') {
      return (
        <div className="space-y-6">
          <section>
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Components</h3>
            {content.components?.map((c: any, i: number) => (
              <div key={i} className="p-3 bg-gray-50 rounded mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {c.layer}
                  </span>
                </div>
                <ul className="mt-1 text-xs text-gray-500 list-disc list-inside">
                  {c.responsibilities?.map((r: string, j: number) => <li key={j}>{r}</li>)}
                </ul>
              </div>
            ))}
          </section>
          {content.boundedContexts?.length > 0 && (
            <section>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Bounded Contexts</h3>
              {content.boundedContexts.map((bc: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 rounded mb-2">
                  <span className="font-medium text-sm">{bc.name}</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Aggregates: {bc.aggregates?.join(', ')}
                  </p>
                </div>
              ))}
            </section>
          )}
        </div>
      );
    }

    if (activeTab === 'tasks') {
      return (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-4">
            Coverage: {content.traceabilityCoverage || 'N/A'}% • {content.tasks?.length || 0} tasks
          </p>
          {content.tasks?.map((t: any) => (
            <div key={t.id} className="p-3 bg-gray-50 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs text-blue-600">{t.id}</span>
                  <span className="font-medium text-sm ml-2">{t.title}</span>
                </div>
                <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">{t.complexity}/5</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t.description}</p>
              {t.dependsOn?.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">Depends on: {t.dependsOn.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  async function handleExport() {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    const projectName = project?.name || 'project';

    // README
    zip.file(
      'README.md',
      `# ${projectName} — Engineering Package\n\nGenerated by ArchitectAI.\n\nThis package contains the complete engineering documentation for your project.\n\n## Contents\n\n- 01_Requirements.md — Functional requirements and acceptance criteria\n- 02_Architecture.md — System architecture and component design\n- 03_Tasks.md — Implementation task breakdown\n- 04_Metadata.md — Generation metadata and provenance\n\n## How This Was Generated\n\nThis engineering package was generated using ArchitectAI from the following description:\n\n> ${description}\n`,
    );

    // Spec
    if (artifacts.spec) {
      const spec = artifacts.spec.content;
      let md = '# Requirements\n\n';
      md += '## Functional Requirements\n\n';
      if (spec.functionalRequirements) {
        spec.functionalRequirements.forEach((r: any) => {
          md += `### ${r.id}: ${r.description}\n\n**Priority:** ${r.priority}\n\n`;
        });
      }
      md += '## Acceptance Criteria\n\n';
      if (spec.acceptanceCriteria) {
        spec.acceptanceCriteria.forEach((c: string) => {
          md += `- ${c}\n`;
        });
      }
      md += '\n## Constraints\n\n';
      if (spec.constraints) {
        spec.constraints.forEach((c: string) => {
          md += `- ${c}\n`;
        });
      }
      md += '\n## Dependencies\n\n';
      if (spec.dependencies) {
        spec.dependencies.forEach((d: string) => {
          md += `- ${d}\n`;
        });
      }
      zip.file('01_Requirements.md', md);
    }

    // Architecture
    if (artifacts.architecture) {
      const arch = artifacts.architecture.content;
      let md = '# Architecture\n\n';
      md += '## Components\n\n';
      if (arch.components) {
        arch.components.forEach((c: any) => {
          md += `### ${c.name}\n\n**Layer:** ${c.layer}\n\n**Responsibilities:**\n`;
          c.responsibilities?.forEach((r: string) => {
            md += `- ${r}\n`;
          });
          md += `\n**Dependencies:** ${c.dependencies?.join(', ') || 'None'}\n\n`;
        });
      }
      md += '## Bounded Contexts\n\n';
      if (arch.boundedContexts) {
        arch.boundedContexts.forEach((bc: any) => {
          md += `### ${bc.name}\n\n**Aggregates:** ${bc.aggregates?.join(', ')}\n\n**Responsibilities:**\n`;
          bc.responsibilities?.forEach((r: string) => {
            md += `- ${r}\n`;
          });
          md += '\n';
        });
      }
      md += '## SOLID Notes\n\n';
      if (arch.solidNotes) {
        arch.solidNotes.forEach((n: string) => {
          md += `- ${n}\n`;
        });
      }
      zip.file('02_Architecture.md', md);
    }

    // Tasks
    if (artifacts.tasks) {
      const taskData = artifacts.tasks.content;
      let md = '# Implementation Tasks\n\n';
      md += `**Traceability Coverage:** ${taskData.traceabilityCoverage || 'N/A'}%\n\n`;
      if (taskData.tasks) {
        taskData.tasks.forEach((t: any) => {
          md += `## ${t.id}: ${t.title}\n\n`;
          md += `**Complexity:** ${t.complexity}/5\n\n`;
          md += `${t.description}\n\n`;
          md += '**Acceptance Criteria:**\n\n';
          t.acceptanceCriteria?.forEach((ac: any) => {
            md += `- **Action:** ${ac.action}\n  **Expected:** ${ac.expectedResult}\n  **Pass/Fail:** ${ac.passFailCondition}\n\n`;
          });
          if (t.dependsOn?.length) {
            md += `**Depends on:** ${t.dependsOn.join(', ')}\n\n`;
          }
          md += '---\n\n';
        });
      }
      zip.file('03_Tasks.md', md);
    }

    // Metadata
    let metaMd = '# Generation Metadata\n\n';
    metaMd += `**Project:** ${projectName}\n\n`;
    metaMd += `**Generated:** ${new Date().toISOString()}\n\n`;
    if (artifacts.spec) {
      metaMd += `**Model:** ${artifacts.spec.model}\n\n`;
      metaMd += `**Prompt Version:** ${artifacts.spec.promptVersion}\n\n`;
    }
    zip.file('04_Metadata.md', metaMd);

    // Download
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}_engineering_package.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
          <h1 className="text-xl font-bold">{project?.name || 'Project'}</h1>
        </div>
        {step === 'done' && (
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            ⬇ Download Package
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Input state */}
        {step === 'idle' && (
          <div className="bg-white p-6 rounded-lg border space-y-4">
            <h2 className="text-lg font-semibold">Generate Engineering Package</h2>
            <p className="text-sm text-gray-500">
              Describe what you want to build. ArchitectAI will generate requirements, architecture,
              and implementation tasks.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your software idea in detail..."
              rows={8}
              className="w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-400">{description.length} characters (min 10)</p>
            <button
              onClick={handleGenerate}
              disabled={description.length < 10}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              Generate Engineering Package
            </button>
          </div>
        )}

        {/* Generating state */}
        {(step === 'spec' || step === 'architecture' || step === 'tasks') && (
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Generating...</h2>
            <p className="text-sm text-gray-500 mb-6">This may take 30–60 seconds per step.</p>
            {renderProgress()}
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="bg-white p-6 rounded-lg border border-red-200">
            <h2 className="text-lg font-semibold text-red-700 mb-2">Generation Failed</h2>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => setStep('idle')}
              className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results state */}
        {step === 'done' && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-white rounded-lg border p-1">
              {(['spec', 'architecture', 'tasks'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                    activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'spec'
                    ? 'Requirements'
                    : tab === 'architecture'
                      ? 'Architecture'
                      : 'Tasks'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="bg-white p-6 rounded-lg border">
              {renderArtifactContent(artifacts[activeTab])}
              {artifacts[activeTab] && <FeedbackWidget artifactId={artifacts[activeTab].id} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
