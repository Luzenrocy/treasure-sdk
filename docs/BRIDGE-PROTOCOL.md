# Treasure SDK 2.0 桥接协议

此协议是 SDK 与 Treasure 2.0.0+ 桌面应用之间的内部契约。本文中的“宿主”指负责加载插件 iframe、校验请求并执行系统能力的 Treasure 桌面应用。插件作者只调用 SDK 的类型化模块，不直接发送 operation 字符串。

## 消息信封与传输

请求：`{ type: 'treasure-db-request', requestId, operation, payload }`。响应：`{ type: 'treasure-db-response', requestId, result }`，其中 `result` 是 `Result<T>`。

`ProductionBridge` 为每次调用生成 `requestId`，并通过 `window.parent.postMessage(..., '*')` 把请求发送给父窗口。宿主以 `MessageEvent.source` 定位已注册 iframe，再校验该 iframe 的登记 origin；校验通过后，响应使用请求 origin 作为目标。SDK 以消息类型和 `requestId` 关联 Promise。普通 operation 默认 10 秒超时；`files.openDialog` 与 `files.saveDialog` 等待用户关闭系统窗口，不设置 SDK 超时。

宿主从 iframe 的 `MessageEvent.source` 与已注册 iframe 元数据解析插件身份；请求体中的任何 `pluginCode` 都不具有效力。

## 能力注册表

| capability | operation | 最低版本 |
| --- | --- | --- |
| files | `files.openDialog/saveDialog/readFile/writeFile` | 2.0.0 |
| directories | `directories.list/create/remove` | 2.0.0 |
| storage | `storage.read/write/remove` | 2.0.0 |
| database | `database.query/execute/transaction` | 2.0.0 |
| settings | `settings.get/set/list` | 2.0.0 |
| permissions | `permissions.grantDirectory/verifyDirectoryGrant/revokeDirectory` | 2.0.0 |
| menus | `menus.register/unregister` | 2.0.0 |
| notifications | `notifications.send` | 2.0.0 |
| logs | `logs.write` | 2.0.0 |

宿主先验证 operation 对应的请求 schema，再以解析到的身份进行文件授权、存储、设置、菜单和数据库命名空间裁决。未登记 operation 或无效 payload 返回 `VALIDATION_FAILED`。

## 安全边界

- 文件读取必须使用 `FileReference`；写入必须使用 `DirectoryReference` 与单个文件名，或使用 `saveDialog` 返回的宿主签发可写文件引用。路径绝不回传给插件。
- 目录选择得到的是当前会话可用的引用。插件先用 `settings.set({ key, directory })` 保存目录设置，再以稳定 `permissionKey` 调用 `permissions.grantDirectory` 创建授权绑定。后续从目录设置取得 `accessGrantId` 和 `pathHash`，用 `permissions.verifyDirectoryGrant` 获得新的会话 `DirectoryReference`；路径不会回传给插件。
- 授权生命周期：更换目录、重新授权或主动撤销时，宿主将旧授权标为 `revoked` 并保留历史；只有插件卸载时，才按插件编码物理删除其全部授权记录。
- 私有存储仅接受经过校验的相对键。
- SQL 解析、CTE/表引用检查和命名空间重写完全由 Rust AST 执行；前端不得用正则作安全决定。
- 运行时数据库拒绝 DDL、`PRAGMA`、`ATTACH`、`DETACH` 和多语句；安装/卸载迁移是宿主拥有的独立 AST 流程。

## 兼容性

2.0 不提供旧协议双轨兼容。旧 SDK 插件必须迁移后才能由 2.0 宿主运行；宿主应根据 `manifest.minPlatformVersion` 拒绝不兼容包。

## 已知契约缺口

当前 `ProductionBridge` 的响应监听只检查消息类型和 `requestId`，尚未再次校验 `event.source` 与 `event.origin`；请求发送端的 `targetOrigin` 也仍为 `'*'`。宿主已对请求来源做身份和 origin 校验，但这不能替代 SDK 响应端校验。后续应在初始化时确定父窗口 origin，并为伪造响应补契约测试。

宿主目前会以 `{ type: 'treasure-menu-event', menuId, itemId }` 向活动插件发送菜单点击，但 SDK 尚未公开对应的类型化事件订阅和状态更新 API。该反向消息是内部实现，不属于 2.0 面向第三方的稳定能力注册表。后续补齐时必须定义来源校验、订阅/销毁生命周期、菜单状态同步和兼容策略，并同步迁移内置插件。

目录授权验证失败必须返回结构化错误码；插件将其视为可重新选择目录的分支，不能依赖错误消息文本。
