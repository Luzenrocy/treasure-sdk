/**
 * 生产态桥接实现 —— ProductionBridge
 *
 * 运行在 Treasure 宿主 iframe 内部时使用。
 * 通过 window.parent.postMessage 向宿主发送请求，
 * 宿主 pluginBridge.ts 监听 'treasure-db-request' 消息并处理。
 *
 * 通信协议详见 docs/BRIDGE-PROTOCOL.md。
 *
 * @packageDocumentation
 */

import { TreasureBridge, Response } from '../types';
import type { SaveDialogOptions } from '../types';

// ============================================================
// 内部类型
// ============================================================

/** 待处理请求记录 */
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  /** 超时定时器句柄，timeoutMs=0 时为 undefined */
  timer?: ReturnType<typeof setTimeout>;
}

// ============================================================
// ProductionBridge
// ============================================================

/**
 * 生产环境桥接 —— 通过 postMessage 与宿主通信
 *
 * @remarks
 * 桥接生命周期：
 *   1. 构造时注册 message 监听，准备接收宿主响应
 *   2. 每次调用 send() 生成唯一 requestId，发送请求并等待响应
 *   3. 收到宿主 'treasure-db-response' 后匹配 requestId 并 resolve
 *   4. destroy() 断开监听并 reject 所有待处理请求
 *
 * @example
 * ```typescript
 * const bridge = new ProductionBridge('my-plugin');
 * const res = await bridge.query('SELECT * FROM notes', ['notes']);
 * ```
 */
export class ProductionBridge implements TreasureBridge {
  /** 请求 ID 递增计数器 */
  private requestId = 0;
  /** 待处理请求映射表（requestId → PendingRequest） */
  private pending = new Map<string, PendingRequest>();
  /** 当前插件编码 */
  private pluginCode: string;

  /**
   * @param pluginCode - 插件编码，对应 manifest.json 的 name 字段
   */
  constructor(pluginCode: string) {
    this.pluginCode = pluginCode;
    window.addEventListener('message', this.handleResponse);
  }

  /**
   * 销毁桥接 —— 断开事件监听，拒绝所有待处理请求
   *
   * 在插件 unmount 时调用，避免内存泄漏。
   */
  destroy() {
    window.removeEventListener('message', this.handleResponse);
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('桥接已销毁'));
    }
    this.pending.clear();
  }

  // ── 消息接收 ────────────────────────────────────────────

  /**
   * 处理宿主返回的消息
   *
   * 根据 requestId 查找待处理的请求，执行 resolve 回调。
   */
  private handleResponse = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type !== 'treasure-db-response') return;
    const p = this.pending.get(data.requestId);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(data.requestId);
    p.resolve(data);
  };

  // ── 消息发送 ────────────────────────────────────────────

  /**
   * 向宿主发送请求并等待响应
   *
   * @param action    - 操作名称（对应 pluginBridge.ts 的 switch-case）
   * @param payload   - 操作参数
   * @param timeoutMs - 超时毫秒数（默认 10000ms，设为 0 表示无超时）
   *
   * @returns 宿主返回的完整响应对象
   */
  private send(action: string, payload?: any, timeoutMs = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `req_${++this.requestId}`;
      let timer: ReturnType<typeof setTimeout> | undefined;
      // timeoutMs > 0 时设置超时，=0 时等待用户操作（如对话框）不超时
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.pending.delete(requestId);
          reject(new Error('请求超时'));
        }, timeoutMs);
      }
      this.pending.set(requestId, { resolve, reject, timer });
      window.parent.postMessage(
        { type: 'treasure-db-request', requestId, pluginCode: this.pluginCode, action, ...payload },
        '*'
      );
    });
  }

  // ── SQL 操作 ────────────────────────────────────────────

  // tables 参数由宿主侧用于 verify_sql 安全校验 + rewriteWithDeclaredTables 表名重写

  query<T = any>(sql: string, tables: string[], params?: any[]): Promise<Response> {
    return this.send('query', { sql, tables, params });
  }
  execute(sql: string, tables: string[], params?: any[]): Promise<Response> {
    return this.send('execute', { sql, tables, params });
  }
  transaction(ops: { sql: string; tables: string[]; params?: any[] }[]): Promise<Response> {
    return this.send('transaction', { ops });
  }

  // ── 文件系统操作 ────────────────────────────────────────

  // 所有文件操作均委托给宿主，宿主调用 Tauri @tauri-apps/plugin-fs API

  async readFile(path: string): Promise<string> {
    const res = await this.send('readFile', { path });
    if (res.code !== 1) throw new Error(res.msg);
    return res.data;
  }
  async readBinaryFile(path: string): Promise<string> {
    const res = await this.send('readBinaryFile', { path });
    if (res.code !== 1) throw new Error(res.msg);
    return res.data;
  }
  async readDir(path: string): Promise<Array<{ name: string; path: string; isDirectory: boolean; isFile: boolean }>> {
    const res = await this.send('readDir', { path });
    if (res.code !== 1) throw new Error(res.msg);
    return res.data || [];
  }
  async writeFile(path: string, content: string): Promise<void> {
    const res = await this.send('writeFile', { path, content });
    if (res.code !== 1) throw new Error(res.msg);
  }
  async writeBinaryFile(path: string, base64Content: string): Promise<void> {
    const res = await this.send('writeBinaryFile', { path, content: base64Content });
    if (res.code !== 1) throw new Error(res.msg);
  }
  async mkdir(path: string): Promise<void> {
    const res = await this.send('mkdir', { path });
    if (res.code !== 1) throw new Error(res.msg);
  }
  async deleteFile(path: string): Promise<void> {
    const res = await this.send('deleteFile', { path });
    if (res.code !== 1) throw new Error(res.msg);
  }
  async createFile(path: string, content?: string): Promise<void> {
    const res = await this.send('createFile', { path, content });
    if (res.code !== 1) throw new Error(res.msg);
  }
  async createDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const res = await this.send('createDir', { path, recursive: options?.recursive ?? true });
    if (res.code !== 1) throw new Error(res.msg);
  }
  async updateFile(path: string, content: string): Promise<void> {
    const res = await this.send('updateFile', { path, content });
    if (res.code !== 1) throw new Error(res.msg);
  }
  async deleteDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const res = await this.send('deleteDir', { path, recursive: options?.recursive ?? true });
    if (res.code !== 1) throw new Error(res.msg);
  }

  // ── 系统对话框 ──────────────────────────────────────────

  // 对话框使用 timeoutMs=0（无超时），因为用户可能长时间不操作

  async selectDirectory(title: string): Promise<string | null> {
    const res = await this.send('selectDirectory', { title }, 0);
    if (res.code !== 1) throw new Error(res.msg);
    return res.data || null;
  }
  async saveDialog(options: SaveDialogOptions): Promise<string | null> {
    const res = await this.send('saveDialog', { defaultPath: options.defaultPath, filters: options.filters }, 0);
    if (res.code !== 1) throw new Error(res.msg);
    return res.data || null;
  }

  // ── 配置管理 ────────────────────────────────────────────

  getSettings(): Promise<Response> { return this.send('getSettings'); }
  saveSetting(settings: any[]): Promise<Response> { return this.send('saveSetting', { settings }); }
  getSettingByKey(paramKey: string): Promise<Response> { return this.send('getSettingByKey', { paramKey }); }
  saveSettingByKey(paramKey: string, paramValue: string): Promise<Response> {
    return this.send('saveSettingByKey', { paramKey, paramValue });
  }

  // ── 通用通道 ────────────────────────────────────────────

  /**
   * 通用 action 请求（菜单注册/注销/状态同步等）
   *
   * action 字符串直接对应宿主 pluginBridge.ts 的 switch-case，
   * 宿主按 action 字符串自动分发，无需在此方法中逐个枚举。
   */
  request(action: string, payload?: any): Promise<any> {
    return this.send(action, payload);
  }

  async log(level: 'trace' | 'debug' | 'info' | 'warn' | 'error', category: 'db' | 'biz' | 'sys' | 'bridge', message: string, details?: any): Promise<void> {
    const res = await this.send('log', { level, category, message, details });
    if (res.code !== 1) throw new Error(res.msg);
  }

  async sendNotification(title: string, body: string, options?: import('../types').NotificationOptions): Promise<void> {
    const res = await this.send('sendNotification', { title, body, ...options });
    if (res.code !== 1) throw new Error(res.msg);
  }
}
