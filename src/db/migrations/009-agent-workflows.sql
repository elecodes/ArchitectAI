CREATE TABLE agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code VARCHAR(100),
  error_message TEXT,
  total_duration_ms INT
);

CREATE INDEX idx_agent_workflows_project_created ON agent_workflows(project_id, created_at DESC);

CREATE TABLE agent_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,
  agent_name VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped')),
  result_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  parent_artifact_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_ms INT,
  retry_count INT NOT NULL DEFAULT 0,
  prompt_version VARCHAR(50),
  model VARCHAR(100),
  provider VARCHAR(100),
  prompt_tokens INT,
  completion_tokens INT,
  error_code VARCHAR(100),
  error_message TEXT,
  output JSONB
);

CREATE INDEX idx_agent_workflow_steps_workflow ON agent_workflow_steps(workflow_id);