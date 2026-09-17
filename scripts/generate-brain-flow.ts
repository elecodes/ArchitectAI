import { compileArchifyHtml, type ArchifyDiagramIR } from '../src/diagrams/archify.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AI Brain Cognitive Workflow — Archify Diagram Generator
 *
 * Generates an interactive Archify system diagram tracking the 7-agent multi-step cognitive pipeline,
 * parallel execution forks (Security & Cloud Cost), memory context stores, and synthesis engine.
 */

export function generateBrainFlowIR(createdAt: string = new Date().toISOString()): ArchifyDiagramIR {
  return {
    version: '2.17.0',
    meta: {
      title: 'ArchitectAI — AI Agent Brain Cognitive Workflow',
      description: '7-Agent multi-phase cognitive reasoning pipeline, parallel execution graph, and RAG context memory flow.',
      preset: 'signal-flow',
      theme: 'dark',
      createdAt,
      solidNotes: [
        'Single Responsibility: Each agent enforces strict Zod input/output contract schemas.',
        'Open/Closed: LLM Provider Factory allows swapping model backends without touching agent logic.',
        'Parallel Execution: Security and Cloud/Cost agents execute concurrently after Phase 2.',
      ],
    },
    nodes: [
      {
        id: 'user_prompt_intake',
        label: '0. Prompt Intake & Normalizer',
        role: 'interface',
        layer: 'Intake Phase',
        boundedContext: 'Intake & Briefing Boundary',
        responsibilities: [
          'Normalizes unstructured user request into an Architectural Brief',
          'Detects requirement ambiguities and generates interactive intake questions if required',
        ],
      },
      {
        id: 'requirements_agent',
        label: '1. Requirements Agent',
        role: 'domain',
        layer: 'Cognitive Specification',
        boundedContext: 'Core Design Boundary',
        responsibilities: [
          'Formulates functional and non-functional engineering requirements',
          'Establishes acceptance criteria, priority matrices, and technical constraints',
        ],
      },
      {
        id: 'architecture_agent',
        label: '2. Architecture Agent',
        role: 'domain',
        layer: 'Cognitive Architecture',
        boundedContext: 'Core Design Boundary',
        responsibilities: [
          'Designs system component topology, bounded contexts, and SOLID notes',
          'Compiles initial Archify IR structure and Mermaid C4 diagrams',
        ],
      },
      {
        id: 'security_agent',
        label: '3. Security Threat Agent (Parallel Fork)',
        role: 'domain',
        layer: 'Security Analysis',
        boundedContext: 'Security & Infrastructure Fork',
        responsibilities: [
          'Performs STRIDE threat modeling and OWASP Top 10 LLM risk audits',
          'Generates authentication controls, RBAC policies, and mitigation strategies',
        ],
      },
      {
        id: 'cloud_cost_agent',
        label: '4. Cloud & Cost Agent (Parallel Fork)',
        role: 'domain',
        layer: 'Cloud Infrastructure',
        boundedContext: 'Security & Infrastructure Fork',
        responsibilities: [
          'Maps cloud resource choices across AWS/GCP services',
          'Calculates cost estimates, scaling thresholds, and cost-safety guards',
        ],
      },
      {
        id: 'devsecops_agent',
        label: '5. DevSecOps Agent',
        role: 'domain',
        layer: 'Deployment Pipelines',
        boundedContext: 'Verification & Synthesis Boundary',
        responsibilities: [
          'Generates GitHub Actions CI/CD workflows and Docker container specs',
          'Defines deployment runbooks, health checks, and rollback procedures',
        ],
      },
      {
        id: 'qa_agent',
        label: '6. QA & Testing Agent',
        role: 'domain',
        layer: 'Quality Assurance',
        boundedContext: 'Verification & Synthesis Boundary',
        responsibilities: [
          'Formulates automated test strategies, E2E Playwright scenarios, and Vitest unit suites',
          'Enforces requirement traceability coverage metrics',
        ],
      },
      {
        id: 'synthesis_agent',
        label: '7. Synthesis & Consolidation Engine',
        role: 'application',
        layer: 'Package Synthesis',
        boundedContext: 'Verification & Synthesis Boundary',
        responsibilities: [
          'Consolidates all multi-agent outputs into a unified engineering specification package',
          'Generates final Archify JSON IR, interactive HTML map, and ZIP bundle',
        ],
      },
      {
        id: 'rag_memory_context',
        label: 'RAG Context Fitting & Memory Store',
        role: 'infrastructure',
        layer: 'Shared Memory',
        boundedContext: 'Cognitive Memory Infrastructure',
        responsibilities: [
          'Shared context store feeding prior agent outputs into downstream prompts',
          'Performs chunking and vector similarity retrieval over project codebase',
        ],
      },
      {
        id: 'llm_factory',
        label: 'LLM Provider Factory & Provider Pool',
        role: 'external',
        layer: 'LLM Execution Infrastructure',
        boundedContext: 'Cognitive Memory Infrastructure',
        responsibilities: [
          'Provider abstraction for OpenRouter, OpenAI, Bedrock, Ollama, Groq, Google Gemini',
          'Enforces capability whitelist, Zod schema validation, and exponential backoff retry',
        ],
      },
    ],
    edges: [
      {
        id: 'flow_0_1',
        from: 'user_prompt_intake',
        to: 'requirements_agent',
        label: '1. Normalized Architectural Brief',
        flowType: 'sync',
      },
      {
        id: 'flow_1_2',
        from: 'requirements_agent',
        to: 'architecture_agent',
        label: '2. Functional Specs & Constraints',
        flowType: 'sync',
      },
      {
        id: 'flow_2_3',
        from: 'architecture_agent',
        to: 'security_agent',
        label: '3a. Parallel Fork: Topology to Security Engine',
        flowType: 'async',
      },
      {
        id: 'flow_2_4',
        from: 'architecture_agent',
        to: 'cloud_cost_agent',
        label: '3b. Parallel Fork: Topology to Cloud/Cost Engine',
        flowType: 'async',
      },
      {
        id: 'flow_3_4_5',
        from: 'security_agent',
        to: 'devsecops_agent',
        label: '4. Joined Parallel Output: Security Controls',
        flowType: 'sync',
      },
      {
        id: 'flow_4_5',
        from: 'cloud_cost_agent',
        to: 'devsecops_agent',
        label: '4. Joined Parallel Output: Topology Specs',
        flowType: 'sync',
      },
      {
        id: 'flow_5_6',
        from: 'devsecops_agent',
        to: 'qa_agent',
        label: '5. Pipeline Specs & Deployment Boundaries',
        flowType: 'sync',
      },
      {
        id: 'flow_6_7',
        from: 'qa_agent',
        to: 'synthesis_agent',
        label: '6. Test Plans & Traceability Specs',
        flowType: 'sync',
      },
      {
        id: 'flow_memory_all',
        from: 'rag_memory_context',
        to: 'synthesis_agent',
        label: 'Context Memory Injection',
        flowType: 'data',
      },
      {
        id: 'flow_llm_execution',
        from: 'llm_factory',
        to: 'rag_memory_context',
        label: 'Provider Inference & Token Metrics',
        flowType: 'data',
      },
    ],
    clusters: [
      {
        id: 'intake_cluster',
        name: 'Intake & Briefing Boundary',
        nodes: ['user_prompt_intake'],
        responsibilities: ['Prompt intake', 'Ambiguity detection', 'Architectural brief creation'],
      },
      {
        id: 'core_design_cluster',
        name: 'Core Cognitive Design Boundary',
        nodes: ['requirements_agent', 'architecture_agent'],
        responsibilities: ['Requirements engineering', 'Component design', 'Bounded context mapping'],
      },
      {
        id: 'security_cloud_cluster',
        name: 'Security & Infrastructure Parallel Fork',
        nodes: ['security_agent', 'cloud_cost_agent'],
        responsibilities: ['Concurrent execution', 'STRIDE threat modeling', 'Cloud cost optimization'],
      },
      {
        id: 'verification_synthesis_cluster',
        name: 'Verification & Package Synthesis',
        nodes: ['devsecops_agent', 'qa_agent', 'synthesis_agent'],
        responsibilities: ['CI/CD pipeline generation', 'Test planning', 'Archify HTML & ZIP compilation'],
      },
      {
        id: 'memory_infra_cluster',
        name: 'Cognitive Memory & LLM Infrastructure',
        nodes: ['rag_memory_context', 'llm_factory'],
        responsibilities: ['Shared agent memory', 'RAG context fitting', 'Multi-provider LLM inference'],
      },
    ],
    stories: [
      {
        id: 'cognitive_reasoning_story',
        title: '7-Agent Cognitive Reasoning Pipeline',
        description:
          'Trace of raw prompt intake through sequential and parallel multi-agent reasoning, RAG memory enrichment, and Archify HTML synthesis.',
        activeNodes: [
          'user_prompt_intake',
          'requirements_agent',
          'architecture_agent',
          'security_agent',
          'cloud_cost_agent',
          'devsecops_agent',
          'qa_agent',
          'synthesis_agent',
          'rag_memory_context',
          'llm_factory',
        ],
        activeEdges: [
          'flow_0_1',
          'flow_1_2',
          'flow_2_3',
          'flow_2_4',
          'flow_3_4_5',
          'flow_4_5',
          'flow_5_6',
          'flow_6_7',
          'flow_memory_all',
          'flow_llm_execution',
        ],
      },
    ],
  };
}

export function automateBrainFlowGeneration(outDir?: string): void {
  const createdAt = new Date().toISOString();
  console.log(`[Brain Archify Automation] Generating AI Brain Cognitive Flow at timestamp: ${createdAt}`);

  const targetDir = outDir || join(process.cwd(), 'docs', 'architecture');
  mkdirSync(targetDir, { recursive: true });

  const brainIR = generateBrainFlowIR(createdAt);
  const html = compileArchifyHtml(brainIR);

  const jsonPath = join(targetDir, 'brain-flow.json');
  const htmlPath = join(targetDir, 'brain-flow.html');

  writeFileSync(jsonPath, JSON.stringify(brainIR, null, 2), 'utf-8');
  writeFileSync(htmlPath, html, 'utf-8');

  console.log(` ✓ AI Brain JSON IR saved to: ${jsonPath}`);
  console.log(` ✓ AI Brain Interactive HTML saved to: ${htmlPath}`);
}

automateBrainFlowGeneration();
