import { generateArchifyIR, compileArchifyHtml } from '../src/diagrams/archify.js';
import type { ArchitectureDocument } from '../src/generation/schemas.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const architectAiDoc: ArchitectureDocument = {
  components: [
    {
      name: 'ExpressAPI',
      layer: 'interface',
      responsibilities: [
        'Expose REST API endpoints for generation, review, export, and telemetry',
        'Handle JWT Authentication and Rate Limiting',
        'Serve React frontend static assets',
      ],
      dependencies: ['AgentOrchestrator', 'ReviewPipeline', 'DocumentStore', 'TelemetryService'],
    },
    {
      name: 'AgentOrchestrator',
      layer: 'application',
      responsibilities: [
        'Coordinate execution of the 7 typed agents in sequential and parallel forks',
        'Manage workflow state, safe-stop gates, and execution graph',
      ],
      dependencies: [
        'RequirementsAgent',
        'ArchitectureAgent',
        'SecurityAgent',
        'CloudCostAgent',
        'DevSecOpsAgent',
        'QAAgent',
        'SynthesisAgent',
      ],
    },
    {
      name: 'AgentRunner',
      layer: 'application',
      responsibilities: [
        'Shared agent infrastructure: RAG context fitting, Zod validation, retry, timeout',
        'Capability whitelist enforcement (OWASP LLM06 Excessive Agency mitigation)',
      ],
      dependencies: ['LLMProviderFactory', 'RAGService'],
    },
    {
      name: 'RequirementsAgent',
      layer: 'domain',
      responsibilities: ['Generate functional requirements, constraints, assumptions, and acceptance criteria'],
      dependencies: ['AgentRunner'],
    },
    {
      name: 'ArchitectureAgent',
      layer: 'domain',
      responsibilities: ['Design system components, bounded contexts, layer responsibilities, and SOLID notes'],
      dependencies: ['AgentRunner'],
    },
    {
      name: 'SecurityAgent',
      layer: 'domain',
      responsibilities: ['Perform threat modeling, OWASP LLM risk analysis, and security controls'],
      dependencies: ['AgentRunner'],
    },
    {
      name: 'CloudCostAgent',
      layer: 'domain',
      responsibilities: ['Produce cloud infrastructure topology, AWS/GCP resource choices, and cost safety estimates'],
      dependencies: ['AgentRunner'],
    },
    {
      name: 'DevSecOpsAgent',
      layer: 'domain',
      responsibilities: ['Define CI/CD pipelines, containerization specs, and deployment runbooks'],
      dependencies: ['AgentRunner'],
    },
    {
      name: 'QAAgent',
      layer: 'domain',
      responsibilities: ['Formulate automated test plans, E2E scenarios, and test data requirements'],
      dependencies: ['AgentRunner'],
    },
    {
      name: 'SynthesisAgent',
      layer: 'domain',
      responsibilities: ['Aggregate outputs into a cohesive engineering package and generate Mermaid + Archify diagrams'],
      dependencies: ['AgentRunner', 'ArchifyEngine'],
    },
    {
      name: 'ArchifyEngine',
      layer: 'domain',
      responsibilities: ['Transform ArchitectureDocument to Archify JSON IR and compile interactive HTML maps & diffs'],
      dependencies: [],
    },
    {
      name: 'LLMProviderFactory',
      layer: 'infrastructure',
      responsibilities: ['Provider abstraction for Google Gemini, OpenAI, Bedrock, Groq, OpenRouter, Ollama, Mock'],
      dependencies: [],
    },
    {
      name: 'DocumentStore',
      layer: 'infrastructure',
      responsibilities: ['Store generated artifacts on Local Filesystem or AWS S3'],
      dependencies: [],
    },
    {
      name: 'PostgresDatabase',
      layer: 'infrastructure',
      responsibilities: ['Persist projects, generation telemetry, golden datasets, and pgvector embeddings'],
      dependencies: [],
    },
  ],
  dependencyGraph: [
    { from: 'ExpressAPI', to: 'AgentOrchestrator' },
    { from: 'AgentOrchestrator', to: 'RequirementsAgent' },
    { from: 'AgentOrchestrator', to: 'ArchitectureAgent' },
    { from: 'AgentOrchestrator', to: 'SecurityAgent' },
    { from: 'AgentOrchestrator', to: 'CloudCostAgent' },
    { from: 'AgentOrchestrator', to: 'DevSecOpsAgent' },
    { from: 'AgentOrchestrator', to: 'QAAgent' },
    { from: 'AgentOrchestrator', to: 'SynthesisAgent' },
    { from: 'RequirementsAgent', to: 'AgentRunner' },
    { from: 'ArchitectureAgent', to: 'AgentRunner' },
    { from: 'SecurityAgent', to: 'AgentRunner' },
    { from: 'CloudCostAgent', to: 'AgentRunner' },
    { from: 'DevSecOpsAgent', to: 'AgentRunner' },
    { from: 'QAAgent', to: 'AgentRunner' },
    { from: 'SynthesisAgent', to: 'AgentRunner' },
    { from: 'SynthesisAgent', to: 'ArchifyEngine' },
    { from: 'AgentRunner', to: 'LLMProviderFactory' },
    { from: 'ExpressAPI', to: 'DocumentStore' },
    { from: 'ExpressAPI', to: 'PostgresDatabase' },
  ],
  boundedContexts: [
    {
      name: 'Agent System Context',
      aggregates: [
        'AgentOrchestrator',
        'AgentRunner',
        'RequirementsAgent',
        'ArchitectureAgent',
        'SecurityAgent',
        'CloudCostAgent',
        'DevSecOpsAgent',
        'QAAgent',
        'SynthesisAgent',
      ],
      responsibilities: ['Multi-agent pipeline generation and execution'],
    },
    {
      name: 'Diagramming Engine Context',
      aggregates: ['ArchifyEngine'],
      responsibilities: ['JSON IR transformation, interactive HTML compilation, and architecture diffs'],
    },
    {
      name: 'Persistence & Infrastructure Context',
      aggregates: ['PostgresDatabase', 'DocumentStore', 'LLMProviderFactory'],
      responsibilities: ['Multi-provider LLM abstraction, document storage, and telemetry database'],
    },
  ],
  solidNotes: [
    'Single Responsibility Principle: Each agent has an explicit, single responsibility and Zod schema',
    'Open/Closed Principle: LLMProviderFactory allows adding new providers without mutating core agent logic',
    'Dependency Inversion Principle: High-level orchestrator depends on abstract AgentRunner infrastructure',
  ],
};

console.log('Generating official ArchitectAI System Map with Archify...');

const ir = generateArchifyIR(architectAiDoc, 'ArchitectAI v1.6.0 Architecture System Map');
const html = compileArchifyHtml(ir);

const outDir = join(process.cwd(), 'docs', 'architecture');
mkdirSync(outDir, { recursive: true });

const jsonPath = join(outDir, 'system-map.json');
const htmlPath = join(outDir, 'system-map.html');

writeFileSync(jsonPath, JSON.stringify(ir, null, 2), 'utf-8');
writeFileSync(htmlPath, html, 'utf-8');

console.log(`\nSystem Map JSON IR saved to: ${jsonPath}`);
console.log(`System Map Interactive HTML saved to: file://${htmlPath}`);
