CREATE TABLE indexed_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path VARCHAR(1024) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  token_count INT NOT NULL,
  metadata JSONB DEFAULT '{}',
  indexed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_project ON indexed_chunks(project_id);
CREATE INDEX idx_chunks_embedding ON indexed_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
