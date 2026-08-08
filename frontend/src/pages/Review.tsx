import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../lib/api';

type Status = 'idle' | 'running' | 'complete' | 'failed';

export default function Review() {
  const [path, setPath] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'technology' | 'summary' | 'review' | 'improvements'>(
    'technology',
  );

  async function runReview() {
    if (!path.trim()) return;
    setStatus('running');
    setError('');
    setResult(null);

    try {
      const data = await api.reviewRepository(path.trim());
      setResult(data);
      setStatus('complete');
    } catch (err) {
      setError((err as Error).message);
      setStatus('failed');
    }
  }

  function renderScoreBar(score: number) {
    const color =
      score >= 8
        ? 'bg-green-500'
        : score >= 6
          ? 'bg-blue-500'
          : score >= 4
            ? 'bg-amber-500'
            : 'bg-red-500';
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${score * 10}%` }} />
        </div>
        <span className="text-xs font-mono text-slate-600">{score}/10</span>
      </div>
    );
  }

  function renderTechnology() {
    if (!result?.technology) return null;
    const t = result.technology;
    const sections = [
      { label: 'Languages', value: t.languages.join(', ') || 'None detected' },
      { label: 'Primary', value: t.primaryLanguage },
      { label: 'Frameworks', value: t.frameworks.join(', ') || 'None' },
      { label: 'Package Managers', value: t.packageManagers.join(', ') || 'None' },
      { label: 'Build Systems', value: t.buildSystems.join(', ') || 'None' },
      { label: 'Databases', value: t.databases.join(', ') || 'None' },
      { label: 'ORMs', value: t.orms.join(', ') || 'None' },
      { label: 'Testing', value: t.testing.join(', ') || 'None' },
      { label: 'CI/CD', value: t.cicd.join(', ') || 'None' },
      { label: 'Docker', value: t.docker ? 'Yes' : 'No' },
      { label: 'TypeScript', value: t.typescript ? 'Yes' : 'No' },
      { label: 'Monorepo', value: t.monorepo ? 'Yes' : 'No' },
    ];
    return (
      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-mono mb-3">
          {result.repository.totalFiles} files • {result.repository.totalLines.toLocaleString()}{' '}
          lines
        </div>
        {sections.map((s) => (
          <div key={s.label} className="flex items-baseline gap-3 py-1 border-b border-slate-50">
            <span className="text-xs text-slate-500 w-32 shrink-0">{s.label}</span>
            <span className="text-sm text-slate-700">{s.value}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderSummary() {
    if (!result?.summary) return null;
    const s = result.summary;
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Project Summary
          </h4>
          <p className="text-sm text-slate-700">{s.projectSummary}</p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Architecture
          </h4>
          <p className="text-sm text-slate-700">{s.architectureOverview}</p>
        </div>
        {s.detectedPatterns?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Patterns
            </h4>
            <div className="flex flex-wrap gap-1">
              {s.detectedPatterns.map((p: string, i: number) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
        {s.potentialProblems?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Potential Problems
            </h4>
            {s.potentialProblems.map((p: string, i: number) => (
              <p key={i} className="text-sm text-amber-700 py-0.5">
                ⚠ {p}
              </p>
            ))}
          </div>
        )}
        {s.entryPoints?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Entry Points
            </h4>
            {s.entryPoints.map((e: string, i: number) => (
              <code key={i} className="block text-xs text-slate-600 font-mono py-0.5">
                {e}
              </code>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderReview() {
    if (!result?.review) return null;
    const r = result.review;
    const dimensions = [
      { key: 'codeQuality', label: 'Code Quality' },
      { key: 'architectureQuality', label: 'Architecture' },
      { key: 'solidAdherence', label: 'SOLID' },
      { key: 'cleanArchitecture', label: 'Clean Architecture' },
      { key: 'security', label: 'Security' },
      { key: 'maintainability', label: 'Maintainability' },
      { key: 'scalability', label: 'Scalability' },
      { key: 'readability', label: 'Readability' },
      { key: 'documentation', label: 'Documentation' },
      { key: 'testQuality', label: 'Testing' },
      { key: 'overallMaturity', label: 'Overall Maturity' },
    ];
    return (
      <div className="space-y-3">
        {dimensions.map((d) => {
          const dim = r[d.key];
          if (!dim) return null;
          return (
            <div key={d.key} className="py-2 border-b border-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-700">{d.label}</span>
                {renderScoreBar(dim.score)}
              </div>
              {(dim.observations || dim.violations || [])
                .slice(0, 2)
                .map((obs: string, i: number) => (
                  <p key={i} className="text-xs text-slate-500 ml-0 mt-0.5">
                    • {obs}
                  </p>
                ))}
            </div>
          );
        })}
      </div>
    );
  }

  function renderImprovements() {
    if (!result?.improvements?.recommendations) return null;
    const priorityColors: Record<string, string> = {
      critical: 'bg-red-50 text-red-700',
      high: 'bg-orange-50 text-orange-700',
      medium: 'bg-amber-50 text-amber-700',
      low: 'bg-slate-100 text-slate-600',
    };
    return (
      <div className="space-y-3">
        {result.improvements.recommendations.map((rec: any, i: number) => (
          <div key={i} className="p-3 border border-slate-100 rounded">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityColors[rec.priority] || ''}`}
              >
                {rec.priority}
              </span>
              <span className={`text-xs px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded`}>
                {rec.effort}
              </span>
            </div>
            <p className="text-sm text-slate-800 font-medium mt-1">{rec.problem}</p>
            <p className="text-xs text-slate-500 mt-0.5">{rec.reason}</p>
            <p className="text-xs text-slate-700 mt-1">→ {rec.suggestion}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-xs text-slate-400 hover:text-slate-600">
          ← Projects
        </Link>
        <span className="text-xs text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700">Repository Review</span>
      </header>

      {/* Pipeline status */}
      {status === 'running' && (
        <div className="bg-white border-b border-slate-200 px-6 py-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-blue-600 font-medium">Analyzing repository...</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-6">
        {/* Input */}
        {status === 'idle' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Repository path
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Enter the absolute path to a local repository
              </p>
            </div>
            <button
              onClick={runReview}
              disabled={!path.trim()}
              className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run review
            </button>
          </div>
        )}

        {/* Running */}
        {status === 'running' && (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-500">
              Importing files, detecting technology, generating review...
            </p>
            <p className="text-xs text-slate-400 mt-1">This may take 30–90 seconds.</p>
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="border border-red-100 bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-700 font-medium">Review failed</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-3 text-xs text-slate-600 hover:text-slate-800 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results */}
        {status === 'complete' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-1 border-b border-slate-200">
              {(['technology', 'summary', 'review', 'improvements'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'technology' ? 'Stack' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              {activeTab === 'technology' && renderTechnology()}
              {activeTab === 'summary' && renderSummary()}
              {activeTab === 'review' && renderReview()}
              {activeTab === 'improvements' && renderImprovements()}
            </div>

            {result.provenance && (
              <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                <span>model: {result.provenance.model}</span>
                <span>duration: {result.provenance.totalDurationMs}ms</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
