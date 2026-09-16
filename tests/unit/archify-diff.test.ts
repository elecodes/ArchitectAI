import { describe, it, expect } from 'vitest';
import { generateArchifyIR } from '../../src/diagrams/archify.js';
import { compareArchifyIR, compileArchifyDiffHtml } from '../../src/diagrams/archify-diff.js';
import { compareArchitectureDocuments } from '../../src/review/diff-service.js';
import type { ArchitectureDocument } from '../../src/generation/schemas.js';

describe('Archify Architecture Diff Engine', () => {
  const beforeDoc: ArchitectureDocument = {
    components: [
      {
        name: 'ApiGateway',
        layer: 'interface',
        responsibilities: ['Route requests'],
        dependencies: ['OrderService'],
      },
      {
        name: 'OrderService',
        layer: 'domain',
        responsibilities: ['Process orders'],
        dependencies: [],
      },
    ],
    dependencyGraph: [{ from: 'ApiGateway', to: 'OrderService' }],
    boundedContexts: [{ name: 'Order Context', aggregates: ['OrderService'], responsibilities: ['Order domain'] }],
    solidNotes: [],
  };

  const afterDoc: ArchitectureDocument = {
    components: [
      {
        name: 'ApiGateway',
        layer: 'interface',
        responsibilities: ['Route requests', 'Rate limit'],
        dependencies: ['OrderService', 'NotificationService'],
      },
      {
        name: 'OrderService',
        layer: 'application', // Changed layer from domain -> application
        responsibilities: ['Process orders'],
        dependencies: [],
      },
      {
        name: 'NotificationService', // Added new component
        layer: 'infrastructure',
        responsibilities: ['Send emails'],
        dependencies: [],
      },
    ],
    dependencyGraph: [
      { from: 'ApiGateway', to: 'OrderService' },
      { from: 'ApiGateway', to: 'NotificationService' }, // Added edge
    ],
    boundedContexts: [{ name: 'Order Context', aggregates: ['OrderService'], responsibilities: ['Order domain'] }],
    solidNotes: [],
  };

  describe('compareArchifyIR', () => {
    it('detects added, modified, and unchanged nodes/edges', () => {
      const beforeIR = generateArchifyIR(beforeDoc, 'v1');
      const afterIR = generateArchifyIR(afterDoc, 'v2');

      const diff = compareArchifyIR(beforeIR, afterIR, 'Refactor Diff');

      expect(diff.title).toBe('Refactor Diff');
      expect(diff.summary.nodesAdded).toBe(1); // NotificationService added
      expect(diff.summary.nodesModified).toBe(2); // OrderService layer + ApiGateway responsibilities
      expect(diff.summary.edgesAdded).toBe(1); // ApiGateway -> NotificationService added

      const added = diff.nodeChanges.find((c) => c.changeType === 'added');
      expect(added?.node.label).toBe('NotificationService');

      const modified = diff.nodeChanges.find((c) => c.changeType === 'modified' && c.node.label === 'OrderService');
      expect(modified?.node.label).toBe('OrderService');
      expect(modified?.details).toContain('Layer changed from domain to application');
    });
  });

  describe('compileArchifyDiffHtml', () => {
    it('generates HTML containing tabbed Before, Delta, and After views', () => {
      const beforeIR = generateArchifyIR(beforeDoc, 'v1');
      const afterIR = generateArchifyIR(afterDoc, 'v2');
      const diff = compareArchifyIR(beforeIR, afterIR, 'System Evolution');

      const html = compileArchifyDiffHtml(diff);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('System Evolution');
      expect(html).toContain('pane-delta');
      expect(html).toContain('pane-before');
      expect(html).toContain('pane-after');
      expect(html).toContain('NotificationService');
      expect(html).toContain('Nodes Added');
    });
  });

  describe('compareArchitectureDocuments (Review Diff Service)', () => {
    it('creates a complete ReviewDiffPackage with summary text and HTML', () => {
      const pkg = compareArchitectureDocuments(beforeDoc, afterDoc, 'PR #42 Architecture Review');

      expect(pkg.summaryText).toContain('1 nodes added');
      expect(pkg.htmlReport).toContain('PR #42 Architecture Review');
      expect(pkg.diffResult.summary.totalChanges).toBe(4);
    });
  });
});
