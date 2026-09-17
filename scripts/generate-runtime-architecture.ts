import { compileArchifyHtml, type ArchifyDiagramIR } from '../src/diagrams/archify.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const runtimeIR: ArchifyDiagramIR = {
  version: '2.17.0',
  meta: {
    title: 'ArchitectAI — High-Level Runtime Architecture',
    description: '12 core components, primary request path, trust boundaries, and card-level runtime details.',
    preset: 'signal-flow',
    theme: 'dark',
    createdAt: new Date().toISOString(),
    solidNotes: [
      'Single Responsibility: Agents are decoupled with Zod schemas and versioned prompts.',
      'Open/Closed: Provider adapters allow new LLM models without touching core orchestrator.',
      'Dependency Inversion: Higher-level orchestrator depends on abstract LLMClient interface.',
    ],
  },
  nodes: [
    {
      id: 'react_frontend',
      label: '1. React Frontend (SPA)',
      role: 'interface',
      layer: 'Presentation (Client)',
      boundedContext: 'Client Trust Boundary',
      responsibilities: [
        'User interface for prompt intake, model selection, and real-time telemetry tracking',
        'Client-side ZIP package compilation via JSZip & Archify HTML renderer',
        'Untrusted browser context — enforces local JWT session storage',
      ],
    },
    {
      id: 'express_api',
      label: '2. Express API Gateway',
      role: 'interface',
      layer: 'API Gateway & Security',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Authentication (JWT verification) & request correlation ID injection (X-Request-ID)',
        'Rate limiting (5 req/min for index & workflow endpoints)',
        'Path containment & input sanitization before dispatching to orchestrator',
      ],
    },
    {
      id: 'workflow_orchestrator',
      label: '3. Workflow Orchestrator',
      role: 'application',
      layer: 'Orchestration Engine',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Coordinates 7 typed agents in sequential and parallel execution graph',
        'Handles safe-stop gates, state persistence, and telemetry recording',
        'Runs Security & Cloud/Cost agents in parallel after Architecture phase',
      ],
    },
    {
      id: 'agent_runner',
      label: '4. AgentRunner Infrastructure',
      role: 'application',
      layer: 'Agent Execution Container',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Shared agent infrastructure: RAG context fitting, Zod validation, retry, timeout',
        'OWASP LLM06 Excessive Agency mitigation via capability whitelist enforcement',
        'Prompt versioning and provenance tracking',
      ],
    },
    {
      id: 'requirements_agent',
      label: '5. Requirements Agent',
      role: 'domain',
      layer: 'Domain AI Agent',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Transforms raw user prompt into structured functional requirements',
        'Generates acceptance criteria, constraints, and assumptions',
      ],
    },
    {
      id: 'architecture_agent',
      label: '6. Architecture Agent',
      role: 'domain',
      layer: 'Domain AI Agent',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Designs component architecture, layers, bounded contexts, and SOLID compliance',
        'Generates static Mermaid C4 diagrams and Archify JSON IR',
      ],
    },
    {
      id: 'security_agent',
      label: '7. Security Agent',
      role: 'domain',
      layer: 'Domain AI Agent',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Performs STRIDE threat modeling and OWASP Top 10 LLM security analysis',
        'Produces actionable mitigation strategies and authentication controls',
      ],
    },
    {
      id: 'synthesis_agent',
      label: '8. Synthesis Agent',
      role: 'domain',
      layer: 'Domain AI Agent',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Consolidates multi-agent outputs into a cohesive engineering specification',
        'Ensures cross-document consistency before final export package creation',
      ],
    },
    {
      id: 'rag_indexer',
      label: '9. RAG Vector Indexer',
      role: 'infrastructure',
      layer: 'Knowledge Retrieval',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Indexes codebase/project files into fixed-size chunks',
        'Performs vector similarity search to enrich agent prompt contexts',
      ],
    },
    {
      id: 'llm_provider_adapter',
      label: '10. LLM Provider Adapter',
      role: 'external',
      layer: 'External Cloud AI',
      boundedContext: 'External Cloud Services Boundary',
      responsibilities: [
        'Provider-agnostic abstraction for OpenRouter, OpenAI, Bedrock, Ollama, Groq, Google',
        'Handles API keys, model fallbacks, rate limit backoffs, and token metrics',
      ],
    },
    {
      id: 'postgres_db',
      label: '11. Postgres & PGVector DB',
      role: 'database',
      layer: 'Data Persistence',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Stores generation telemetry, workflow execution states, and audit logs',
        'Executes cosine similarity searches on vector embeddings (1536 dims)',
      ],
    },
    {
      id: 'export_service',
      label: '12. Export Service & Storage',
      role: 'infrastructure',
      layer: 'Storage & Export',
      boundedContext: 'Application Server Trust Boundary',
      responsibilities: [
        'Assembles final ZIP packages (specs, diagrams, interactive HTML, task lists)',
        'Supports local filesystem storage or opt-in AWS S3 bucket persistence',
      ],
    },
  ],
  edges: [
    {
      id: 'primary_1_2',
      from: 'react_frontend',
      to: 'express_api',
      label: '1. HTTP POST /api/agent-workflows (JWT Auth)',
      flowType: 'sync',
    },
    {
      id: 'primary_2_3',
      from: 'express_api',
      to: 'workflow_orchestrator',
      label: '2. Dispatches workflow execution graph',
      flowType: 'sync',
    },
    {
      id: 'primary_3_4',
      from: 'workflow_orchestrator',
      to: 'agent_runner',
      label: '3. Invokes shared agent execution container',
      flowType: 'sync',
    },
    {
      id: 'primary_4_6',
      from: 'agent_runner',
      to: 'architecture_agent',
      label: '4. Executes Architecture Agent prompt phase',
      flowType: 'sync',
    },
    {
      id: 'primary_6_10',
      from: 'architecture_agent',
      to: 'llm_provider_adapter',
      label: '5. Queries LLM model (OpenRouter/Bedrock/Groq)',
      flowType: 'sync',
    },
    {
      id: 'primary_6_9',
      from: 'architecture_agent',
      to: 'rag_indexer',
      label: '6. Fetches relevant project RAG context',
      flowType: 'sync',
    },
    {
      id: 'primary_9_11',
      from: 'rag_indexer',
      to: 'postgres_db',
      label: '7. Vector search query (pgvector)',
      flowType: 'data',
    },
    {
      id: 'primary_3_12',
      from: 'workflow_orchestrator',
      to: 'export_service',
      label: '8. Compiles final engineering ZIP & Archify HTML',
      flowType: 'sync',
    },
  ],
  clusters: [
    {
      id: 'client_boundary',
      name: 'Client Trust Boundary (Untrusted Browser)',
      nodes: ['react_frontend'],
      responsibilities: ['User input handling', 'JWT storage', 'Client-side ZIP rendering'],
    },
    {
      id: 'app_boundary',
      name: 'Application Server Trust Boundary (Trusted Core)',
      nodes: [
        'express_api',
        'workflow_orchestrator',
        'agent_runner',
        'requirements_agent',
        'architecture_agent',
        'security_agent',
        'synthesis_agent',
        'rag_indexer',
        'postgres_db',
        'export_service',
      ],
      responsibilities: ['Authentication', 'Workflow state machine', 'Security capabilities', 'Data persistence'],
    },
    {
      id: 'external_boundary',
      name: 'External Cloud Services Boundary (Third-Party APIs)',
      nodes: ['llm_provider_adapter'],
      responsibilities: ['LLM inference APIs', 'Cloud provider authentication'],
    },
  ],
  stories: [
    {
      id: 'primary_request_flow',
      title: 'Primary Request Lifecycle',
      description:
        'Trace of a user request from prompt intake in the React SPA down to multi-agent generation, LLM inference, RAG context enrichment, and ZIP package export.',
      activeNodes: [
        'react_frontend',
        'express_api',
        'workflow_orchestrator',
        'agent_runner',
        'architecture_agent',
        'llm_provider_adapter',
        'rag_indexer',
        'postgres_db',
        'export_service',
      ],
      activeEdges: [
        'primary_1_2',
        'primary_2_3',
        'primary_3_4',
        'primary_4_6',
        'primary_6_10',
        'primary_6_9',
        'primary_9_11',
        'primary_3_12',
      ],
    },
  ],
};

const outputDir = join(process.cwd(), 'docs', 'architecture');
mkdirSync(outputDir, { recursive: true });

const jsonPath = join(outputDir, 'runtime-architecture.json');
const htmlPath = join(outputDir, 'runtime-architecture.html');

writeFileSync(jsonPath, JSON.stringify(runtimeIR, null, 2), 'utf-8');
writeFileSync(htmlPath, compileArchifyHtml(runtimeIR), 'utf-8');

console.log(`Runtime Architecture JSON IR saved to: ${jsonPath}`);
console.log(`Runtime Architecture Interactive HTML saved to: ${htmlPath}`);
