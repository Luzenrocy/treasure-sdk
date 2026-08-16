# SDK 2.0 迁移指南

SDK 2.0 不兼容 1.x 的旧接口。旧插件需要先完成下表中的替换，再将最低宿主版本设为 `2.0.0`。

## 1. 接口替换清单

| 1.x 用法 | 2.0 替代方式 | 迁移要点 |
| --- | --- | --- |
| `file`、裸路径、Base64 文件内容 | `files`、`directories` 与 `Uint8Array` | 先由用户选择资源，再使用宿主签发的文件或目录引用。 |
| 路径型保存流程 | `files.saveDialog` → `files.writeFile({ file, data })` | “另存为”返回可写文件引用，不返回路径。 |
| 插件数据目录路径 | `storage.read/write/remove` | 只传相对键，不拼接应用数据目录。 |
| `setting`、目录路径设置 | 系统设置值使用 `settings`；目录访问授权使用 `permissions` | `param_type: "dir"` 的 `param_key` 应与稳定 `permissionKey` 一致。 |
| `TreasureBridge`、`request(action, payload)` | `files`、`database` 等类型化模块 | 插件不直接发送内部 operation。 |
| `Response`、`TreasureResponse` | `Result<T>` | 每次调用先判断 `ok`，普通失败不依赖异常。 |

## 2. 初始化与公开模块

在应用挂载前调用一次 `initTreasure()`，随后只使用 `files`、`directories`、`storage`、`database`、`settings`、`permissions`、`menus`、`notifications` 和 `logs`。

```ts
import { initTreasure, files } from 'treasure-sdk';

initTreasure();

const selected = await files.openDialog({ kind: 'file' });
if (!selected.ok) {
  if (selected.error.code !== 'CANCELLED') showError(selected.error.message);
  return;
}
```

`files.openDialog` 当前的 TypeScript 成功类型是 `FileReference[] | DirectoryReference`。文件选择用 `Array.isArray(result.value)` 判断，目录选择用 `!Array.isArray(result.value)` 判断。

## 3. 文件、目录与系统设置迁移

| 数据类型 | 迁移后的规则 |
| --- | --- |
| 用户文件 | 通过 `files.openDialog` 获取引用，再用 `files.readFile` 读取。 |
| 用户目录 | 选择后先 `settings.set({ key, directory })`，再用 `permissions.grantDirectory` 绑定；启动时读取目录设置中的 `accessGrantId`、`pathHash`，用 `permissions.verifyDirectoryGrant` 恢复。 |
| 导出文件 | 业务确定文件名时在目录引用内写入；需要用户改名时使用 `files.saveDialog`。 |
| 插件私有文件 | 使用 `storage` 和相对键；绝对路径、`..` 与空路径段会被拒绝。 |
| 系统设置 | 在 Treasure 系统设置模块中管理；插件通过 `settings.get/list` 读取当前值。 |

## 4. 错误处理

| 错误码 | 处理方式 |
| --- | --- |
| `CANCELLED` | 用户取消，正常结束当前流程。 |
| `GRANT_NOT_FOUND`、`REFERENCE_EXPIRED` | 引导重新选择目录或重新取得派生引用。 |
| `PERMISSION_DENIED`、`VALIDATION_FAILED`、`INVALID_FILE_NAME` | 检查调用上下文、参数、文件名、表清单和宿主版本。 |
| `FILE_TOO_LARGE` | 单次文件或私有存储读写不得超过 32 MiB。 |
| `NOT_FOUND`、`IO_ERROR`、`CONFLICT`、`UNSUPPORTED`、`INTERNAL` | 记录上下文，按业务提供提示或重试。 |

目录授权验证失败时，目录恢复流程应记录诊断并允许用户重新选择，不要匹配错误消息文本。

## 5. 运行与验证

插件项目的 `npm run dev` 只启动供 Treasure 注册调试插件的本地开发服务。插件页面需在已安装 Treasure 或通过 `npm run tauri -- dev` 启动的 Treasure 桌面应用中打开。

迁移完成后至少验证：

- [ ] 文件选择与取消；
- [ ] 目录授权跨重启恢复与撤销；
- [ ] Unicode 文件名和 32 MiB 边界；
- [ ] 另存为覆盖与目录内写入；
- [ ] 插件升级、卸载和私有数据清理；
- [ ] `npm run build`；如果项目已配置 `typecheck` 或 `test`，同时执行对应脚本。
