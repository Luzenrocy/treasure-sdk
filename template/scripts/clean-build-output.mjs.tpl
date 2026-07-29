import { rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const dirs = [
  join(root, 'build-output'),
  join(root, 'dist'),
];

for (const dir of dirs) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`🧹 已清理: ${dir}`);
  }
}
