import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const diagramsDirectory = join(root, 'docs', 'diagrams');
const readmePath = join(root, 'README.md');
const manifestPath = join(diagramsDirectory, 'manifest.json');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');
const diagramNames = ['ecosystem', 'plugin-lifecycle', 'sdk-architecture', 'data-security'];
const cliPath = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc');
const puppeteerConfigPath = join(root, 'scripts', 'puppeteer-mermaid.json');
const assetBaseUrl = `https://raw.githubusercontent.com/Luzenrocy/treasure-sdk/v${packageJson.version}/docs/diagrams`;

const diagramHashes = Object.fromEntries(diagramNames.map((name) => [
  name,
  createHash('sha256').update(readFileSync(join(diagramsDirectory, `${name}.mmd`))).digest('hex'),
]));

function renderDiagram(name) {
  const source = join(diagramsDirectory, `${name}.mmd`);
  const destination = join(diagramsDirectory, `${name}.svg`);
  const result = spawnSync(cliPath, ['-i', source, '-o', destination, '-b', 'transparent', '-p', puppeteerConfigPath], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`Unable to render ${name}.mmd:\n${result.stderr || result.stdout}`);
  }

  return destination;
}

const expectedReadme = diagramNames.reduce(
  (content, name) => content.replace(
    new RegExp(`https://raw\\.githubusercontent\\.com/Luzenrocy/treasure-sdk/v[^/]+/docs/diagrams/${name}\\.svg`, 'g'),
    `${assetBaseUrl}/${name}.svg`,
  ),
  readFileSync(readmePath, 'utf8'),
);

if (checkOnly) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const staleDiagram = diagramNames.find((name) =>
    !existsSync(join(diagramsDirectory, `${name}.svg`)) || manifest.diagrams?.[name] !== diagramHashes[name],
  );
  if (staleDiagram || expectedReadme !== readFileSync(readmePath, 'utf8')) {
    throw new Error('README diagram assets are stale. Run npm run docs:diagrams and commit the result.');
  }
} else {
  diagramNames.forEach(renderDiagram);
  writeFileSync(readmePath, expectedReadme);
  writeFileSync(manifestPath, `${JSON.stringify({ diagrams: diagramHashes }, null, 2)}\n`);
}
