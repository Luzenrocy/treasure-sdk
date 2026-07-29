import readline from 'readline';
import picocolors from 'picocolors';

export interface CreateOptions {
  alias?: string;
  author?: string;
  template?: string;
  install?: boolean;
  gitInit?: boolean;
}

export interface PluginAnswers {
  alias: string;
  description: string;
  author: string;
}

export async function promptIfMissing(pluginName: string, options: CreateOptions): Promise<PluginAnswers> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (question: string, defaultVal?: string): Promise<string> => {
    return new Promise((resolve) => {
      const suffix = defaultVal ? ` (${defaultVal})` : '';
      rl.question(`${picocolors.cyan(question)}${suffix}: `, (ans) => {
        resolve(ans.trim() || defaultVal || '');
      });
    });
  };

  const alias = options.alias || await ask('插件显示名称', toReadableName(pluginName));
  const description = await ask('插件描述', '');
  const author = options.author || await ask('作者', '');

  rl.close();
  return { alias, description, author };
}

function toReadableName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
