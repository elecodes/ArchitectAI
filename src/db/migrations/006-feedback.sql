CREATE TABLE artifact_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  rating VARCHAR(20) NOT NULL CHECK (rating IN ('helpful', 'needs_improvement')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artifact_id, user_id)
);

CREATE INDEX idx_feedback_artifact ON artifact_feedback(artifact_id);
