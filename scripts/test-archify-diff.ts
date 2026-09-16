import { compareArchitectureDocuments } from '../src/review/diff-service.js';
import type { ArchitectureDocument } from '../src/generation/schemas.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const beforeDoc: ArchitectureDocument = {
  components: [
    {
      name: 'ApiGateway',
      layer: 'interface',
      responsibilities: ['Route incoming HTTP requests', 'JWT Authentication'],
      dependencies: ['OrderService'],
    },
    {
      name: 'OrderService',
      layer: 'domain',
      responsibilities: ['Process customer order domain logic'],
      dependencies: ['PostgresDatabase'],
    },
    {
      name: 'PostgresDatabase',
      layer: 'infrastructure',
      responsibilities: ['Persist orders and users'],
      dependencies: [],
    },
  ],
  dependencyGraph: [
    { from: 'ApiGateway', to: 'OrderService' },
    { from: 'OrderService', to: 'PostgresDatabase' },
  ],
  boundedContexts: [
    { name: 'Order Management Context', aggregates: ['OrderService'], responsibilities: ['Order domain'] },
  ],
  solidNotes: ['Single Responsibility Principle'],
};

const afterDoc: ArchitectureDocument = {
  components: [
    {
      name: 'ApiGateway',
      layer: 'interface',
      responsibilities: ['Route incoming HTTP requests', 'JWT Authentication', 'Rate Limiting & Throttling'], // Modified
      dependencies: ['OrderService', 'NotificationService'], // Modified edge
    },
    {
      name: 'OrderService',
      layer: 'application', // Modified layer: domain -> application
      responsibilities: ['Process customer order domain logic'],
      dependencies: ['PostgresDatabase'],
    },
    {
      name: 'NotificationService', // Added node
      layer: 'infrastructure',
      responsibilities: ['Dispatch email and push notifications'],
      dependencies: [],
    },
    {
      name: 'PostgresDatabase',
      layer: 'infrastructure',
      responsibilities: ['Persist orders and users'],
      dependencies: [],
    },
  ],
  dependencyGraph: [
    { from: 'ApiGateway', to: 'OrderService' },
    { from: 'OrderService', to: 'PostgresDatabase' },
    { from: 'ApiGateway', to: 'NotificationService' }, // Added edge
  ],
  boundedContexts: [
    { name: 'Order Management Context', aggregates: ['OrderService'], responsibilities: ['Order domain'] },
    { name: 'Notification Context', aggregates: ['NotificationService'], responsibilities: ['Notifications'] }, // Added cluster
  ],
  solidNotes: ['Single Responsibility Principle', 'Open/Closed Principle'],
};

console.log('Generating Archify Architecture Diff Report...');

const result = compareArchitectureDocuments(beforeDoc, afterDoc, 'E-Commerce Refactor PR #42');

const outDir = join(process.cwd(), 'scratch');
mkdirSync(outDir, { recursive: true });

const htmlPath = join(outDir, 'architecture-diff.html');
writeFileSync(htmlPath, result.htmlReport, 'utf-8');

console.log('\n--- Summary ---');
console.log(result.summaryText);
console.log(`\nDiff Report HTML saved to: file://${htmlPath}`);
console.log('Open it in your browser to test the interactive Before / Delta / After tabs!');
