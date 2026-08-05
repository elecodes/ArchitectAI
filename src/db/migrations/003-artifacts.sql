CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('specification', 'architecture', 'task_breakdown')),
  content JSONB NOT NULL,
  parent_artifact_id UUID REFERENCES artifacts(id),
  -- Provenance
  model VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context_window_used INT,
  rag_chunks_used INT DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artifacts_project_type ON artifacts(project_id, type);
CREATE INDEX idx_artifacts_parent ON artifacts(parent_artifact_id);
