/**
 * Treasure 桥接工厂 —— 单例管理生产/开发桥接实例
 *
 * 职责：
 *   1. 自动检测运行环境（生产 iframe vs 独立浏览器开发）
 *   2. 初始化对应的桥接实现（ProductionBridge / DevBridge）
 *   3. 通过 getTreasure() 提供全局单例访问
 *
 * 使用约束：
 *   - 必须在 app.mount() 之前调用 initTreasure()
 *   - getTreasure() 在 initTreasure() 之前调用会抛出异常
 */

import { TreasureBridge, getPluginCode } from './types';
import { ProductionBridge } from './bridge-impl/production';
import { DevBridge } from './bridge-impl/dev';

/** 全局桥接实例（单例） */
let bridge: TreasureBridge | null = null;

/**
 * 检测当前是否运行在 Treasure 宿主 iframe 中
 *
 * 判断依据：在 iframe 中 `window.parent !== window`，
 * 独立浏览器开发时二者相等。
 */
function isProduction(): boolean {
  return window.parent !== window;
}

/**
 * 初始化并获取桥接实例（单例工厂）
 *
 * 首次调用时根据运行环境创建对应的桥接实现：
 *   - 生产环境（iframe）：ProductionBridge（postMessage → 宿主）
 *   - 开发环境（独立窗口）：DevBridge（localStorage + sql.js）
 *
 * 重复调用直接返回已创建的实例。
 *
 * @throws 不会抛出异常，静默降级为 'unknown' 插件编码
 *
 * @example
 * ```typescript
 * // main.ts
 * import { initTreasure } from '@treasure/sdk';
 * initTreasure();
 * app.mount('#app');
 * ```
 */
export function initTreasure(): TreasureBridge {
  if (bridge) return bridge;
  const pluginCode = getPluginCode();
  if (isProduction()) {
    bridge = new ProductionBridge(pluginCode);
  } else {
    bridge = new DevBridge(pluginCode);
  }
  return bridge;
}

/**
 * 获取已初始化的桥接实例
 *
 * @throws Error 如果未调用 initTreasure() 先初始化
 *
 * @example
 * ```typescript
 * import { getTreasure } from '@treasure/sdk';
 * const bridge = getTreasure();
 * const res = await bridge.query('SELECT 1', []);
 * ```
 */
export function getTreasure(): TreasureBridge {
  if (!bridge) throw new Error('Treasure 未初始化，请先调用 initTreasure()');
  return bridge;
}