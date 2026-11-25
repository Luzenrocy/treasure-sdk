# SDK 优化待办

## 私有存储的存在性与枚举能力

- 状态：待规划
- 优先级：中

### 背景

当前 `storage` 仅提供 `read`、`write` 与 `remove`。插件若要判断私有文件是否存在，只能尝试读取并从失败结果推断；不同宿主平台会产生不同的底层 I/O 错误，导致首次初始化等产品流程与操作系统错误文案耦合。

### 目标

为插件私有存储提供不暴露绝对路径的只读查询能力：

```ts
storage.exists(key: string): Promise<Result<boolean>>
storage.list(input?: { prefix?: string }): Promise<Result<StorageEntry[]>>

type StorageEntry = {
  key: string
  size?: number
  updatedAt?: number
}
```

### 契约与安全边界

- `key` 与 `prefix` 沿用现有私有存储的相对路径校验，禁止绝对路径与越界路径。
- `exists` 仅在文件不存在时返回 `{ ok: true, value: false }`；权限、I/O、校验或宿主错误必须保留为 `{ ok: false, error }`，不得伪装成“不存在”。
- `list` 只返回当前插件命名空间内的相对 key 和有限元数据，不返回内容、绝对路径或其他插件的数据；结果按 key 稳定排序。
- 在桥接协议中增加 `storage.exists`、`storage.list` operation，并通过能力协商让旧宿主明确返回 `UNSUPPORTED`。

### 实施范围

1. 在 SDK client、storage facade、类型导出与 API 参考中增加接口和 `StorageEntry`。
2. 在桥接协议中定义请求/响应结构、键校验和错误映射。
3. 在 Treasure 宿主实现插件私有目录的安全 `exists` / `list` 操作。
4. 补充 SDK 与宿主 contract tests：不存在、空前缀、嵌套前缀、非法路径、权限失败和旧宿主不支持。
5. 将 Google Authenticator 的首次保险库初始化迁移到 `storage.exists('vault/v1.json')`，不再依赖读取探测。

### 验收标准

- 新插件可在不读取文件内容的情况下可靠判断私有文件是否存在。
- 宿主错误不会被错误地解释为文件不存在。
- 旧宿主下调用返回可处理的 `UNSUPPORTED`，不破坏既有 `read` / `write` / `remove` 行为。
