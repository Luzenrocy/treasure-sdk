# Treasure SDK 开发与扩展指南

> 本文面向 `treasure-sdk` 仓库维护者，说明如何扩展 SDK 的公开接口、桥接实现、CLI 与插件模板。它不是插件开发使用说明：调用 SDK 请参阅 [API 参考](API-REFERENCE.md)，创建和发布业务插件请参阅 [插件研发指南](https://github.com/Luzenrocy/treasure-plugins/blob/main/docs/PLUGIN-DEVELOPMENT-GUIDE.md)。

## 1. 开发环境与构建

```bash
npm install
npm run dev       # 监听 tsup 构建
npm run build     # 构建 ESM、CJS、类型声明与 CLI
```

`npm run build` 使用 `tsup` 生成 `dist/index.js`、`dist/index.cjs`、类型声明和 `dist/cli/index.js`。发布前应执行 `npm test`、`npm run test:coverage`、`npm run typecheck` 与 `npm run build`；新增和修改模块行、分支、函数、语句覆盖率均不得低于 80%。README 中的图表由 `docs/diagrams/*.mmd` 生成 SVG；修改图表后执行 `npm run docs:diagrams`。`npm version patch/minor/major` 会在版本号更新后自动生成并暂存 SVG 与版本化图片链接；随后执行 `npm run docs:diagrams:check` 可确认它们已同步。

## 2. 源码模块职责

| 路径 | 职责 |
| --- | --- |
| `src/result.ts` | 唯一公开结果模型 `Result<T>` 与错误码。 |
| `src/client.ts` | 定义完整的类型化客户端：`files` 负责文件选择与读写，`directories` 负责目录列举、创建和移入回收站，`storage` 负责插件私有数据，`database` 负责参数化查询、写入与事务，`settings` 负责与 Treasure 系统设置模块交互，`permissions` 负责目录访问授权；同时定义菜单、通知和日志能力。 |
| `src/index.ts` | npm 包的公开运行时导出与类型导出；未从此处导出的能力不属于稳定公共 API。 |
| `src/bridge.ts` | `initTreasure()` / `getTreasure()` 单例与宿主桥接初始化。 |
| `src/bridge-impl/production.ts` | iframe 内与 Treasure 宿主的桥接实现。 |
| `src/files.ts`、`src/storage.ts` | 模块式公开门面；不暴露路径或通用 action 请求。 |
| `src/cli/` | `treasure-sdk create` 参数解析、交互收集与模板渲染。 |
| `template/` | CLI 生成的 Vue + Vite 插件工程、打包脚本与元数据模板。 |

## 3. 公开接口设计原则与命名规范

本节是 SDK 维护者评审新增、调整或移除接口时的约束。目标是让插件作者只依赖正式文档和类型，就能完成自身业务需求的开发。

### 3.1 分层与职责

- **宿主负责安全与物理资源**：插件身份、真实路径、目录授权、回收站、SQLite 物理表名、SQL AST 校验与命名空间。
- **SDK 负责稳定、类型化抽象**：公开少量可组合的原子能力，不暴露宿主 action、绝对路径或物理表名。
- **插件负责业务流程**：附件上传/下载、PDF 导出、资产索引、任务管理、补偿策略和产品 UI 不应成为 SDK 业务接口。

这里的“宿主”是承载插件的 Treasure 桌面应用；“插件”是开发者交付的业务页面；“SDK”是插件调用宿主能力的唯一公开代码包。SDK 的职责是让插件能完成操作，而不是让插件理解宿主的路径、数据库前缀或内部消息格式。

判断新增能力时依次回答：

1. 它是否与具体插件产品对象无关，并至少有跨插件需求或可验证通用场景？
2. 是否已经能由现有原子 API 清晰组合？能组合则不新增。
3. 是否会暴露路径、宿主内部 action、物理表名或绕过宿主裁决？会则拒绝该设计。
4. 是否能以明确输入、明确输出、明确错误码表达，而不是用可选字段承载多个交叉语义？不能则先拆分模型。

### 3.2 接口原子能力拆解示例

| 需求类别 | 应提供的 SDK 能力 | 不应提供的 SDK 业务接口 |
| --- | --- | --- |
| 文件导入 | 选择文件、读取字节 | 上传附件、导入笔记 |
| 文件导出 | 选择目录/另存为、写入字节 | 导出 PDF、下载附件、保存报表 |
| 用户选择目录中的目录树 | 选择、建立授权、重新取得根目录引用、列举、创建、移入回收站 | 管理某个具体产品的目录树 |
| 私有数据 | 相对键读/写/删除 | 获取插件数据目录绝对路径 |
| 数据库 | 参数化 SQL 查询、写入、事务 | 任务 CRUD、通用 SQL 字符串 action |

例如附件下载应由插件组合 `storage.read → files.saveDialog → files.writeFile`；PDF/PNG 生成由插件选择渲染库，SDK 只负责受控保存。

### 3.3 命名与类型规范

- 使用标准英文动词和名词，名称与可观察行为一一对应：`openDialog`、`readFile`、`writeFile`、`list`、`create`、`remove`、`query`、`execute`、`transaction`。
- 同一概念只保留一个公开名称。不要并存 `mkdir/createDir/createDirectory`、`delete/remove`、`readBinaryFile/readFile` 等同义接口。
- `remove` 表示移入回收站；若未来存在不可恢复删除，必须另设语义明确、显式危险的名称和确认契约，不能复用 `remove`。
- 选项对象使用名词字段：`directory`、`file`、`fileName`、`data`、`defaultFileName`；禁止 `path`、`action`、`payload` 等泄露实现的泛化字段。
- 互斥输入用 TypeScript 联合类型表达，例如 `writeFile({ directory, fileName, data })` 与 `writeFile({ file, data })`，不要让一个方法默默猜测路径或目标类型。
- 二进制统一使用 `Uint8Array`，不公开 Base64 变体。
- 所有正常结果统一使用 `Result<T>`；普通失败不得在某些模块返回 `{ code, data, msg }`、在另一些模块抛异常。
- 当返回类型由判别字段决定时，优先使用重载或判别联合让 TypeScript 自动收窄。当前 `files.openDialog` 尚未按 `kind` 收窄，是待改进的公共类型债务；文档示例必须显式判断 `Array.isArray`。

### 3.4 文件、授权与数据边界

- 插件不能传入绝对路径。所有外部文件和目录必须先由用户通过系统对话框选择，并由宿主签发 `FileReference` 或 `DirectoryReference`。
- `files.saveDialog` 是正式稳定能力：单个系统窗口中选择位置和文件名，返回当前宿主会话内的只写 `FileReference`；插件应直接写入且不持久化该引用。
- `settings` 只读写 Treasure 系统设置模块中的字符串值。目录访问授权由 `permissions` 管理：插件用源码内稳定的 `permissionKey` 建立授权并在后续启动重新取得根目录引用，不保存绝对路径、授权 ID 或子目录引用。
- 授权历史由宿主管理：更换目录、重新授权或主动撤销会保留旧记录并标记为 `revoked`；仅插件卸载会物理删除该插件的授权记录。
- 子目录和目录列表中的文件引用由根目录授权派生，其有效期与对应授权记录绑定，不单独形成授权记录。
- `storage` 仅使用受校验的相对键。“插件自己管理的数据”与“用户主动选择目录中的数据”必须使用不同能力，不能混用。

### 3.5 数据库边界

- SDK 公开 `query`、`execute`、`transaction`，保留 CTE、JOIN、`EXISTS`、`RETURNING` 等 SQL 表达力；不要设计无法覆盖真实更新需求的伪 SQL DSL。
- 运行时只允许受控 DML。DDL、`PRAGMA`、`ATTACH/DETACH` 和多语句属于迁移或宿主内部职责。
- Rust AST 是表引用提取、声明验证和物理表名处理的唯一权威。插件作者只写业务表短名称和 `tables` 清单；不得在 SDK/宿主 TypeScript 侧用正则做安全裁决。
- 表、索引、外键和数据修复均使用版本化迁移。迁移器必须重写外键目标、重命名和删除等 DDL 表引用，不能只改写 SELECT/DML 表名。

### 3.6 文档和实现必须同源

每个稳定 API 必须同时在 `src/index.ts` 公开导出、在 `src/client.ts` 定义类型、在宿主能力注册表与处理器中实现，并同步 API 参考和插件模板。`ProductionBridge` 是通用 operation 传输层；只有消息信封、响应校验、超时或生命周期发生变化时才需要修改。文档必须写明：

- 方法签名、成功值、取消/失败结果、限制与最低宿主版本；
- 是否持久化授权、引用能否跨会话使用、是否允许隐藏文件；
- 至少一个真实业务组合样例，而非只列孤立方法。

## 4. SDK 能力扩展流程

新增或修改公开能力时，按以下链路检查，不要只修改单个文件：

1. 先为 `Result<T>` 成功、取消、未授权、无效参数和宿主错误写失败契约测试。
2. 在 `src/client.ts` 定义类型化请求/响应，避免增加公开 `request(action, payload)`。
3. 在 Treasure 能力注册表和处理器中实现 operation；确认通用 `ProductionBridge` 的信封、响应和超时策略能够承载它，只有传输规则变化时才修改桥接实现。身份、路径和表名空间只能由宿主裁决。插件调试由 Treasure 桌面应用加载本地开发地址，不提供独立浏览器宿主模拟。
4. 从 `src/index.ts` 只导出稳定模块、类型与 `Result<T>`；同步 [API 参考](API-REFERENCE.md)、桥接协议和模板。
5. 执行测试、覆盖率、类型检查与构建；原生文件选择、持久化授权、回收站、通知及安装升级卸载列入人工 E2E。

宿主到插件的反向事件也必须经过同样的公共契约链路。当前菜单点击仍通过内部 `treasure-menu-event` 分发；在提供 SDK 类型化订阅、来源验证和销毁语义之前，不应把该消息写成第三方可依赖 API。

### 4.1 兼容性与演进原则

- 2.0 已完成一次不兼容升级；2.x 内不得重新引入旧 `file`、裸路径或自由 action API。
- SDK 不绕过宿主裁决：SQL、文件、对话框、菜单等真实权限由 Treasure 宿主决定。
- 每个新能力必须声明最低宿主版本、schema、错误码和人工 E2E 责任。
- 公开接口的新增、重命名或移除必须先盘点全部内置插件、模板和文档。仅因接口数量多而删除，或迫使插件改用内部 action，均不符合 SDK 边界。
- 删除或重命名稳定 API 时，必须提供替代能力、迁移说明、源码迁移和跨项目验证；主版本边界才允许移除旧契约。

## 5. 扩展 CLI 与插件模板

`treasure-sdk create` 的命令定义位于 `src/cli/index.ts`，交互选项位于 `src/cli/utils/prompts.ts`，模板变量与文件渲染位于 `src/cli/utils/generator.ts`。

### 5.1 新增 CLI 选项

1. 在 `src/cli/index.ts` 声明选项，并明确默认值和 `--no-*` 语义。
2. 需要交互补全时同步调整 `src/cli/utils/prompts.ts` 的选项类型与提问逻辑。
3. 将收集到的值传给 `renderTemplate()`；仅在模板真正使用时增加模板变量。
4. 运行构建后的 CLI，在空目录中验证默认路径、显式选项、拒绝覆盖已有目录及 `--no-install` 行为。

### 5.2 修改插件模板

- 模板文件使用 `.tpl` 后缀；保留 Handlebars 占位符，并避免把用户输入直接写入可执行脚本上下文。
- 新插件运行所需的依赖应写入 `template/package.json.tpl`。当前模板已声明 `treasure-sdk`；CLI 默认执行 `npm install` 来安装它。
- 变更 `manifest.json`、入口 meta、构建脚本或生命周期 SQL 时，需同时遵守插件研发指南中的安装包契约。
- 模板变更后，至少新建一个临时插件项目，检查 `npm install`、`npm run dev`、`npm run build` 与 `npm run build:plugin`。

## 6. 文档与发布检查

- [ ] 公开 API 的类型、导出、宿主桥接实现已同步，且只使用 `Result<T>`。
- [ ] 新/变更 operation 已同步协议及 Treasure 宿主能力注册表、schema 和最低版本。
- [ ] API 参考已更新；插件研发流程变更已同步到插件仓库指南。
- [ ] API 参考、桥接协议、迁移说明和模板对同一方法的“保留/移除”结论一致；尤其不得将正在导出的稳定 API 写为已移除。
- [ ] 模板或参考插件至少覆盖：`Result<T>` 分支、参数化 SQL/迁移、文件选择读取、目录或另存为写入、私有存储及授权恢复的适用方式。
- [ ] CLI 与模板变更已通过新建插件项目验证。
- [ ] `npm test`、`npm run test:coverage`、`npm run typecheck`、`npm run docs:diagrams:check` 与 `npm run build` 成功。
- [ ] 发布前检查 `package.json` 的版本、`exports`、`bin` 与 `files` 是否覆盖新增的公开资源。

## 7. 文档边界

| 文档 | 负责内容 |
| --- | --- |
| [API 参考](API-REFERENCE.md) | 插件作者如何安装和调用已经发布的 SDK。 |
| 本文 | SDK 维护者如何修改 SDK 的源码、CLI 和模板。 |
| [桥接协议](BRIDGE-PROTOCOL.md) | SDK 与宿主之间的消息契约与兼容规则。 |
| [插件研发指南](https://github.com/Luzenrocy/treasure-plugins/blob/main/docs/PLUGIN-DEVELOPMENT-GUIDE.md) | 业务插件从创建到发布的工程流程。 |
