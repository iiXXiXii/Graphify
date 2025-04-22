import { execSync } from 'child_process';

describe('Graphify CLI (E2E)', () => {
  it('lists available patterns', () => {
    const out = execSync('node ./dist/cli/index.js list-patterns', { encoding: 'utf-8' });
    expect(out).toMatch(/random/i);
    expect(out).toMatch(/realistic/i);
  });

  it('generates a pattern', () => {
    const out = execSync('node ./dist/cli/index.js generate --pattern random --commit-count 10', { encoding: 'utf-8' });
    expect(out.toLowerCase()).toContain('pattern');
    expect(out).toMatch(/\[\[.*\]\]/s);
  });
});
