import { describe, it, expect } from 'vitest';
import { OutputValidator } from '../../src/generation/output-validator.js';
import { SpecificationSchema } from '../../src/generation/schemas.js';

describe('OutputValidator', () => {
  const validator = new OutputValidator();

  it('validates valid JSON matching schema', () => {
    const valid = JSON.stringify({
      functionalRequirements: [{ id: 'FR-1', description: 'test', priority: 'must' }],
      acceptanceCriteria: ['WHEN x THEN y'],
      constraints: ['constraint'],
      dependencies: ['dep'],
    });
    const result = validator.validate(valid, SpecificationSchema);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('extracts JSON from markdown code blocks', () => {
    const wrapped = '```json\n{"functionalRequirements":[{"id":"FR-1","description":"test","priority":"must"}],"acceptanceCriteria":["test"],"constraints":[],"dependencies":[]}\n```';
    const result = validator.validate(wrapped, SpecificationSchema);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid JSON', () => {
    const result = validator.validate('not json at all', SpecificationSchema);
    expect(result.success).toBe(false);
    expect(result.error?.parseError).toBeDefined();
  });

  it('returns error for valid JSON with missing fields', () => {
    const missingFields = JSON.stringify({ functionalRequirements: [] });
    const result = validator.validate(missingFields, SpecificationSchema);
    expect(result.success).toBe(false);
    expect(result.error?.zodError).toBeDefined();
  });
});
