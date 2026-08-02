# Treasure SDK 开发与扩展指南

> 本文面向 `treasure-sdk` 仓库维护者，说明如何扩展 SDK 的公开接口、桥接实现、CLI 与插件模板。它不是插件开发使用说明：调用 SDK 请参阅 [API 参考](API-REFERENCE.md)，创建和发布业务插件请参阅 [插件研发指南](https://github.com/Luzenrocy/treasure-plugins/blob/main/docs/PLUGIN-DEVELOPMENT-GUIDE.md)。

## 1. 本地准备与构建

```bash
npm install
npm run dev       # 监听 tsup 构建
npm run build     # 构建 ESM、CJS、类型声明与 CLI
```

`npm run build` 使用 `tsup` 生成 `dist/index.js`、`dist/index.cjs`、类型声明和 `dist/cli/index.js`。发布前 `prepublishOnly` 会再次执行构建。请使用 Node.js LTS 与 npm；本仓库没有独立的测试脚本，因此每项变更都应至少完成构建和对应的手工验证。

## 2. 源码职责

| 路径 | 职责 |
| --- | --- |
| `src/types.ts` | `TreasureBridge`、响应对象、文件与对话框等公开类型。 |
| `src/index.ts` | npm 包的公开运行时导出与类型导出；未从此处导出的能力不属于稳定公共 API。 |
| `src/bridge.ts` | `initTreasure()` / `getTreasure()` 单例与运行环境选择。 |
| `src/bridge-impl/production.ts` | iframe 内与 Treasure 宿主的生产态桥接。 |
| `src/bridge-impl/dev.ts` | 浏览器独立开发时的模拟实现。 |
| `src/file.ts`、`src/setting.ts` | 面向插件作者的便捷 API。 |
| `src/cli/` | `treasure-sdk create` 参数解析、交互收集与模板渲染。 |
| `template/` | CLI 生成的 Vue + Vite 插件工程、打包脚本与元数据模板。 |

## 3. 扩展一项 SDK 能力

新增或修改公开能力时，按以下链路检查，不要只修改单个文件：

1. 在 `src/types.ts` 增加或调整参数、返回值及 `TreasureBridge` 方法定义；保持响应对象的 `code` / `data` / `msg` 约定。
2. 在 `src/bridge-impl/production.ts` 实现真实宿主调用。若引入新的 action，同时更新 [桥接协议](BRIDGE-PROTOCOL.md)，并与 Treasure 的请求分发和权限校验实现一起验证。
3. 在 `src/bridge-impl/dev.ts` 提供语义相近的开发态模拟，或明确返回“开发模式不支持”的结构化响应；不得静默伪造成功结果。
4. 如需更易用的入口，在 `src/file.ts` 或 `src/setting.ts` 封装；随后从 `src/index.ts` 导出运行时方法和相应类型。
5. 在 [API 参考](API-REFERENCE.md) 补充签名、参数、返回值、限制和最小示例。只有底层消息形态发生变化时，才修改桥接协议。
6. 执行 `npm run build`，在独立浏览器和已安装 Treasure 宿主中分别验证；涉及新 action 时还应验证不支持旧宿主的失败路径。

### 兼容性原则

- 已发布方法的参数语义和成功/失败 code 应保持向后兼容；需要演进时优先新增可选参数或新方法。
- SDK 不绕过宿主裁决：SQL、文件、对话框、菜单等真实权限由 Treasure 宿主决定。
- 生产态与开发态的行为可有能力差异，但必须在 API 参考和返回值中如实表达。
- 新 action 必须同时考虑旧 SDK、旧宿主和插件包的兼容路径；版本策略见桥接协议。

## 4. 扩展 CLI 与插件模板

`treasure-sdk create` 的命令定义位于 `src/cli/index.ts`，交互选项位于 `src/cli/utils/prompts.ts`，模板变量与文件渲染位于 `src/cli/utils/generator.ts`。

### 新增 CLI 选项

1. 在 `src/cli/index.ts` 声明选项，并明确默认值和 `--no-*` 语义。
2. 需要交互补全时同步调整 `src/cli/utils/prompts.ts` 的选项类型与提问逻辑。
3. 将收集到的值传给 `renderTemplate()`；仅在模板真正使用时增加模板变量。
4. 运行构建后的 CLI，在空目录中验证默认路径、显式选项、拒绝覆盖已有目录及 `--no-install` 行为。

### 修改模板

- 模板文件使用 `.tpl` 后缀；保留 Handlebars 占位符，并避免把用户输入直接写入可执行脚本上下文。
- 新插件运行所需的依赖应写入 `template/package.json.tpl`。当前模板已声明 `treasure-sdk`；CLI 默认执行 `npm install` 来安装它。
- 变更 `manifest.json`、入口 meta、构建脚本或生命周期 SQL 时，需同时遵守插件研发指南中的安装包契约。
- 模板变更后，至少新建一个临时插件项目，检查 `npm install`、`npm run dev`、`npm run build` 与 `npm run build:plugin`。

## 5. 文档与发布检查

- [ ] 公开 API 的类型、导出、生产态实现与开发态实现已同步。
- [ ] 新/变更 action 已同步协议及 Treasure 宿主实现，并验证兼容性。
- [ ] API 参考已更新；插件研发流程变更已同步到插件仓库指南。
- [ ] CLI 与模板变更已通过新建插件项目验证。
- [ ] `npm run build` 成功，产物包含库入口、类型声明和 CLI。
- [ ] 发布前检查 `package.json` 的版本、`exports`、`bin` 与 `files` 是否覆盖新增的公开资源。

## 6. 文档边界

| 文档 | 负责内容 |
| --- | --- |
| [API 参考](API-REFERENCE.md) | 插件作者如何安装和调用已经发布的 SDK。 |
| 本文 | SDK 维护者如何修改 SDK 的源码、CLI 和模板。 |
| [桥接协议](BRIDGE-PROTOCOL.md) | SDK 与宿主之间的消息契约与兼容规则。 |
| [插件研发指南](https://github.com/Luzenrocy/treasure-plugins/blob/main/docs/PLUGIN-DEVELOPMENT-GUIDE.md) | 业务插件从创建到发布的工程流程。 |
