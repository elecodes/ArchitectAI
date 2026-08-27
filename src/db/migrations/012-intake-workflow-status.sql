ALTER TABLE agent_workflows DROP CONSTRAINT IF EXISTS agent_workflows_status_check;
ALTER TABLE agent_workflows ADD CONSTRAINT agent_workflows_status_check CHECK (status IN ('pending', 'running', 'awaiting_input', 'completed', 'failed', 'cancelled'));
