import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  createWorkflow,
  getWorkflowStatus,
  resumeWorkflow,
  listWorkflows,
  type AgentWorkflow,
  type AgentWorkflowStep,
} from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  running: '#3b82f6',
  awaiting_input: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#f59e0b',
  skipped: '#9ca3af',
};

interface IntakeQuestion {
  id: string;
  category?: string;
  question: string;
  options?: string[];
  reasoning?: string;
}

export default function Workflow() {
  const { id: projectId } = useParams<{ id: string }>();
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeWorkflow, setActiveWorkflow] = useState<AgentWorkflow | null>(null);
  const [steps, setSteps] = useState<AgentWorkflowStep[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingResume, setSubmittingResume] = useState(false);
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
      if (workflow.status === 'running' || workflow.status === 'pending' || workflow.status === 'awaiting_input') {
        if (workflow.status !== 'awaiting_input') {
          setTimeout(() => pollWorkflow(workflowId), 2500);
        } else {
          setLoading(false);
        }
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
    setAnswers({});
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

  const handleAnswerChange = (questionId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: val }));
  };

  const handleResume = async () => {
    if (!activeWorkflow || !idea.trim()) return;
    setSubmittingResume(true);
    setError(null);
    try {
      await resumeWorkflow(activeWorkflow.id, idea, answers, context || undefined);
      setSubmittingResume(false);
      setLoading(true);
      pollWorkflow(activeWorkflow.id);
    } catch (err) {
      setError((err as Error).message);
      setSubmittingResume(false);
    }
  };

  const toggleExpand = (stepId: string) => {
    setExpandedStepId(prev => (prev === stepId ? null : stepId));
  };

  const intakeStep = steps.find(s => s.agentId === 'intake');
  const synthesisStep = steps.find(s => s.agentId === 'synthesis');
  const intakeQuestions: IntakeQuestion[] = (intakeStep?.output as any)?.questions || [];

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>ArchitectAI Multi-Agent Pipeline</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Interactive 8-agent architectural workflow powered by Gemini 3.6 Flash.
      </p>

      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Start New Project Idea</h2>
        <textarea
          value={idea}
          onChange={e => setIdea(e.target.value)}
          placeholder="Describe your project idea (e.g. I want to build a real-time ride sharing app)..."
          rows={3}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 12 }}
        />
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Additional context or constraints (optional)..."
          rows={2}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 12 }}
        />
        <button
          onClick={handleStart}
          disabled={loading || !idea.trim()}
          style={{
            background: loading ? '#9ca3af' : '#2563eb',
            color: '#fff',
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing Idea...' : 'Start Workflow'}
        </button>
        {error && <p style={{ color: '#ef4444', marginTop: 12, fontSize: 14 }}>{error}</p>}
      </div>

      {activeWorkflow && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Workflow #{activeWorkflow.id.slice(0, 8)}</h2>
            <span style={{
              background: STATUS_COLORS[activeWorkflow.status] || '#6b7280',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              {activeWorkflow.status.replace('_', ' ')}
            </span>
          </div>

          {activeWorkflow.totalDurationMs && (
            <p style={{ color: '#4b5563', fontSize: 14, marginBottom: 12 }}>
              Total Duration: <strong>{(activeWorkflow.totalDurationMs / 1000).toFixed(1)}s</strong>
            </p>
          )}

          {/* Synthesis Final Result Summary */}
          {activeWorkflow.status === 'completed' && synthesisStep?.output && (
            <div style={{ background: '#ecfdf5', border: '1.5px solid #10b981', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>
                ✓ Completed Architecture Synthesis
              </h3>
              <p style={{ fontSize: 14, color: '#047857', marginBottom: 16 }}>
                All 8 agents completed live! Below is the executive summary generated by the Synthesis Agent:
              </p>
              <div style={{ background: '#fff', border: '1px solid #a7f3d0', borderRadius: 8, padding: 16, fontSize: 14, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                {typeof (synthesisStep.output as any).executiveSummary === 'string'
                  ? (synthesisStep.output as any).executiveSummary
                  : JSON.stringify(synthesisStep.output, null, 2)}
              </div>
            </div>
          )}

          {/* Phase 0 Grill Me Intake Interview Card */}
          {activeWorkflow.status === 'awaiting_input' && intakeQuestions.length > 0 && (
            <div style={{ background: '#eff6ff', border: '1.5px solid #3b82f6', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>Phase 0 Intake: Grill Me Interview</h3>
                <p style={{ fontSize: 14, color: '#1e3a8a' }}>
                  Gemini Flash identified key technical ambiguities in your brief. Pick an option OR type a write-in answer!
                </p>
              </div>

              {intakeQuestions.map((q, idx) => (
                <div key={q.id || idx} style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                    {idx + 1}. {q.question}
                  </p>
                  {q.reasoning && (
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontStyle: 'italic' }}>
                      Why this matters: {q.reasoning}
                    </p>
                  )}

                  {q.options && q.options.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {q.options.map((opt, oIdx) => (
                        <label key={oIdx} style={{ fontSize: 13, color: '#334155', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`q_${q.id || idx}`}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() => handleAnswerChange(q.id, opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Or type custom answer..."
                    value={answers[q.id] || ''}
                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              ))}

              <button
                onClick={handleResume}
                disabled={submittingResume}
                style={{
                  background: submittingResume ? '#9ca3af' : '#1d4ed8',
                  color: '#fff',
                  fontWeight: 600,
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 14,
                  cursor: submittingResume ? 'not-allowed' : 'pointer',
                  width: '100%',
                }}
              >
                {submittingResume ? 'Resuming Pipeline...' : 'Submit Answers & Continue Workflow'}
              </button>
            </div>
          )}

          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Pipeline Steps (Click any step to inspect output)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Agent</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Duration</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Tokens</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(step => (
                <>
                  <tr key={step.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{step.agentName}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: STATUS_COLORS[step.status] || '#64748b', fontWeight: 600 }}>
                        {step.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{step.durationMs ? `${(step.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {step.promptTokens && step.completionTokens ? `${step.promptTokens + step.completionTokens}` : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {step.output && (
                        <button
                          onClick={() => toggleExpand(step.id)}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {expandedStepId === step.id ? 'Hide Output ▲' : 'View Output ▼'}
                        </button>
                      )}
                    </td>
                  </tr>

                  {expandedStepId === step.id && step.output && (
                    <tr key={`${step.id}_output`}>
                      <td colSpan={5} style={{ padding: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ background: '#1e293b', color: '#f8fafc', padding: 14, borderRadius: 8, overflowX: 'auto', fontSize: 13, fontFamily: 'monospace', maxHeight: 350 }}>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(step.output, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Workflow History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Workflow ID</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0' }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {history.map(w => (
                <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => { setActiveWorkflow(w); pollWorkflow(w.id); }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>#{w.id.slice(0, 8)}</td>
                  <td style={{ padding: '10px 12px', color: STATUS_COLORS[w.status], fontWeight: 600 }}>
                    {w.status.replace('_', ' ')}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(w.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
