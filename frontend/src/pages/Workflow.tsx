import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  createWorkflow,
  getWorkflowStatus,
  listWorkflows,
  type AgentWorkflow,
  type AgentWorkflowStep,
} from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#f59e0b',
  skipped: '#9ca3af',
};

export default function Workflow() {
  const { id: projectId } = useParams<{ id: string }>();
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [activeWorkflow, setActiveWorkflow] = useState<AgentWorkflow | null>(null);
  const [steps, setSteps] = useState<AgentWorkflowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AgentWorkflow[]>([]);

  useEffect(() => {
    if (!projectId) return;
    listWorkflows(projectId).then(({ workflows }) => setHistory(workflows)).catch(() => {});
  }, [projectId]);

  const pollWorkflow = useCallback(async (workflowId: string) => {
    try {
      const { workflow, steps: s } = await getWorkflowStatus(workflowId);
      setActiveWorkflow(workflow);
      setSteps(s);
      if (workflow.status === 'running' || workflow.status === 'pending') {
        setTimeout(() => pollWorkflow(workflowId), 2000);
      } else {
        setLoading(false);
        if (projectId) {
          listWorkflows(projectId).then(({ workflows }) => setHistory(workflows)).catch(() => {});
        }
      }
    } catch {
      setLoading(false);
    }
  }, [projectId]);

  const handleStart = async () => {
    if (!projectId || !idea.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { workflow } = await createWorkflow(projectId, idea, context || undefined);
      setActiveWorkflow(workflow);
      setSteps([]);
      pollWorkflow(workflow.id);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>Agent Workflow</h1>

      <div style={{ marginBottom: 24 }}>
        <h2>Start New Workflow</h2>
        <textarea
          value={idea}
          onChange={e => setIdea(e.target.value)}
          placeholder="Describe your project idea..."
          rows={4}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Additional context (optional)..."
          rows={2}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <button onClick={handleStart} disabled={loading || !idea.trim()}>
          {loading ? 'Running...' : 'Start Workflow'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>

      {activeWorkflow && (
        <div style={{ marginBottom: 24 }}>
          <h2>Workflow {activeWorkflow.id.slice(0, 8)}</h2>
          <p>Status: <strong style={{ color: STATUS_COLORS[activeWorkflow.status] }}>{activeWorkflow.status}</strong></p>
          {activeWorkflow.totalDurationMs && <p>Duration: {(activeWorkflow.totalDurationMs / 1000).toFixed(1)}s</p>}
          {activeWorkflow.errorMessage && <p style={{ color: 'red' }}>{activeWorkflow.errorMessage}</p>}

          <h3>Steps</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Agent</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Status</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Duration</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(step => (
                <tr key={step.id}>
                  <td>{step.agentName}</td>
                  <td style={{ color: STATUS_COLORS[step.status] }}>{step.status}</td>
                  <td>{step.durationMs ? `${(step.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                  <td>{step.promptTokens && step.completionTokens ? `${step.promptTokens + step.completionTokens}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2>History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Status</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {history.map(w => (
                <tr key={w.id}>
                  <td>{w.id.slice(0, 8)}</td>
                  <td style={{ color: STATUS_COLORS[w.status] }}>{w.status}</td>
                  <td>{new Date(w.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
