/**
 * 配置管理包装器
 *
 * 对 bridge 设置相关方法的友好封装，支持按 key 存取单个配置。
 * getByKey/saveByKey 包含降级策略：若宿主不直接支持按 key 操作，
 * 则获取全部配置后客户端过滤/修改后再整体保存。
 *
 * @packageDocumentation
 */

import { getTreasure } from './bridge';
import type { TreasureResponse } from './types';

/**
 * 配置管理工具集
 *
 * @example
 * ```typescript
 * import { setting } from 'treasure-sdk';
 *
 * // 读取单个配置
 * const res = await setting.getByKey('storage_dir');
 * if (res.code === 1) {
 *   const dir = res.data.param_value;
 * }
 *
 * // 保存单个配置
 * await setting.saveByKey('storage_dir', '/new/path');
 * ```
 */
export const setting = {
  /**
   * 获取当前插件的全部配置项
   *
   * @returns 配置数组，每项包含 id, param_key, param_value, param_name 等字段
   */
  async getSettings(): Promise<TreasureResponse> {
    try {
      const api = getTreasure();
      const res = await api.getSettings();
      return { code: res.code, msg: res.msg, data: res.data };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /**
   * 批量保存配置项
   *
   * @param settings - 配置数组，每项需包含 id 和 param_value
   */
  async saveSettings(settings: any[]): Promise<TreasureResponse> {
    try {
      const api = getTreasure();
      const res = await api.saveSetting(settings);
      return { code: res.code, msg: res.msg, data: res.data };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /**
   * 按 key 获取单个配置
   *
   * 降级策略：
   *   1. 优先使用宿主的 getSettingByKey（若支持）
   *   2. 若不支持，获取全部配置后在客户端按字段匹配
   *
   * 匹配字段优先级：param_key > param_name
   *
   * @param paramKey - 配置项 key（对应 manifest.json settings[].param_key）
   *
   * @returns 匹配的配置项完整数据
   */
  async getByKey(paramKey: string): Promise<TreasureResponse> {
    try {
      const api = getTreasure();
      if (!api.getSettingByKey) {
        // 降级：获取全部配置后本地过滤
        const all = await api.getSettings();
        if (all.code === 1) {
          const found = (all.data || []).find(
            (s: any) => s.param_key === paramKey || s.param_name === paramKey
          );
          return found ? { code: 1, data: found } : { code: 0, msg: `未找到 ${paramKey}` };
        }
        return all;
      }
      return await api.getSettingByKey(paramKey);
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /**
   * 按 key 保存单个配置
   *
   * 降级策略：
   *   1. 优先使用宿主的 saveSettingByKey（若支持）
   *   2. 若不支持，获取全部配置后在客户端修改后整体保存
   *
   * @param paramKey   - 配置项 key
   * @param paramValue - 配置值
   */
  async saveByKey(paramKey: string, paramValue: string): Promise<TreasureResponse> {
    try {
      const api = getTreasure();
      if (!api.saveSettingByKey) {
        // 降级：获取全部配置后本地修改再整体保存
        const all = await api.getSettings();
        if (all.code === 1) {
          const settings = all.data || [];
          const idx = settings.findIndex(
            (s: any) => s.param_key === paramKey || s.param_name === paramKey
          );
          if (idx >= 0) {
            settings[idx].param_value = paramValue;
            return await api.saveSetting(settings);
          }
        }
        return { code: 0, msg: `未找到 ${paramKey}` };
      }
      return await api.saveSettingByKey(paramKey, paramValue);
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },
};