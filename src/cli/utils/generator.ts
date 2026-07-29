import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';

export async function renderTemplate(templateDir: string, targetDir: string, data: Record<string, string>) {
  const entries = await fs.readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(templateDir, entry.name);
    const relPath = entry.name;
    const destPath = path.join(targetDir, relPath);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await renderTemplate(srcPath, destPath, data);
    } else {
      let content = await fs.readFile(srcPath, 'utf-8');
      let outputPath = destPath;

      if (srcPath.endsWith('.tpl')) {
        const template = Handlebars.compile(content);
        content = template(data);
        outputPath = destPath.replace(/\.tpl$/, '');
      }

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content, 'utf-8');
    }
  }
}
