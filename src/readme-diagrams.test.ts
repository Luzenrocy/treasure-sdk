import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string;
  scripts: Record<string, string>;
};
const diagramNames = ['ecosystem', 'plugin-lifecycle', 'sdk-architecture', 'data-security'];

describe('npm README diagrams', () => {
  it('uses versioned SVG assets generated from committed Mermaid sources', () => {
    for (const name of diagramNames) {
      const diagramDirectory = resolve(root, 'docs', 'diagrams');
      expect(existsSync(resolve(diagramDirectory, `${name}.mmd`))).toBe(true);
      expect(existsSync(resolve(diagramDirectory, `${name}.svg`))).toBe(true);
      expect(readme).toContain(
        `https://raw.githubusercontent.com/Luzenrocy/treasure-sdk/v${packageJson.version}/docs/diagrams/${name}.svg`,
      );
    }
  });

  it('does not leave Mermaid code blocks in the npm-facing README', () => {
    expect(readme).not.toContain('```mermaid');
  });

  it('regenerates and stages diagrams whenever npm bumps the package version', () => {
    expect(packageJson.scripts.version).toBe('npm run docs:diagrams && git add README.md docs/diagrams');
  });

  it('uses a Puppeteer configuration compatible with GitHub Actions runners', () => {
    const puppeteerConfig = JSON.parse(
      readFileSync(resolve(root, 'scripts', 'puppeteer-mermaid.json'), 'utf8'),
    ) as { args: string[] };

    expect(puppeteerConfig.args).toEqual(expect.arrayContaining([
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]));
  });
});
