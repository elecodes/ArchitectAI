ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_type_check;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_type_check
  CHECK (type IN ('specification','architecture','task_breakdown','product_vision','risk_assessment','diagrams','requirements','agent_architecture','security_analysis','cloud_cost_analysis','devsecops_analysis','test_strategy','synthesis'));
