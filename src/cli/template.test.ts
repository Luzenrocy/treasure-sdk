import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { renderTemplate } from './utils/generator';

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('plugin template', () => {
  it('renders a build script that can package a plugin', async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'treasure-sdk-template-'));
    tempDirectories.push(tempDirectory);
    const directory = join(tempDirectory, 'template-check');
    mkdirSync(directory);
    const templatePath = join(process.cwd(), 'template');

    await renderTemplate(templatePath, directory, {
      PLUGIN_NAME: 'template-check',
      PLUGIN_ALIAS: 'Template Check',
      PLUGIN_DESCRIPTION: 'Template packaging regression test',
      PLUGIN_AUTHOR: 'Treasure',
      PLUGIN_UID: '00000000-0000-5000-8000-000000000000',
      YEAR: '2026',
      SDK_VERSION: '2.0.0',
    });
    mkdirSync(join(directory, 'dist'));
    cpSync(join(directory, 'index.html'), join(directory, 'dist', 'index.html'));

    expect(() => execFileSync(process.execPath, ['scripts/build-plugin.mjs'], { cwd: directory })).not.toThrow();
    expect(existsSync(join(directory, 'build-output', 'template-check', 'manifest.json'))).toBe(true);
  });
});
