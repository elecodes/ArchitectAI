CREATE TABLE evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dataset_version VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  case_id VARCHAR(100) NOT NULL,
  agent_id VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  latency_ms INT NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  cost_estimate DECIMAL(10, 6) NOT NULL DEFAULT 0.000000,
  validation_success BOOLEAN NOT NULL,
  validation_errors JSONB DEFAULT '[]',
  score DECIMAL(3, 1),
  criteria_scores JSONB DEFAULT '{}',
  judge_model VARCHAR(100),
  judge_explanation TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eval_results_run ON evaluation_results(run_id);
CREATE INDEX idx_eval_results_model ON evaluation_results(provider, model);
CREATE INDEX idx_eval_results_agent ON evaluation_results(agent_id);

ALTER TABLE artifacts ADD COLUMN evaluation_result_id UUID REFERENCES evaluation_results(id) ON DELETE SET NULL;
