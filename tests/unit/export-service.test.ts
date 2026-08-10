import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { buildPackageZip, storeExportPackage } from '../../src/storage/export-service.js';
import type { Artifact } from '../../src/db/repositories/artifact-repo.js';
import type { DocumentStore } from '../../src/storage/document-store.js';

function artifact(type: string, content: Record<string, unknown>): Artifact {
  return {
    id: `id-${type}`,
    projectId: 'p1',
    type,
    content,
    parentArtifactId: null,
    model: 'mock-model',
    promptVersion: 'v1',
    generatedAt: new Date(),
    contextWindowUsed: 0,
    ragChunksUsed: 0,
    retryCount: 0,
    createdAt: new Date(),
  };
}

describe('buildPackageZip', () => {
  it('assembles a package with all artifact folders', async () => {
    const zipBuf = await buildPackageZip({
      projectName: 'Task Planner',
      description: 'A planner app',
      artifacts: [
        artifact('product_vision', {
          vision: 'v',
          problem: 'p',
          targetUsers: ['user'],
          businessGoals: ['goal'],
          coreCapabilities: [],
          successMetrics: [],
        }),
        artifact('specification', {
          functionalRequirements: [{ id: 'FR-1', description: 'd', priority: 'must' }],
          acceptanceCriteria: ['AC'],
          constraints: [],
          dependencies: [],
        }),
        artifact('architecture', {
          components: [{ name: 'Api', layer: 'interface', responsibilities: ['R'] }],
          boundedContexts: [],
        }),
        artifact('diagrams', {
          componentDiagram: 'flowchart TD\n  A-->B',
          containerDiagram: 'flowchart LR\n  X-->Y',
        }),
        artifact('risk_assessment', {
          risks: [
            { id: 'R1', description: 'd', category: 'c', severity: 'high', mitigation: 'm' },
          ],
        }),
        artifact('task_breakdown', {
          traceabilityCoverage: 100,
          tasks: [{ id: 'T1', title: 't', complexity: 2, description: 'x' }],
        }),
      ],
    });

    const zip = await JSZip.loadAsync(zipBuf);
    const names = Object.keys(zip.files);
    expect(names).toContain('README.md');
    expect(names).toContain('01-product-vision/vision.md');
    expect(names).toContain('02-requirements/requirements.md');
    expect(names).toContain('03-architecture/architecture.md');
    expect(names).toContain('04-diagrams/component.mmd');
    expect(names).toContain('04-diagrams/container.mmd');
    expect(names).toContain('06-risk-assessment/risks.md');
    expect(names).toContain('07-tasks/tasks.md');
    expect(names).toContain('04_Metadata.md');
  });

  it('produces readable markdown content', async () => {
    const zipBuf = await buildPackageZip({
      projectName: 'P',
      description: undefined,
      artifacts: [
        artifact('specification', {
          functionalRequirements: [{ id: 'FR-1', description: 'Login', priority: 'must' }],
          acceptanceCriteria: ['WHEN user logs in THEN session starts'],
          constraints: [],
          dependencies: [],
        }),
      ],
    });
    const zip = await JSZip.loadAsync(zipBuf);
    const md = await zip.file('02-requirements/requirements.md')?.async('string');
    expect(md).toContain('## FR-1: Login');
    expect(md).toContain('WHEN user logs in');
  });
});

describe('storeExportPackage', () => {
  it('stores under a dated exports key', async () => {
    const store = {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
      deleteObject: vi.fn(),
      listObjects: vi.fn(),
    } as unknown as DocumentStore;

    const result = await storeExportPackage(store, 'p1', Buffer.from('x'));

    expect(result.sizeBytes).toBe(1);
    expect(result.key).toMatch(/^exports\/p1\/\d{4}-\d{2}-\d{2}\/package\.zip$/);
    expect(store.putObject).toHaveBeenCalledWith(
      result.key,
      Buffer.from('x'),
      'application/zip',
    );
  });
});
