import { describe, it, expect } from 'vitest';
import { normalizeUserIntakeResponse } from '../../src/agents/intake-normalizer.js';
import type { IntakeQuestion } from '../../src/agents/schemas/intake.js';

describe('Semantic Brief Normalizer', () => {
  const sampleQuestions: IntakeQuestion[] = [
    {
      id: 'scale_expectation',
      category: 'scale',
      question: 'What scale do you expect?',
      options: ['<10k', '10k-100k', '100k-1M', '>1M'],
      recommendation: '10k-100k',
      rationale: 'Mid-range sizing.',
    },
    {
      id: 'backend_language',
      category: 'stack',
      question: 'Which backend stack?',
      options: ['Node.js (Express)', 'Python (FastAPI)', 'Go (Gin)'],
      recommendation: 'Node.js (Express)',
      rationale: 'Mature ecosystem.',
    },
    {
      id: 'latency_target',
      category: 'latency',
      question: 'What is your latency target?',
      options: ['<100ms', '100-300ms', '>500ms'],
      recommendation: '<100ms',
      rationale: 'Fast delivery.',
    },
  ];

  it('normalizes exact matching options', () => {
    const rawAnswers = {
      scale_expectation: '10k-100k',
      backend_language: 'Go (Gin)',
    };

    const normalized = normalizeUserIntakeResponse(rawAnswers, sampleQuestions);
    expect(normalized.scale_expectation).toBe('10k-100k');
    expect(normalized.backend_language).toBe('Go (Gin)');
    expect(normalized.latency_target).toBe('<100ms'); // Fallback to default
  });

  it('translates fuzzy non-technical write-ins using phrase mappings', () => {
    const rawAnswers = {
      scale_expectation: 'make it massive traffic',
      latency_target: 'needs to be super fast',
    };

    const normalized = normalizeUserIntakeResponse(rawAnswers, sampleQuestions);
    expect(normalized.scale_expectation).toBe('>1M concurrent users');
    expect(normalized.latency_target).toBe('<100ms real-time delivery');
    expect(normalized.backend_language).toBe('Node.js (Express)'); // Default
  });

  it('falls back to recommended defaults when answers are blank or skipped', () => {
    const normalized = normalizeUserIntakeResponse({}, sampleQuestions);
    expect(normalized.scale_expectation).toBe('10k-100k');
    expect(normalized.backend_language).toBe('Node.js (Express)');
    expect(normalized.latency_target).toBe('<100ms');
  });

  it('preserves custom detailed write-in text', () => {
    const rawAnswers = {
      backend_language: 'Rust with Axum web framework',
    };

    const normalized = normalizeUserIntakeResponse(rawAnswers, sampleQuestions);
    expect(normalized.backend_language).toBe('Rust with Axum web framework');
  });
});
