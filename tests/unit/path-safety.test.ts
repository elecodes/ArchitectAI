import { describe, it, expect } from 'vitest';
import { resolveContainedPath, PathContainmentError } from '../../src/utils/path-safety.js';

const ROOT = '/srv/app';

describe('resolveContainedPath', () => {
  it('resolves a relative path against the root', () => {
    expect(resolveContainedPath('projects/foo', [ROOT])).toBe('/srv/app/projects/foo');
  });

  it('passes through an absolute path inside the root', () => {
    expect(resolveContainedPath('/srv/app/projects/foo', [ROOT])).toBe('/srv/app/projects/foo');
  });

  it('passes through the root itself', () => {
    expect(resolveContainedPath('/srv/app', [ROOT])).toBe('/srv/app');
  });

  it('rejects an absolute path outside the root', () => {
    expect(() => resolveContainedPath('/etc/passwd', [ROOT])).toThrow(PathContainmentError);
  });

  it('rejects a path traversal escape', () => {
    expect(() => resolveContainedPath('/srv/app/../../etc/passwd', [ROOT])).toThrow(
      PathContainmentError,
    );
  });

  it('accepts a path under any of the allowed roots', () => {
    expect(resolveContainedPath('/home/elena/repo', ['/srv/app', '/home/elena'])).toBe(
      '/home/elena/repo',
    );
  });
});
