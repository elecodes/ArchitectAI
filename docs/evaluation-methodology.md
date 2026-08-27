# AI Agent Evaluation Methodology

## Core Principle: "Evaluation is Evidence, Not Truth"

Evaluation of LLM agent outputs is a probabilistic, multi-dimensional signal. It provides empirical evidence of relative performance, prompt stability, and model characteristics under specific constraints, but should not be treated as absolute ground truth.

---

## Evaluation Architecture

ArchitectAI implements a two-level provider-independent evaluation engine designed to benchmark prompt versions, models, and providers:

```
[Golden Dataset]
       ↓
 [Agent Runner] 
       ↓ (Generates Output)
 [Evaluation Engine]
   ├─► Level 1: Deterministic (Zod Schema Validity, Structure, Missing Fields)
   └─► Level 2: Semantic (LLM-as-Judge scoring criteria: Correctness, Security, etc.)
       ↓
 [Telemetry / Run Metrics] ──► Leaderboard
```

---

## 1. Golden Evaluation Dataset

The golden dataset is stored at [golden-dataset.json](file:///Users/elena/Developer/ArchitectAI/src/data/golden-dataset.json) and covers 5 representative application domains of varying complexity:

1. **SaaS Subscription Billing System** (Medium complexity)
2. **HIPAA-Compliant Telemedicine Platform** (High complexity)
3. **High-Throughput Digital Ledger** (High complexity)
4. **B2C E-commerce Multi-vendor Marketplace** (Medium complexity)
5. **Internal Enterprise Wiki & Document System** (Low complexity)

---

## 2. Evaluation Levels

### Level 1: Deterministic Evaluation (Structure)
- Uses code parsing and structural checks.
- Validates the output matches the agent's specific Zod schema (defined in `src/agents/schemas`).
- Identifies parse errors and missing schema fields.

### Level 2: Semantic Evaluation (LLM-as-Judge)
- Utilizes the production LLM (configured as the default model) to score agent outputs.
- Returns a structured evaluation JSON validating:
  - **Score**: An overall quality score from 1.0 to 10.0.
  - **Criteria Scores**: Specific metric scores tailored to each agent (e.g. `threat_coverage` for Security Agent, `requirements_traceability` for Architecture Agent).
  - **Explanation**: Contextual reasoning for the score.

---

## 3. Evaluation Criteria by Agent

- **Requirements Agent**: Correctness, Completeness, Relevance, Consistency, Groundedness, Schema Validity.
- **Architecture Agent**: Requirements Traceability, Appropriate Architecture, Scalability, Security, Technology Justification, Operational Feasibility.
- **Security Agent**: Threat Coverage, OWASP Awareness, Authentication/Authorization, Data Protection, Realistic Mitigations.
- **Cloud/Cost Agent**: Accuracy, Cost Efficiency, Resource Optimization, Metric Clarity.
- **DevSecOps Agent**: CI/CD Completeness, Container Security, Secrets Management, Testing, Deployment Safety.
- **QA Agent**: Test Coverage, Edge Cases, Acceptance Criteria, Negative Scenarios.
- **Synthesis Agent**: Coherence, Completeness, Integration Depth, Clarity.

---

## 4. Leaderboard & Model Selection

The leaderboard acts as an aggregator of average quality scores, latency, failure rates, and token counts. Benchmark results should be used as evidence to config static model routing for production runs:
- **High-reasoning/complex agents** (e.g., Security, Architecture) should route to models with high semantic quality scores.
- **Simpler/structural agents** (e.g., QA, Cloud/Cost) can route to cheaper, faster models if they maintain a low failure rate and high schema validity.
