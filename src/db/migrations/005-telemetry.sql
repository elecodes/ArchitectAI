CREATE TABLE generation_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  module VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL,
  generation_duration_ms INT NOT NULL,
  embedding_duration_ms INT DEFAULT 0,
  retrieval_duration_ms INT DEFAULT 0,
  total_duration_ms INT NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  retrieved_chunks INT DEFAULT 0,
  fitted_chunks INT DEFAULT 0,
  truncated BOOLEAN DEFAULT FALSE,
  similarity_scores JSONB DEFAULT '[]',
  context_window_size INT NOT NULL,
  context_window_used INT NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('success', 'validation_retry', 'failure')),
  retry_count INT NOT NULL DEFAULT 0,
  error_category VARCHAR(100)
);

CREATE INDEX idx_telemetry_module_date ON generation_telemetry(module, timestamp);
CREATE INDEX idx_telemetry_status ON generation_telemetry(status);
