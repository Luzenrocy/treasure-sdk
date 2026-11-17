# Changelog

## 3.0.0

- 移除重复的 `menus.update`。使用同一 `menuId` 再次调用 `menus.register` 即可覆盖菜单声明；动态勾选状态继续使用 `menus.updateChecked`。
- `menus.subscribeConfirmed()` 返回 `ConfirmedMenuSubscription`，其 `unsubscribeConfirmed()` 会等待宿主确认后再移除本地监听器。
- 修正文档中的菜单订阅生命周期说明。

## 2.3.0

### Changed

- **按能力域拆分桥接消息类型（协议方案 B）**：插件请求不再统一使用
  `treasure-db-request` 信封，而是按能力域区分，例如
  `treasure-menu-request`、`treasure-file-request`、`treasure-setting-request`。
  宿主按请求 `type` 分派到对应能力域，再按 `operation` 分发到具体 action，
  响应使用对应的 `treasure-{domain}-response`。
- `ProductionBridge` 响应监听现在校验 `event.source === window.parent` 与
  （可解析时）`event.origin`，且只消费与请求能力域匹配的响应类型，修复
  BRIDGE-PROTOCOL 记录的契约缺口（伪造响应防护）。
- 菜单勾选状态同步新增轻量路径 `menus.updateChecked(menuId, itemId, checked)`：
  只更新单个菜单项勾选，不触发整窗菜单重建。`menus.register` 与
  `menus.update` 语义统一（重复注册同一 menuId 即覆盖更新），update 作为
  兼容别名保留。
- 请求发送 `targetOrigin` 优先使用解析到的父窗口 origin，解析失败时回退
  `'*'`，保持与宿主 origin 校验的对称性。

### Compatibility note

- 需要宿主 2.4.0 或更高版本：旧版宿主只识别 `treasure-db-request` 信封，
  新 SDK 发送的域类型请求会被旧宿主忽略并触发 SDK 侧 `IO_ERROR` 超时。
- 宿主对旧 SDK（2.x 早期）插件的 `treasure-db-request` 统一信封保持兼容，
  内置插件无需单独迁移即可升级宿主。

## 2.1.1

### Fixed

- Render README architecture diagrams as committed SVG assets so they display on
  npmjs.com, where Mermaid code blocks are not rendered.

### Changed

- Added automated Mermaid SVG generation, versioned README image links, and CI
  and publish-time checks that prevent diagram assets from becoming stale.

## 2.1.0

### Changed

- Directory settings now retain authorization metadata (accessGrantId, pathHash,
  and directoryName) instead of exposing an absolute filesystem path.
- settings.set accepts a selected directory reference directly, and
  permissions.grantDirectory returns both the directory reference and its stable
  grant ID.
- Added permissions.verifyDirectoryGrant for validating a previously stored
  directory authorization.

### Compatibility note

- permissions.getDirectory has been replaced by
  permissions.verifyDirectoryGrant. Update plugins and the Treasure host
  together when adopting this release.

## 2.0.0

### Breaking changes

- Removed `file`, `setting`, `Response`, `TreasureResponse`, public `request(action, payload)`, raw file paths, Base64 file operations and the legacy path-returning save flow.
- Removed `readBinaryFile`, `writeBinaryFile`, `createFile`, `updateFile`, `createDir`, `mkdir`, `deleteDir`, `selectDirectory` and the legacy untyped `saveDialog`.
- Requires Treasure host 2.0.0 or newer; no legacy transport compatibility layer is provided.

### Added

- Stable typed modules: `files`, `directories`, `storage`, `database`, `settings`, `menus`, `notifications` and `logs`.
- Single `Result<T>` response model and structured error codes including `FILE_TOO_LARGE`.
- File and directory references scoped by host-granted user authorization; contents are `Uint8Array`. The typed `files.saveDialog()` returns a writable `FileReference`.
- Private relative-key storage, typed SQL statements and per-statement transaction results.
- ProductionBridge contract tests、API 参考和桌面 E2E 检查清单。

See [MIGRATION-2.0.md](docs/MIGRATION-2.0.md) for migration guidance.
