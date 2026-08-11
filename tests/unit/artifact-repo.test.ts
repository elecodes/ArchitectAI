import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/connection.js', () => ({
  getPool: () => poolMock,
}));

let poolMock: { query: ReturnType<typeof vi.fn> };

import { getArtifact, listArtifacts } from '../../src/db/repositories/artifact-repo.js';

describe('artifact-repo ownership scoping', () => {
  beforeEach(() => {
    poolMock = { query: vi.fn() };
  });

  it('getArtifact scopes the query to the artifact owner', async () => {
    poolMock.query.mockResolvedValue({ rows: [] });
    await getArtifact('art-1', 'user-1');

    const [sql, params] = poolMock.query.mock.calls[0];
    expect(sql).toContain('JOIN projects p ON p.id = a.project_id');
    expect(sql).toContain('p.owner_id = $2');
    expect(params).toEqual(['art-1', 'user-1']);
  });

  it('listArtifacts scopes to the project owner', async () => {
    poolMock.query.mockResolvedValue({ rows: [] });
    await listArtifacts('proj-1', 'user-1', 'specification');

    const [sql, params] = poolMock.query.mock.calls[0];
    expect(sql).toContain('JOIN projects p ON p.id = a.project_id');
    expect(sql).toContain('a.type = $3');
    expect(params).toEqual(['proj-1', 'user-1', 'specification']);
  });
});
