import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listRuns,
  getRunDetails,
  startBenchmark,
  getLeaderboard,
  listAgents,
  logout
} from '../lib/api';
import Wordmark from '../components/Wordmark';
import Kicker from '../components/Kicker';
import Sheet from '../components/Sheet';
import TopBar from '../components/TopBar';
import { IconLogOut } from '../components/icons';

const PROVIDER_MODELS: Record<string, string[]> = {
  'google': ['gemini-1.5-flash', 'gemini-1.5-pro'],
  'groq': ['llama3-8b-8192', 'llama3-70b-8192'],
  'openai': ['gpt-4o', 'gpt-4o-mini'],
  'mock': ['mock-model']
};

export default function Evaluations() {
  const [runs, setRuns] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);

  // Filters for leaderboard
  const [agentFilter, setAgentFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  // New benchmark form state
  const [targetAgent, setTargetAgent] = useState('requirements');
  const [targetProvider, setTargetProvider] = useState('google');
  const [targetModel, setTargetModel] = useState('gemini-1.5-flash');
  const [targetPromptVersion, setTargetPromptVersion] = useState('v1');
  const [formMessage, setFormMessage] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [agentFilter, providerFilter]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const runsData = await listRuns();
      setRuns(runsData.runs || []);
      const agentsData = await listAgents();
      setAgents(agentsData.agents || []);
      await loadLeaderboard();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    try {
      const filters: Record<string, string> = {};
      if (agentFilter) filters.agentId = agentFilter;
      if (providerFilter) filters.provider = providerFilter;
      const lb = await getLeaderboard(filters);
      setLeaderboard(lb.leaderboard || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStartBenchmark(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage('Starting benchmark...');
    try {
      await startBenchmark(targetAgent, targetProvider, targetModel, targetPromptVersion);
      setFormMessage('Benchmark run queued! Refresh past runs in a moment.');
      setTimeout(async () => {
        const runsData = await listRuns();
        setRuns(runsData.runs || []);
        loadLeaderboard();
      }, 3000);
    } catch (err: any) {
      setFormMessage(`Error: ${err.message}`);
    }
  }

  async function handleViewRun(run: any) {
    setLoading(true);
    try {
      const details = await getRunDetails(run.id);
      setSelectedRun(run);
      setSelectedRunDetails(details.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const activeModels = PROVIDER_MODELS[targetProvider] || [];

  return (
    <div className="bg-grid min-h-screen">
      <TopBar
        left={
          <div className="flex items-center gap-6">
            <Wordmark />
            <Link to="/" className="font-mono text-sm text-faint hover:text-ink">
              projects
            </Link>
            <span className="font-mono text-sm text-ink font-bold border-b border-ink">
              evaluations
            </span>
          </div>
        }
        right={
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 font-mono text-sm text-faint transition-colors hover:text-ink"
          >
            <IconLogOut className="h-3.5 w-3.5" /> sign out
          </button>
        }
      />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <Kicker>workbench</Kicker>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            AI Model Evaluation & Benchmarks
          </h1>
          <p className="mt-2 text-sm text-faint max-w-xl">
            Evaluate agent prompt versions and models using the versioned golden software development dataset.
          </p>
        </div>

        {/* Form and Leaderboard grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* New Run Column */}
          <div className="md:col-span-1">
            <Sheet className="p-6">
              <h2 className="font-display font-bold text-lg mb-4 text-ink">Run Benchmark</h2>
              <form onSubmit={handleStartBenchmark} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-faint mb-1.5 uppercase">Target Agent</label>
                  <select
                    className="w-full bg-paper border border-hairline rounded px-2.5 py-1.5 text-sm"
                    value={targetAgent}
                    onChange={(e) => setTargetAgent(e.target.value)}
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs text-faint mb-1.5 uppercase">Provider</label>
                  <select
                    className="w-full bg-paper border border-hairline rounded px-2.5 py-1.5 text-sm"
                    value={targetProvider}
                    onChange={(e) => {
                      setTargetProvider(e.target.value);
                      const models = PROVIDER_MODELS[e.target.value] || [];
                      if (models.length > 0) setTargetModel(models[0]);
                    }}
                  >
                    <option value="google">Google Gemini</option>
                    <option value="groq">Groq / OSS</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="mock">Mock Client (Deterministic)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs text-faint mb-1.5 uppercase">Model</label>
                  <select
                    className="w-full bg-paper border border-hairline rounded px-2.5 py-1.5 text-sm"
                    value={targetModel}
                    onChange={(e) => setTargetModel(e.target.value)}
                  >
                    {activeModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs text-faint mb-1.5 uppercase">Prompt Version</label>
                  <select
                    className="w-full bg-paper border border-hairline rounded px-2.5 py-1.5 text-sm"
                    value={targetPromptVersion}
                    onChange={(e) => setTargetPromptVersion(e.target.value)}
                  >
                    <option value="v1">v1 (Latest Stable)</option>
                    <option value="v2">v2 (Experimental)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-ink text-paper rounded font-bold text-sm py-2 hover:bg-opacity-95 transition-all cursor-pointer"
                >
                  Trigger Benchmark Run
                </button>

                {formMessage && (
                  <p className="font-mono text-xs text-indigo-600 mt-2">{formMessage}</p>
                )}
              </form>
            </Sheet>
          </div>

          {/* Leaderboard Column */}
          <div className="md:col-span-2">
            <Sheet className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg text-ink">Model Leaderboard</h2>
                <div className="flex gap-2">
                  <select
                    className="bg-paper border border-hairline rounded px-2 py-1 text-xs"
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                  >
                    <option value="">All Agents</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <select
                    className="bg-paper border border-hairline rounded px-2 py-1 text-xs"
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                  >
                    <option value="">All Providers</option>
                    <option value="google">Google</option>
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                    <option value="mock">Mock</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-hairline text-faint">
                      <th className="py-2">Agent</th>
                      <th className="py-2">Model</th>
                      <th className="py-2 text-right">Avg Quality</th>
                      <th className="py-2 text-right">Latency</th>
                      <th className="py-2 text-right">Fail Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((item, idx) => (
                      <tr key={idx} className="border-b border-hairline hover:bg-neutral-50">
                        <td className="py-2.5 font-bold text-neutral-800">{item.agent_id.replace('agent-', '')}</td>
                        <td className="py-2.5 text-neutral-600">
                          {item.model} <span className="text-[10px] text-faint">({item.prompt_version})</span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-indigo-600">{item.avg_score || 'N/A'}</td>
                        <td className="py-2.5 text-right">{item.avg_latency_ms ? `${(item.avg_latency_ms/1000).toFixed(1)}s` : 'N/A'}</td>
                        <td className="py-2.5 text-right text-red-600">{(parseFloat(item.failure_rate) || 0).toFixed(0)}%</td>
                      </tr>
                    ))}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-faint">
                          No evaluations recorded yet. Run a benchmark to populate the leaderboard.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Sheet>
          </div>
        </div>

        {/* Past runs section */}
        <div className="mb-8">
          <h2 className="font-display font-bold text-lg mb-4 text-ink">Past Evaluation Runs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => handleViewRun(r)}
                className={`text-left p-4 rounded border text-sm transition-all ${
                  selectedRun?.id === r.id
                    ? 'border-indigo-600 bg-indigo-50/20'
                    : 'border-hairline bg-paper hover:border-neutral-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-faint">Run {r.id.slice(0, 8)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    r.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {r.status}
                  </span>
                </div>
                <div className="font-display font-semibold text-neutral-800">
                  Dataset v{r.dataset_version}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-faint font-mono">
                  <span>{new Date(r.timestamp).toLocaleDateString()}</span>
                  {r.avg_score && (
                    <span className="font-bold text-indigo-600">Score: {parseFloat(r.avg_score).toFixed(1)}/10</span>
                  )}
                </div>
              </button>
            ))}
            {runs.length === 0 && (
              <div className="md:col-span-3 text-center py-8 text-faint border border-dashed border-hairline rounded bg-paper">
                No past evaluation runs found.
              </div>
            )}
          </div>
        </div>

        {/* Selected run detailed breakdown */}
        {selectedRun && (
          <Sheet className="p-6">
            <h3 className="font-display font-bold text-lg text-ink mb-2">
              Run Details: {selectedRun.id.slice(0, 8)} ({new Date(selectedRun.timestamp).toLocaleDateString()})
            </h3>
            <p className="text-xs font-mono text-faint mb-6">
              Dataset version: {selectedRun.dataset_version} | Status: {selectedRun.status}
            </p>

            <div className="space-y-6">
              {selectedRunDetails.map((res) => (
                <div key={res.id} className="border-b border-hairline pb-6 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-base text-neutral-800">
                        {res.case_id}
                      </span>
                      <span className="font-mono text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                        {res.agent_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span>Model: <strong className="text-neutral-700">{res.model}</strong></span>
                      <span>Latency: <strong className="text-neutral-700">{(res.latency_ms/1000).toFixed(1)}s</strong></span>
                      <span>Cost: <strong className="text-neutral-700">${parseFloat(res.cost_estimate).toFixed(5)}</strong></span>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        res.validation_success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {res.validation_success ? 'Zod Valid' : 'Zod Fail'}
                      </span>
                      {res.score && (
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded text-sm">
                          Judge: {res.score}/10
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Criteria scores */}
                  {res.criteria_scores && Object.keys(res.criteria_scores).length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {Object.entries(res.criteria_scores).map(([k, v]: any) => (
                        <span key={k} className="font-mono text-[10px] bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Judge explanation */}
                  {res.judge_explanation && (
                    <div className="bg-neutral-50 border border-hairline rounded p-3 mb-4 text-xs text-neutral-700 leading-relaxed font-sans">
                      <strong className="block text-[10px] font-mono text-faint mb-1 uppercase">Judge Explanation</strong>
                      {res.judge_explanation}
                    </div>
                  )}

                  {/* Output summary */}
                  {res.output && (
                    <div>
                      <strong className="block text-[10px] font-mono text-faint mb-1.5 uppercase">Agent Output (Truncated preview)</strong>
                      <pre className="text-xs bg-neutral-900 text-neutral-100 p-3 rounded font-mono overflow-x-auto max-h-40">
                        {JSON.stringify(res.output, null, 2).slice(0, 1000)}
                        {JSON.stringify(res.output, null, 2).length > 1000 && '\n... [truncated]'}
                      </pre>
                    </div>
                  )}

                  {res.error_message && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded font-mono">
                      Error: {res.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Sheet>
        )}
      </main>
    </div>
  );
}
