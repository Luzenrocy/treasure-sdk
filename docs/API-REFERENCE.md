# Treasure SDK API 参考

> 本文描述 `treasure-sdk` 的**公开接口、参数、返回值与兼容性**。底层消息格式见[桥接协议](BRIDGE-PROTOCOL.md)；从零创建、调试和发布插件请参阅[插件研发指南](https://github.com/Luzenrocy/treasure-plugins/blob/main/docs/PLUGIN-DEVELOPMENT-GUIDE.md)。

## 1. 安装与初始化

```bash
npm install treasure-sdk
```

在挂载应用前初始化：

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { initTreasure } from 'treasure-sdk';

initTreasure();
createApp(App).mount('#app');
```

插件入口页必须声明与 `manifest.json` 中 `name` 一致的编码：

```html
<meta name="treasure-plugin-code" content="my-plugin" />
```

## 2. 公共导出与响应约定

```ts
export { initTreasure, getTreasure, file, setting, Response } from 'treasure-sdk';
export type {
  TreasureBridge, TreasureResponse, FileEntry,
  CreateDirOptions, DeleteDirOptions, SaveDialogOptions,
} from 'treasure-sdk';
```

数据库和设置 API 返回 `Response` / `TreasureResponse`：`code === 1` 表示成功；失败时读取 `msg`。文件和对话框 API 在失败时抛出 `Error`，调用处应使用 `try/catch`。

## 3. 数据接口

```ts
const api = getTreasure();

const rows = await api.query(
  'SELECT id, title FROM notes WHERE status = ?',
  ['notes'],
  ['active'],
);

await api.execute(
  'UPDATE notes SET title = ? WHERE id = ?',
  ['notes'],
  ['新标题', 1],
);

await api.transaction([
  { sql: 'UPDATE notes SET status = ? WHERE id = ?', tables: ['notes'], params: ['archived', 1] },
]);
```

| 方法 | 签名 | 要点 |
| --- | --- | --- |
| `query` | `(sql, tables, params?)` | 执行查询，返回 `Response`。 |
| `execute` | `(sql, tables, params?)` | 执行插入、更新或删除，返回 `Response`。 |
| `transaction` | `(ops)` | 原子执行多条语句；每条语句都要声明 `tables`。 |

SQL 使用**裸表名**，每条 SQL 都必须完整声明所涉及的表。宿主会完成命名空间隔离和安全校验；插件不得访问平台表或自行拼接 `plugin_` 前缀。

## 4. 文件接口

可通过 `file` 便捷模块或 `getTreasure()` 返回的桥接实例调用：

```ts
import { file } from 'treasure-sdk';

const text = await file.readFile('/path/to/note.md');
await file.writeFile('/path/to/note.md', text);
const entries = await file.readDir('/path/to');
```

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `readFile(path)` | `Promise<string>` | 读取文本。 |
| `readBinaryFile(path)` | `Promise<string>` | 读取 Base64 编码的二进制内容。 |
| `readDir(path)` | `Promise<FileEntry[]>` | 读取目录条目。 |
| `writeFile(path, content)` | `Promise<void>` | 覆盖写入文本。 |
| `writeBinaryFile(path, base64)` | `Promise<void>` | 写入 Base64 二进制内容。 |
| `createFile(path, content?)` / `updateFile(path, content)` | `Promise<void>` | 创建或更新文本文件。 |
| `createDir(path, { recursive? })` / `mkdir(path)` | `Promise<void>` | 创建目录。 |
| `deleteFile(path)` / `deleteDir(path, { recursive? })` | `Promise<void>` | 请求删除文件或目录。 |

## 5. 设置与系统对话框

```ts
import { setting, getTreasure } from 'treasure-sdk';

const storage = await setting.getByKey('storage_dir');
const api = getTreasure();
const dir = await api.selectDirectory('选择存储目录');
```

| 方法 | 说明 |
| --- | --- |
| `getSettings()` / `setting.getAll()` | 读取当前插件全部配置。 |
| `saveSetting(settings)` / `setting.save(settings)` | 保存当前插件配置。 |
| `getSettingByKey?(key)` / `setting.getByKey(key)` | 按键读取配置；旧宿主可能不支持原始可选 API。 |
| `saveSettingByKey?(key, value)` / `setting.saveByKey(key, value)` | 按键保存配置。 |
| `selectDirectory(title)` | 打开目录选择对话框，取消时返回 `null`。 |
| `saveDialog?(options)` | 打开保存对话框，取消时返回 `null`；调用前检查是否存在。 |

设置始终归属于当前插件，插件不能指定其他插件的配置空间。

## 6. 可选与扩展接口

| 方法 | 用途 | 使用要求 |
| --- | --- | --- |
| `sendNotification?(title, body, options?)` | 请求系统通知。 | 先检查方法是否存在。 |
| `log?(level, category, message, details?)` | 写入结构化日志。 | `details` 必须可 JSON 序列化。 |
| `request?(action, payload?)` | 菜单协作等受支持的扩展 action。 | 仅使用已登记的 action；不要作为绕过标准 API 的通道。 |

菜单注册、注销和状态同步属于可选扩展能力。其 action 名称与事件规则见[桥接协议](BRIDGE-PROTOCOL.md)。

## 7. 开发态与生产态

`initTreasure()` 自动选择运行实现：独立浏览器运行时使用 `DevBridge`，以 `sql.js` 和 `localStorage` 模拟；嵌入 Treasure iframe 时使用受控的生产态桥接。两种实现保持相同 API，但浏览器模拟不等同于真实文件、原生菜单和系统对话框，发布前必须在宿主中联调。

## 8. 关联文档

- [桥接协议](BRIDGE-PROTOCOL.md)
- [插件研发指南](https://github.com/Luzenrocy/treasure-plugins/blob/main/docs/PLUGIN-DEVELOPMENT-GUIDE.md)
- [Treasure SDK README](../README.md)
