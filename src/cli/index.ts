#!/usr/bin/env node
import { program } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import picocolors from 'picocolors';
import { generateUid } from './utils/helpers';
import { promptIfMissing } from './utils/prompts';
import { renderTemplate } from './utils/generator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('treasure-sdk')
  .description('Treasure 插件 SDK CLI')
  .version('1.0.0');

program
  .command('create <pluginName>')
  .description('创建一个新的 Treasure 插件项目')
  .option('-a, --alias <name>', '插件显示名称')
  .option('--author <name>', '作者名')
  .option('-t, --template <type>', '模板类型', 'vue')
  .option('--no-install', '跳过 npm install')
  .option('--git-init', '自动 git init')
  .action(async (pluginName: string, options: any) => {
    if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
      console.error(picocolors.red('插件编码必须为 kebab-case（小写字母、数字、短横线）'));
      process.exit(1);
    }

    const answers = await promptIfMissing(pluginName, options);

    const uid = generateUid(pluginName, answers.author);
    const root = path.resolve(process.cwd(), pluginName);

    if (existsSync(root)) {
      console.error(picocolors.red(`目录 ${pluginName} 已存在`));
      process.exit(1);
    }

    mkdirSync(root, { recursive: true });

    const templateDir = path.join(__dirname, '../../template');
    await renderTemplate(templateDir, root, {
      PLUGIN_NAME: pluginName,
      PLUGIN_ALIAS: answers.alias,
      PLUGIN_DESCRIPTION: answers.description,
      PLUGIN_AUTHOR: answers.author,
      PLUGIN_UID: uid,
      YEAR: new Date().getFullYear().toString(),
    });

    if (options.install !== false) {
      console.log(picocolors.cyan('📦 安装依赖...'));
      try {
        execSync('npm install', { cwd: root, stdio: 'inherit' });
      } catch (e) {
        console.warn(picocolors.yellow('⚠️  npm install 失败，请手动执行'));
      }
    }

    if (options.gitInit) {
      execSync('git init', { cwd: root, stdio: 'pipe' });
      execSync('git add .', { cwd: root, stdio: 'pipe' });
      execSync('git commit -m "chore: initial commit"', { cwd: root, stdio: 'pipe' });
    }

    console.log(picocolors.green(`✅ 插件项目已创建: ${root}`));
  });

program.parseAsync(process.argv).catch(console.error);
