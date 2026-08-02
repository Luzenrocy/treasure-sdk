/**
 * treasure-sdk — Treasure 插件 SDK
 *
 * 插件开发统一 SDK，提供文件系统、SQL 数据库、配置管理、系统对话框等宿主能力。
 *
 * 架构分层：
 *   types.ts        — 接口定义（TreasureBridge）与工具类型
 *   bridge.ts       — initTreasure/getTreasure 工厂单例 + 环境检测
 *   file.ts         — 文件操作包装器（返回 TreasureResponse）
 *   setting.ts      — 配置管理包装器
 *   bridge-impl/    — 桥接实现（对外不可见）
 *     production.ts — 生产态：通过 postMessage 与宿主通信
 *     dev.ts        — 开发态：基于 localStorage + sql.js 模拟
 *
 * 使用方式：
 *   import { initTreasure, file, setting } from 'treasure-sdk';
 *   initTreasure();                    // 在 app.mount() 前调用
 *   const res = await file.readFile('/path/to/file');
 */

export { initTreasure, getTreasure } from './bridge';
export { file } from './file';
export { setting } from './setting';
export type { TreasureBridge, TreasureResponse, FileEntry, CreateDirOptions, DeleteDirOptions, SaveDialogOptions } from './types';
export { Response } from './types';