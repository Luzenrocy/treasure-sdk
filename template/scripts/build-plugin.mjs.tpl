import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomBytes } from 'crypto';
import { execSync } from 'child_process';

const NAMESPACE_TREASURE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function parseUuid(uuid) {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function formatUuid(bytes) {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidv5(name, namespace = NAMESPACE_TREASURE) {
  const nsBytes = parseUuid(namespace);
  const nameBytes = Buffer.from(name, 'utf8');
  const bytes = createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes.subarray(0, 16));
}

function generateRandomSuffix(length = 6) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) result += chars[bytes[i] % 36];
  return result;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '').replace(/[\u4e00-\u9fa5]/g, '');
}

function freezePluginCode(manifestPath, root) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  if (manifest._frozen) return manifest;
  let slug = manifest.alias ? slugify(manifest.alias) : '';
  if (!slug) slug = slugify(basename(root));
  if (!slug) slug = 'plugin';
  manifest.name = `${slug}-${generateRandomSuffix(6)}`;
  manifest._frozen = true;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`❄️  plugin_code 已冻结并写回源文件: ${manifest.name}`);
  return manifest;
}

function syncPluginCodeInHtml(root, pluginName) {
  const htmlPath = join(root, 'index.html');
  if (!existsSync(htmlPath)) return;
  const html = readFileSync(htmlPath, 'utf-8');
  const updated = html.replace(
    /<meta\s+name=["']treasure-plugin-code["']\s+content=["'][^"']*["']/,
    `<meta name="treasure-plugin-code" content="${pluginName}"`
  );
  if (html !== updated) {
    writeFileSync(htmlPath, updated);
    console.log(`✅ 源码 index.html 的 treasure-plugin-code 已同步为: ${pluginName}`);
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const shouldZip = process.argv.includes('--zip');
const manifestPath = join(root, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error('❌ manifest.json not found');
  process.exit(1);
}

const frozenManifest = freezePluginCode(manifestPath, root);
const pluginName = frozenManifest.name;
const packageName = basename(root);

syncPluginCodeInHtml(root, pluginName);

if (!pluginName) {
  console.error('❌ manifest.name is required');
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
  console.error('❌ manifest.name 必须为 kebab-case');
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(packageName)) {
  console.error('❌ 插件项目目录名必须为 kebab-case，才能作为插件包名');
  process.exit(1);
}

const buildOutputDir = join(root, 'build-output');
mkdirSync(buildOutputDir, { recursive: true });
const outputDir = join(buildOutputDir, packageName);
mkdirSync(outputDir, { recursive: true });

const distDir = join(root, 'dist');
if (!existsSync(join(distDir, 'index.html'))) {
  console.error('❌ dist/index.html not found. Run npm run build first.');
  process.exit(1);
}
cpSync(distDir, outputDir, { recursive: true });

const outputIndexPath = join(outputDir, 'index.html');
const outputIndexHtml = readFileSync(outputIndexPath, 'utf-8');
const pluginCodeMetaPattern = /<meta\s+name=["']treasure-plugin-code["']\s+content=["'][^"']*["']/;
if (!pluginCodeMetaPattern.test(outputIndexHtml)) {
  console.warn('⚠️  未在 index.html 中找到 treasure-plugin-code meta，跳过覆写');
} else {
  const updatedHtml = outputIndexHtml.replace(
    pluginCodeMetaPattern,
    `<meta name="treasure-plugin-code" content="${pluginName}"`
  );
  writeFileSync(outputIndexPath, updatedHtml);
  console.log(`✅ 产物 index.html 的 treasure-plugin-code 已同步为: ${pluginName}`);
}

const packageManifest = { ...frozenManifest };
if (!packageManifest.plugin_uid) {
  const author = frozenManifest.author || '';
  packageManifest.plugin_uid = uuidv5(`${pluginName}@${author}`);
}
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(packageManifest, null, 2));

const scriptsDir = join(root, 'scripts');
if (existsSync(scriptsDir)) {
  cpSync(scriptsDir, join(outputDir, 'scripts'), { recursive: true });
}

const publicDir = join(root, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, join(outputDir, 'public'), { recursive: true });
}

console.log(`✅ Plugin package created: ${outputDir}`);

if (shouldZip) {
  try {
    const zipPath = join(buildOutputDir, `${packageName}.zip`);
    execSync(`zip -r "${zipPath}" "${packageName}"`, {
      cwd: join(root, 'build-output'),
      stdio: 'pipe',
    });
    console.log(`✅ Zip package created: ${zipPath}`);
  } catch (e) {
    console.warn(`⚠️  Zip 打包失败: ${e.message}，目录格式已可用`);
  }
}
