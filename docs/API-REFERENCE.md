# Treasure SDK 2.0 API 参考

> 面向插件作者。本文的公开 API 以 `treasure-sdk/src/index.ts` 导出和类型声明为准；插件不得直接调用 Tauri API、Treasure 内部模块或桥接 operation。最低宿主版本：**2.0.0**。

```ts
import {
  initTreasure, files, directories, storage, database, settings, permissions,
  menus, notifications, logs,
} from 'treasure-sdk';

initTreasure(); // 在挂载应用前调用一次
```

`files`、`directories`、`settings` 等名称是 SDK 稳定的公开模块标识。本文标题统一采用“`模块标识` 模块：职责域”的格式；职责说明不属于模块名称，也不改变代码中的导入方式。

## 1. SDK 资源模型

插件运行在受控环境中，不能直接读写电脑上的任意路径。开发时需要区分下面五类资源：

| 资源 | 在哪里产生 | 用在哪里 | 存储位置、生命周期与作用 |
| --- | --- | --- | --- |
| 文件引用 `FileReference` | 用户通过文件选择框选择文件；或目录列举返回文件 | `files.readFile` 读取；`files.writeFile` 写入另存为目标 | 引用代替真实路径，只能由所属插件使用。 |
| 目录引用 `DirectoryReference` | 用户通过目录选择框选择目录；或创建/列举目录返回 | `directories.*` 管理目录树；`files.writeFile` 写文件 | 选择结果在当前会话可用；调用 `permissions.grantDirectory` 后，根目录才可跨重启恢复。派生子目录应按需重新获取。 |
| 目录授权键 `permissionKey` | 插件开发者在源码中定义固定英文键，例如 `notes_directory` | `permissions.grantDirectory/verifyDirectoryGrant/revokeDirectory` | 不是路径、系统设置值、随机值或宿主授权 ID；同一键标识该插件的一项目录访问授权。 |
| 系统设置项 | 插件在 manifest 中声明，或通过 `settings.set` 写入 | 在 Treasure 的系统设置模块中统一展示和管理；插件用 `settings.get/list` 读取当前值 | 普通项返回 `{ key, value }`；目录项返回授权 ID、路径哈希和目录名，不返回路径。 |
| 插件数据区域 | 插件调用 `storage.write` | 保存附件内容、缓存、索引等不需要让用户直接管理的数据 | 实际目录：`<Treasure 应用数据目录>/plugin/<插件编码>/data/`；使用相对键访问；卸载插件时宿主清理。 |

“授权”指用户在系统选择窗口明确选择某个文件或目录后，宿主允许该插件通过相应引用访问该资源。插件不能自行创建或伪造授权记录；若需要持久化一个用户选择的目录，只能把该选择结果与源码内固定的 `permissionKey` 交给 `permissions.grantDirectory`。

## 2. Result 返回模型

每个 SDK 调用均返回 `Promise<Result<T>>`，普通失败不会抛出异常：

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ResultErrorCode; message: string } };

```

上面只有 `Result<T>` 是所有方法共用的**返回格式**。当调用成功时，具体返回内容位于 `result.value`；各方法的 `result.value` 类型会在对应方法表的“成功返回”列中说明。

文件和目录方法有时会返回下面两种**返回数据**；它们不是 SDK 接口，不能直接调用：

| 返回数据 | 字段含义 | 来自哪里 | 可以传给哪里 |
| --- | --- | --- | --- |
| `FileReference` | `id` 是宿主签发的文件引用标识；`name` 是文件名；`kind` 固定为 `'file'` | 文件选择、目录列举、另存为或写文件成功后 | `files.readFile(file)`；另存为返回的可写文件引用可传给 `files.writeFile({ file, data })`。 |
| `DirectoryReference` | `id` 是宿主签发的目录引用标识；`name` 是目录名；`kind` 固定为 `'directory'` | 目录选择、目录列举或创建目录成功后 | `directories.list/create/remove`，或 `files.writeFile({ directory, fileName, data })`。 |

必须先判断 `ok`。用户取消通常无需提示错误；其他失败应展示 `error.message` 并按 `error.code` 决定是否重试或重新选择。

```ts
const selected = await files.openDialog({ kind: 'file' });
if (!selected.ok) {
  if (selected.error.code !== 'CANCELLED') showError(selected.error.message);
  return;
}
```

| 错误码 | 插件应对方式 |
| --- | --- |
| `CANCELLED` | 用户关闭或取消系统窗口；终止当前流程，不报错。 |
| `GRANT_NOT_FOUND` | 目标契约：应用需要恢复的用户选择目录已不可用或被撤销；提示用户重新选择该目录。当前 Treasure 2.0.0 的部分旧响应转换会误归类为 `INTERNAL`，见下方兼容说明。 |
| `REFERENCE_EXPIRED` | 之前拿到的文件或子目录引用已经不能使用，或将只读文件用于写入；重新选择，或从已恢复目录重新列举。 |
| `INVALID_FILE_NAME` | 文件名为空、`.`、`..` 或含路径分隔符；修正业务输入。 |
| `VALIDATION_FAILED` | 参数、存储键或 SQL 表清单不符合规则；修正代码。 |
| `FILE_TOO_LARGE` | 单次文件/私有存储读写超过 32 MiB；改用更小文件或拆分业务数据。 |
| `NOT_FOUND` | 设置、插件保存的数据或业务对象不存在；按首次使用流程处理。 |
| `PERMISSION_DENIED` | 插件身份或能力不允许；检查 manifest、宿主版本与调用上下文。 |
| `UNSUPPORTED` | 当前 Treasure 宿主版本不提供该能力；检查最低宿主版本与插件运行环境。 |
| `IO_ERROR`、`CONFLICT`、`INTERNAL` | 记录上下文，显示失败提示；必要时允许用户重试。 |

绝对路径永不返回给插件。不要保存、构造或传递以用户主目录、文件系统根目录或盘符开头的操作系统路径；不要用 Base64 绕过字节大小和授权边界。

## 3. `files` 模块：文件选择与访问

下表的“成功返回”只在 `result.ok === true` 时位于 `result.value` 中；失败时统一从 `result.error.code` 和 `result.error.message` 读取原因。

| 方法 | 参数 | 成功返回 `result.value` | 用途 |
| --- | --- | --- | --- |
| `openDialog(options)` | `{ kind: 'file' \| 'directory'; multiple?; title?; filters? }` | 选择文件时为 `FileReference[]`；选择目录时为 `DirectoryReference` | 让用户选择导入文件、导出目录或应用长期使用的目录。 |
| `saveDialog(options)` | `{ defaultFileName; title?; filters?; initialDirectory? }` | 可写 `FileReference` | 单个系统“另存为”窗口中同时选择目录和文件名。 |
| `readFile(file)` | `FileReference` | `Uint8Array` | 读取由选择框或目录列举返回的可读文件。 |
| `writeFile(input)` | `{ directory, fileName, data }` 或 `{ file, data }` | 写入后的 `FileReference` | 在用户选择的目录中写单个文件，或写入 `saveDialog` 返回的目标文件。 |

`fileName` 必须是单个文件名，可以包含扩展名中的 `.`，但不能等于 `.`/`..`，也不能包含 `/` 或 `\`。`data` 必须是 `Uint8Array`；单次读写最大 32 MiB。

### 3.1 将用户选择的图片写入插件私有存储

这个示例说明“选择文件 → 读取字节 → 写入私有存储”的调用顺序。文件原位置不会被插件保存或再次直接访问。

```ts
const selected = await files.openDialog({
  kind: 'file', multiple: false, title: '选择附件',
  filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg'] }],
});
if (!selected.ok || !selected.value[0]) return;

const content = await files.readFile(selected.value[0]);
if (!content.ok) return showError(content.error.message);
await storage.write({ key: `assets/${selected.value[0].name}`, data: content.value });
```

### 3.2 向用户选择的目录导出文件

适合插件已经自行决定文件名的场景：

```ts
const destination = await files.openDialog({ kind: 'directory', title: '选择导出目录' });
if (!destination.ok || Array.isArray(destination.value)) return;

const saved = await files.writeFile({
  directory: destination.value,
  fileName: 'report.txt',
  data: new TextEncoder().encode('report'),
});
if (!saved.ok) showError(saved.error.message);
```

### 3.3 通过系统“另存为”窗口导出文件

这个示例说明“另存为 → 写入”的调用顺序。`saveDialog` 打开一个系统窗口，用户可以在其中同时选择保存位置和修改文件名；它返回当前宿主会话内的只写文件引用。

```ts
const target = await files.saveDialog({
  title: '导出 PDF',
  defaultFileName: 'report.pdf',
  filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
});
if (!target.ok) return;

const saved = await files.writeFile({ file: target.value, data: pdfBytes });
if (!saved.ok) showError(saved.error.message);
```

不能把 `saveDialog` 返回的 `FileReference` 当目录传入，也不能将它持久化后跨会话复用。

## 4. `directories` 模块：目录操作

| 方法 | 参数 | 成功返回 `result.value` |
| --- | --- | --- |
| `directories.list(directory)` | `DirectoryReference` | `DirectoryEntry[]`；条目包含 `name`、`kind` 及 `file` 或 `directory` 引用。 |
| `directories.create({ directory, name })` | 父目录引用与单个目录名 | 新建目录的 `DirectoryReference`。 |
| `directories.remove({ directory, name? })` | 目录引用；可选其内单个名称 | `void`；目标移入系统回收站。 |

目录引用来源只能是 `openDialog({ kind: 'directory' })`、`directories.list` 或 `directories.create`。用户直接选择的目录称为“根目录”：建立目录授权后，宿主可在应用重启时重新签发该根目录的引用。通过 `list` 或 `create` 得到的子目录和文件引用，只是根目录中的当前位置；应用重启后请从重新签发的根目录引用再次 `list`，不要把这些子引用存入系统设置或数据库。

## 5. `settings` 模块：系统设置交互

该模块与 Treasure 的系统设置模块交互。普通设置使用字符串；`dir` 设置只通过目录引用写入，读取时仅返回目录名、路径摘要与授权 ID，绝不返回绝对路径。

| 方法 | 何时调用 | 参数 | 宿主保存什么 | 成功返回 `result.value` | 下一步怎么用 |
| --- | --- | --- | --- | --- | --- |
| `settings.set` | 需要更新系统设置值时 | 普通项用 `{ key, value }`；目录项用 `{ key, directory }` | 目录项会更新设置路径并清空旧授权绑定；不会创建授权 | `void` | 目录项更新后应调用 `grantDirectory` 建立新授权。 |
| `settings.get` | 插件启动或需要读取某个系统设置项时 | `key` | 不新增数据，只读取已保存值 | 普通项 `{ key, value }`；目录项 `{ key, paramType: 'dir', accessGrantId, pathHash, directoryName }` | 目录项以授权 ID 和路径摘要调用 `verifyDirectoryGrant`。 |
| `settings.list` | 需要一次读取当前插件的全部系统设置项时 | 无 | 不新增数据，只读取全部设置项 | 上述设置对象数组 | 遍历结果或转换为插件配置对象。 |

### 5.1 读取与更新系统设置项

这个示例说明系统设置值的更新和读取方式。这里的 `theme` 是插件声明的设置键；值必须是字符串。

```ts
// 用户选择深色主题时调用：宿主保存字符串 "dark"。
const saved = await settings.set({ key: 'theme', value: 'dark' });
if (!saved.ok) return showError(saved.error.message);

// 插件启动时调用：成功后 result.value 为 { key: 'theme', value: 'dark' }。
const theme = await settings.get('theme');
if (theme.ok) applyTheme(theme.value.value);
```

## 6. `permissions` 模块：目录访问授权

`settings` 只管理系统设置值；目录访问授权由独立的 `permissions` 模块管理。它适用于用户明确选择并允许插件访问的目录，例如笔记目录、项目目录或图片目录。授权记录与稳定的 `permissionKey` 绑定，因此插件在以后启动时可以重新取得根目录引用。

`permissionKey` 是插件开发者在源码中固定写下的英文标识，例如 `notes_directory`。它不是随机值、绝对路径、用户输入、系统设置值或宿主授权 ID。同一个键标识本插件的一项目录访问授权；再次授权会撤销旧的有效授权并新建记录，撤销不删除用户目录。

若 manifest 同时声明 `param_type: "dir"` 供宿主设置页展示，`permissionKey` 应与该项的 `param_key` 相同。这样宿主能把目录的显示值与授权记录投影到同一设置项；插件仍只调用 `permissions`，不通过 `settings` 读取路径或授权 ID。

如果插件在 `manifest.json` 的 `settings` 中声明一个目录类型设置，宿主会把已选目录同步为该项的可读显示值，供系统设置页回显。例如：

```json
{
  "param_key": "storage_dir",
  "param_name": "文件存储目录",
  "param_type": "dir",
  "param_value": ""
}
```

调用流程与宿主行为如下：

| 方法 | 何时调用与参数 | Treasure 保存或恢复的内容 | 成功结果与后续使用 |
| --- | --- | --- | --- |
| `permissions.grantDirectory` | 用户选择目录后传入 `{ permissionKey, directory }` | 撤销该键旧的有效授权、新增授权记录，并仅更新设置的 `access_grant_id` 绑定 | 返回 `{ accessGrantId, directory }`；`directory` 可立即用于目录操作。 |
| `permissions.verifyDirectoryGrant` | 启动或引用失效后传入 `{ permissionKey, accessGrantId, pathHash }` | 只校验授权记录、插件身份、键、状态与路径哈希；不读取或更新设置 | 返回 `{ accessGrantId, directory }`；从根目录重新列举，不复用旧子引用。 |
| `permissions.revokeDirectory` | 用户取消目录访问时传入 `permissionKey` | 将有效授权标为 `revoked`，不删除用户目录或授权历史 | 返回 `void`；清理派生引用并引导用户按需重选。 |

授权历史规则：更换目录、重新授权和主动撤销均保留旧记录并标记为 `revoked`；仅当插件被卸载时，Treasure 才物理删除该插件的全部授权记录。

### 6.1 建立目录授权并在后续启动中重新取得引用

这个示例说明完整的目录授权流程：目录只能来自用户选择；授权记录由宿主保存；后续启动重新取得的根目录引用用于目录操作。

```ts
const DIRECTORY_PERMISSION_KEY = 'notes_directory';

// 1. 用户点击“选择目录”时：系统窗口返回目录引用。
const selected = await files.openDialog({ kind: 'directory', title: '选择文件存储目录' });
if (!selected.ok || Array.isArray(selected.value)) return; // CANCELLED 时结束流程，并收窄目录类型

// 2. 先写目录设置；这会更新路径并清空旧授权绑定，但不会授权。
const configured = await settings.set({ key: DIRECTORY_PERMISSION_KEY, directory: selected.value });
if (!configured.ok) return showError(configured.error.message);

// 3. 再建立授权并绑定设置。
const bound = await permissions.grantDirectory({
  permissionKey: DIRECTORY_PERMISSION_KEY,
  directory: selected.value,
});
if (!bound.ok) return showError(bound.error.message);

// 4. 当前会话中可直接使用 bound.value.directory。
const firstEntries = await directories.list(bound.value.directory);

// 5. 插件下次启动时：读取目录设置并验证授权，再继续目录操作。
const savedDirectory = await settings.get(DIRECTORY_PERMISSION_KEY);
if (savedDirectory.ok && savedDirectory.value.paramType === 'dir' && savedDirectory.value.accessGrantId && savedDirectory.value.pathHash) {
  const restored = await permissions.verifyDirectoryGrant({ permissionKey: DIRECTORY_PERMISSION_KEY, accessGrantId: savedDirectory.value.accessGrantId, pathHash: savedDirectory.value.pathHash });
  if (!restored.ok) return showError(restored.error.message);
  const entries = await directories.list(restored.value.directory);
  if (!entries.ok) showError(entries.error.message);
}
```

宿主保存真实路径和目录授权记录；插件不会收到路径，只会收到 `DirectoryReference` 及目录设置的安全元数据。目录内由 `directories.list` 或 `directories.create` 得到的子目录引用不应自行保存；应用重启后验证授权并从新的根目录引用重新列举。

## 7. `storage` 模块：插件私有存储

“插件数据区域”是宿主为每个插件单独准备的数据目录，其他插件不能访问。它实际位于 Treasure 应用数据目录下：`<Treasure 应用数据目录>/plugin/<插件编码>/data/`。例如键 `attachments/8f8d-report.pdf` 对应该目录下的 `attachments/8f8d-report.pdf` 文件。

该落盘位置用于理解数据归属、备份与排障；插件代码**只能**通过 `storage.read/write/remove` 和相对键访问，不能拼接或传入这个绝对路径。它适用于附件内容、缩略图、缓存、索引等由插件自己管理的数据；不适用于用户主动选择目录中的文档内容。

| 方法 | 参数 | 成功返回 `result.value` |
| --- | --- | --- |
| `storage.write` | `{ key, data: Uint8Array }` | `void` |
| `storage.read` | 相对键 | `Uint8Array` |
| `storage.remove` | 相对键 | `void` |

### 7.1 保存、读取和删除附件内容

这个示例仅说明私有存储的三种基础操作；附件名称、所属业务对象等元数据通常另存入数据库。

```ts
const key = 'attachments/8f8d-report.pdf';
const wrote = await storage.write({ key, data: bytes });
const read = await storage.read(key);
const removed = await storage.remove(key);
```

键必须是相对键，不得为空、绝对路径、包含空路径段或 `..`。私有存储在卸载插件时由宿主清理。

附件元数据由插件数据库保存。若先写私有文件、后写数据库，数据库失败时应调用 `storage.remove(key)` 补偿；若数据库删除成功但文件删除失败，应记录插件自己的待清理项并在下次启动重试。

## 8. `database` 模块：插件数据访问

每个插件的数据表由宿主统一持久化在 Treasure 数据库中。宿主负责创建隔离边界，使插件只允许访问自己定义的数据表；插件不参与也不需要了解数据库中实际如何命名或保存这些表。

开发者需要做的只有两件事：

1. 在 `scripts/init/<版本>.sql` 中定义业务表名，例如 `tasks`、`task_tags`；
2. 在页面业务 SQL 中继续使用这些相同的表名，并在 `tables` 中列出这条 SQL 实际访问的所有表。

`tables` 是本条 SQL 的“访问表清单”。例如下面的更新同时访问 `tasks` 和子查询中的 `task_tags`，所以清单写为 `['tasks', 'task_tags']`。

```ts
type SqlStatement = { sql: string; tables: string[]; params?: unknown[] };
```

| 方法 | 允许语句 | 成功返回 `result.value` |
| --- | --- | --- |
| `database.query<T>(statement)` | 单条 `SELECT` 或 `WITH ... SELECT` | `{ rows: T[] }` |
| `database.execute<T>(statement)` | 单条 `INSERT`、`UPDATE`、`DELETE`；支持 CTE、JOIN、`EXISTS`、`RETURNING` | `{ affectedRows, lastInsertId?, rows? }` |
| `database.transaction(statements)` | 多条上述写语句，原子提交 | 按输入顺序的 `{ affectedRows, lastInsertId? }[]` |

每条 SQL 都必须：

1. 使用在迁移 SQL 中定义的表名，例如 `tasks`；
2. 在 `tables` 中列出这条 SQL 实际访问的每张表，包括子查询、JOIN 或 CTE 中访问的表；
3. 用 `?` 与 `params` 传值，绝不拼接用户输入；
4. 只在业务运行时执行 DML。`CREATE`、`ALTER`、`DROP`、`PRAGMA`、`ATTACH`、`DETACH` 和多语句一律拒绝。

### 8.1 带子查询的参数化更新与事务

这个示例说明两件事：`tables` 如何覆盖子查询中的表，以及多个写操作如何作为一个事务提交。

```ts
const changed = await database.execute<{ id: number }>({
  sql: `UPDATE tasks
        SET status = ?
        WHERE EXISTS (SELECT 1 FROM task_tags WHERE task_id = tasks.id)
        RETURNING id`,
  tables: ['tasks', 'task_tags'],
  params: ['done'],
});

const committed = await database.transaction([
  { sql: 'DELETE FROM task_tags WHERE task_id = ?', tables: ['task_tags'], params: [taskId] },
  { sql: 'UPDATE tasks SET updated_at = ? WHERE id = ?', tables: ['tasks'], params: [Date.now(), taskId] },
]);
```

宿主负责检查 SQL、核对 `tables` 清单并保证插件只访问自己的表。插件只需使用参数化 SQL 和正确的表清单。

表、索引、外键和数据结构升级只放在 `scripts/init/<semver>.sql`。已发布迁移不可修改；新增变更新增版本文件。脚本中使用业务表名即可。卸载清理写在 `scripts/destroy.sql`，不得删除用户选择的外部目录。

## 9. 辅助能力模块

下面是菜单、通知和日志的独立调用示例。它们不依赖文件或数据库流程。

```ts
await menus.register({
  menuId: 'my-plugin.file', rootLabel: '我的插件',
  items: [{ id: 'create', label: '新建' }],
});
await menus.unregister('my-plugin.file');
await notifications.send({ title: '导出完成', body: 'report.pdf 已保存' });
await logs.write({ level: 'info', category: 'export', message: 'export completed', details: { bytes: 1024 } });
```

菜单注册和通知需在桌面宿主验证；日志应使用稳定英文类别和简短消息，`details` 保存可序列化上下文，不写用户文件绝对路径。

当前 SDK 只公开菜单注册和注销，尚未公开类型化的菜单点击订阅或状态更新接口。宿主内部的 `treasure-menu-event` 不属于第三方稳定 API；需要交互菜单的插件应明确绑定宿主版本，并优先等待/推动 SDK 增加正式事件接口。

## 10. 运行环境与验证要求

SDK 只在 Treasure 桌面宿主创建的插件 iframe 中运行。插件的 `npm run dev` 只提供可注册的本地页面；注册到已安装 Treasure 或源码启动的 `npm run tauri -- dev` 宿主后，所有 API 都调用实际 SQLite、设置、私有存储、文件、菜单、通知与日志能力。

桌面验证至少覆盖：文件选择和取消、Unicode 文件名、32 MiB 阈值、保存覆盖、根目录跨重启恢复、授权撤销、回收站、插件安装/升级/卸载。

当前 `files.openDialog` 的 TypeScript 成功值仍是 `FileReference[] | DirectoryReference`，不会根据 `kind` 自动收窄。目录选择后使用 `!Array.isArray(result.value)`，文件选择后使用 `Array.isArray(result.value)`；这是类型层限制，运行时仍按 `kind` 返回固定形态。

目录授权验证失败时，插件应将其视为“重新选择目录”的可恢复分支，不要依赖错误消息文本。

## 11. SDK 2.0 不兼容接口变更

移除的是旧 `file`/`setting` 模块、`Response`/`TreasureResponse`、`request(action, payload)`、裸路径与 Base64 文件读写、`readBinaryFile`、`writeBinaryFile`、`createFile`、`updateFile`、`createDir`、`mkdir`、`deleteDir`、`selectDirectory` 等旧接口。旧插件迁移另见 [MIGRATION-2.0.md](MIGRATION-2.0.md)。
