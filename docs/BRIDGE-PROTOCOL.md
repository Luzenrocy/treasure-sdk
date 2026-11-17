# Treasure SDK 桥接协议

此协议是 SDK 与 Treasure 桌面应用之间的内部契约。本文中的“宿主”指负责加载插件 iframe、校验请求并执行系统能力的 Treasure 桌面应用。插件作者只调用 SDK 的类型化模块，不直接发送 operation 字符串。

## 消息信封与传输

请求与响应信封按**能力域**区分。SDK 根据 operation 的前缀（能力域）选择对应请求类型，宿主按请求 `type` 分派到该能力域的处理器，再按 `operation` 分发到具体 action，并以对应的响应类型回传 `Result<T>`。

| 能力域 | 请求类型 | 响应类型 |
| --- | --- | --- |
| files | `treasure-file-request` | `treasure-file-response` |
| directories | `treasure-directory-request` | `treasure-directory-response` |
| storage | `treasure-storage-request` | `treasure-storage-response` |
| database | `treasure-db-request` | `treasure-db-response` |
| settings | `treasure-setting-request` | `treasure-setting-response` |
| permissions | `treasure-permission-request` | `treasure-permission-response` |
| menus | `treasure-menu-request` | `treasure-menu-response` |
| notifications | `treasure-notification-request` | `treasure-notification-response` |
| logs | `treasure-log-request` | `treasure-log-response` |

请求负载：`{ type, requestId, operation, payload }`。响应负载：`{ type, requestId, result }`，其中 `result` 是 `Result<T>`。

`ProductionBridge` 为每次调用生成 `requestId`，并通过 `window.parent.postMessage` 把请求发送给父窗口。宿主以 `MessageEvent.source` 定位已注册 iframe，再校验该 iframe 的登记 origin；校验通过后，响应使用请求 origin 作为目标。SDK 以 requestId 关联请求与响应，且只消费与请求能力域匹配的响应类型。普通 operation 默认 10 秒超时；`files.openDialog` 与 `files.saveDialog` 等待用户关闭系统窗口，不设置 SDK 超时。

宿主从 iframe 的 `MessageEvent.source` 与已注册 iframe 元数据解析插件身份；请求体中的任何 `pluginCode` 都不具有效力。

## 能力注册表

| capability | operation | 最低版本 |
| --- | --- | --- |
| files | `files.openDialog/saveDialog/readFile/writeFile` | 2.4.0 |
| directories | `directories.list/create/remove` | 2.4.0 |
| storage | `storage.read/write/remove` | 2.4.0 |
| database | `database.query/execute/transaction` | 2.4.0 |
| settings | `settings.get/set/list` | 2.4.0 |
| permissions | `permissions.grantDirectory/verifyDirectoryGrant/revokeDirectory` | 2.4.0 |
| menus | `menus.register/update/subscribe/unsubscribe/unregister/updateChecked` | 2.4.0 (独立 capabilityVersion=1) |
| notifications | `notifications.send` | 2.4.0 |
| logs | `logs.write` | 2.4.0 |

宿主先验证请求 type 与 operation 的能力域一致性，再校验 operation 对应的请求 schema，随后以解析到的身份进行文件授权、存储、设置、菜单和数据库命名空间裁决。未登记 type、未登记 operation 或 type 与 operation 能力域不一致时返回 `VALIDATION_FAILED` 或不响应。

`menus.register` 与 `menus.update` 语义一致：重复注册同一 `menuId` 即等价于更新（宿主内部走同一条注册路径并重建窗口菜单）。`menus.update` 仅作为兼容别名保留。动态勾选状态同步应优先使用 `menus.updateChecked(menuId, itemId, checked)` 轻量路径：宿主只更新缓存句柄的勾选状态，不触发整窗菜单重建，也避免重复提交全量 items。菜单注册请求会校验 `rootLabel` 必须属于宿主已知系统菜单名（如 View/File/Edit/Window/Help 及其本地化别名）且 items 条目的 id/label/type 合法。

## 安全边界

- 文件读取必须使用 `FileReference`；写入必须使用 `DirectoryReference` 与单个文件名，或使用 `saveDialog` 返回的宿主签发可写文件引用。路径绝不回传给插件。
- 目录选择得到的是当前会话可用的引用。插件先用 `settings.set({ key, directory })` 保存目录设置，再以稳定 `permissionKey` 调用 `permissions.grantDirectory` 创建授权绑定。后续从目录设置取得 `accessGrantId` 和 `pathHash`，用 `permissions.verifyDirectoryGrant` 获得新的会话 `DirectoryReference`；路径不会回传给插件。
- 授权生命周期：更换目录、重新授权或主动撤销时，宿主将旧授权标为 `revoked` 并保留历史；只有插件卸载时，才按插件编码物理删除其全部授权记录。
- 私有存储仅接受经过校验的相对键。
- SQL 解析、CTE/表引用检查和命名空间重写完全由 Rust AST 执行；前端不得用正则作安全决定。
- 运行时数据库拒绝 DDL、`PRAGMA`、`ATTACH`、`DETACH` 和多语句；安装/卸载迁移是宿主拥有的独立 AST 流程。
- SDK 只在父窗口来源（`event.source === window.parent`）的消息上消费响应与菜单事件，且匹配请求能力域的响应类型，防止伪造响应注入。

## 兼容性

- 2.4.0 宿主对旧 SDK（2.x 早期）插件的 `treasure-db-request` 统一信封保持兼容：旧 SDK 的所有请求都使用该类型，宿主按 operation 分发，并以 `treasure-db-response` 响应，内置插件无需单独迁移即可升级宿主。
- 新 SDK 插件需要宿主 2.4.0 或更高版本。旧版宿主不识别按能力域拆分的新 type，请求会被忽略，SDK 侧超时返回 `IO_ERROR`；插件应根据 `manifest.minPlatformVersion` 阻止不兼容宿主加载。
- 2.0 不提供旧协议双轨兼容。旧 SDK 插件必须迁移后才能由 2.0 宿主运行；宿主应根据 `manifest.minPlatformVersion` 拒绝不兼容包。

## 菜单事件

宿主以 `{ type: 'treasure-menu-event', menuId, itemId, pluginCode }` 向活动插件发送菜单点击（宿主→插件的单向事件，不属于请求/响应信封体系）。SDK 在本地维护 listener registry，postMessage 只传递 token 和事件字段，不传递函数。SDK 校验 `event.source === window.parent` 后按 `menuId` 分发给本地监听器。宿主校验 iframe source/origin、插件身份和订阅 token；能力不可用统一返回 `UNSUPPORTED`。

插件不得自行监听 `treasure-menu-event`：菜单点击请使用 `menus.subscribe(menuId, listener)` 公共 API，由 SDK 负责来源校验与分发。

## 已知契约缺口

- 请求发送端 `targetOrigin` 在无法解析父窗口 origin（如 `plugin://` 自定义协议）时回退 `'*'`。宿主请求端仍以 `MessageEvent.source` 与登记 origin 校验插件身份，且 SDK 响应监听校验 `event.source === window.parent`，因此 `'*'` 不构成消息伪造通道。后续若引入双方握手协议，可进一步收紧。

目录授权验证失败必须返回结构化错误码；插件将其视为可重新选择目录的分支，不能依赖错误消息文本。