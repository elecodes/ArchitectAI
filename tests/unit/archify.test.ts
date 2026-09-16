import { describe, it, expect } from 'vitest';
import { generateArchifyIR, compileArchifyHtml } from '../../src/diagrams/archify.js';
import type { ArchitectureDocument } from '../../src/generation/schemas.js';

describe('Archify Diagram Generator', () => {
  const sampleArchDoc: ArchitectureDocument = {
    components: [
      {
        name: 'ApiGateway',
        layer: 'interface',
        responsibilities: ['Route incoming HTTP requests', 'Authenticate JWT tokens'],
        dependencies: ['AuthService', 'OrderService'],
      },
      {
        name: 'OrderService',
        layer: 'domain',
        responsibilities: ['Process customer order workflow'],
        dependencies: ['PostgresDatabase'],
      },
      {
        name: 'PostgresDatabase',
        layer: 'infrastructure',
        responsibilities: ['Persist order and user records'],
        dependencies: [],
      },
    ],
    dependencyGraph: [
      { from: 'ApiGateway', to: 'OrderService' },
      { from: 'OrderService', to: 'PostgresDatabase' },
    ],
    boundedContexts: [
      {
        name: 'Order Management Context',
        aggregates: ['OrderService'],
        responsibilities: ['Order processing domain'],
      },
    ],
    solidNotes: ['Single Responsibility enforced on ApiGateway'],
  };

  describe('generateArchifyIR', () => {
    it('generates a valid Archify IR structure from ArchitectureDocument', () => {
      const ir = generateArchifyIR(sampleArchDoc, 'E-Commerce Platform');

      expect(ir.version).toBe('2.17.0');
      expect(ir.meta.title).toBe('E-Commerce Platform');
      expect(ir.meta.preset).toBe('signal-flow');
      expect(ir.meta.theme).toBe('dark');
      expect(ir.meta.solidNotes).toContain('Single Responsibility enforced on ApiGateway');

      expect(ir.nodes).toHaveLength(3);
      expect(ir.nodes[0]).toEqual({
        id: 'apigateway',
        label: 'ApiGateway',
        role: 'interface',
        layer: 'interface',
        responsibilities: ['Route incoming HTTP requests', 'Authenticate JWT tokens'],
      });

      expect(ir.edges).toHaveLength(2);
      expect(ir.edges[0]).toEqual({
        id: 'edge_0_apigateway_orderservice',
        from: 'apigateway',
        to: 'orderservice',
        label: 'uses',
        flowType: 'sync',
      });

      expect(ir.clusters).toHaveLength(1);
      expect(ir.clusters[0].name).toBe('Order Management Context');
      expect(ir.clusters[0].nodes).toContain('orderservice');
    });

    it('assigns database role when infrastructure component name includes data', () => {
      const ir = generateArchifyIR(sampleArchDoc);
      const dbNode = ir.nodes.find((n) => n.id === 'postgresdatabase');
      expect(dbNode?.role).toBe('database');
    });
  });

  describe('compileArchifyHtml', () => {
    it('compiles Archify IR into interactive self-contained HTML page', () => {
      const ir = generateArchifyIR(sampleArchDoc, 'Test Project');
      const html = compileArchifyHtml(ir);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test Project — Archify System Map</title>');
      expect(html).toContain('ApiGateway');
      expect(html).toContain('OrderService');
      expect(html).toContain('PostgresDatabase');
      expect(html).toContain('badge-interface');
      expect(html).toContain('badge-domain');
      expect(html).toContain('badge-database');
      expect(html).toContain('filterNodes');
      expect(html).toContain('toggleTheme');
      expect(html).toContain('exportJSON');
    });
  });
});
