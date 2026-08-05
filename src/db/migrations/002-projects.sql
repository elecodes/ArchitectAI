CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{
    "chunkTokenCount": 512,
    "retrievalTopK": 5,
    "minSimilarity": 0.5,
    "contextWindow": 128000,
    "reservedOutputTokens": 2048
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
