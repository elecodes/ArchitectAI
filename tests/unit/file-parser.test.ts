import { describe, it, expect } from 'vitest';
import { matchesPattern, matchesIgnore, parseProjectFiles } from '../../src/rag/file-parser.js';

describe('matchesPattern', () => {
  it('matches .env files exactly', () => {
    expect(matchesPattern('.env', '.env')).toBe(true);
    expect(matchesPattern('src/.env', '.env')).toBe(true);
  });

  it('matches prefix.* globs', () => {
    expect(matchesPattern('.env.production', '.env.*')).toBe(true);
    expect(matchesPattern('.env.local', '.env.*')).toBe(true);
    expect(matchesPattern('prod.env', '.env.*')).toBe(false);
    expect(matchesPattern('README.md', '.env.*')).toBe(false);
  });

  it('matches *.ext globs', () => {
    expect(matchesPattern('id_rsa.key', '*.key')).toBe(true);
    expect(matchesPattern('src/cert.key', '*.key')).toBe(true);
    expect(matchesPattern('package.json', '*.key')).toBe(false);
  });

  it('matches directory patterns', () => {
    expect(matchesPattern('.aws/credentials', '.aws/')).toBe(true);
    expect(matchesPattern('src/.ssh/id_rsa', '.ssh/')).toBe(true);
  });
});

describe('matchesIgnore', () => {
  it('matches a plain directory name at any depth', () => {
    expect(matchesIgnore('build/main.js', 'build')).toBe(true);
    expect(matchesIgnore('src/build/main.js', 'build')).toBe(true);
  });

  it('does not substring-match partial names', () => {
    expect(matchesIgnore('foobar/file.ts', 'foo')).toBe(false);
    expect(matchesIgnore('mybuild/x.ts', 'build')).toBe(false);
  });

  it('falls through to glob matching', () => {
    expect(matchesIgnore('dist/output.min.js', '*.min.js')).toBe(true);
  });
});

describe('parseProjectFiles maxFiles cap', () => {
  it('stops collecting files once the cap is reached', () => {
    const { files } = parseProjectFiles('tests/fixtures', [], 1);
    expect(files.length).toBeLessThanOrEqual(1);
  });
});
