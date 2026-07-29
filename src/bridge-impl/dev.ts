/**
 * 开发态桥接实现 —— DevBridge
 *
 * 独立浏览器开发模式时使用，通过 localStorage + sql.js 模拟宿主功能。
 * 无需 Tauri 运行时环境，可独立在浏览器中开发和调试插件。
 *
 * 数据存储策略（localStorage）：
 *   treasure_dev_db                 — sql.js 数据库序列化（base64）
 *   treasure_dev_settings::{code}   — 插件配置（JSON）
 *   file_{path}                     — 文件内容
 *   dir_{path}                      — 目录标记
 *
 * @packageDocumentation
 */

import { TreasureBridge, Response } from '../types';
import type { SaveDialogOptions } from '../types';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

/**
 * 开发环境桥接 —— 纯前端模拟，无需宿主
 *
 * @remarks
 * 与 ProductionBridge 保持接口一致，sql.js 用 WASM 在浏览器中运行 SQLite，
 * 文件系统和配置数据存储在 localStorage 中。
 *
 * 限制：
 *   - selectDirectory 使用 prompt() 模拟
 *   - saveDialog 使用 prompt() 模拟
 *   - 菜单注册/注销无宿主环境，返回空响应
 *   - 数据生命周期同 localStorage，清除浏览器数据会丢失
 */
export class DevBridge implements TreasureBridge {
  /** sql.js SQLite 数据库实例 */
  private db: SqlJsDatabase | null = null;
  /** 数据库初始化完成 Promise（异步等待 WASM 加载） */
  private ready: Promise<void>;
  /** localStorage 数据持久化定时器（每 5s） */
  private persistTimer: ReturnType<typeof setInterval> | null = null;
  /** localStorage 中数据库的 key */
  private DB_NAME = 'treasure_dev_db';
  /** 插件配置在 localStorage 中的 key */
  private settingsKey: string;

  /**
   * @param pluginCode - 插件编码，用于隔离不同插件的配置
   */
  constructor(pluginCode = 'unknown') {
    this.settingsKey = `treasure_dev_settings::${pluginCode}`;
    this.ready = this.init();
  }

  /**
   * 初始化 sql.js 数据库
   *
   * 从 localStorage 恢复已有数据，或创建空数据库。
   * 启动每 5s 的持久化定时器，自动保存数据到 localStorage。
   */
  private async init() {
    const SQL = await initSqlJs();
    const saved = localStorage.getItem(this.DB_NAME);
    if (saved) {
      // 从 localStorage 恢复数据库
      const buffer = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run('PRAGMA journal_mode=MEMORY');
    // 每 5 秒自动持久化
    this.persistTimer = setInterval(() => this.persist(), 5000);
  }

  /**
   * 将当前数据库状态序列化到 localStorage
   */
  private persist() {
    if (!this.db) return;
    const data = this.db.export();
    const binary = String.fromCharCode(...data);
    localStorage.setItem(this.DB_NAME, btoa(binary));
  }

  /**
   * 执行初始化 SQL 脚本（开发态专用）
   *
   * 供 scripts/init.sql 在开发时使用，模拟宿主在插件导入时执行初始化脚本。
   *
   * @param sql - 要执行的 SQL 语句（多条用 ; 分隔）
   */
  async runInitScript(sql: string) {
    await this.ready;
    if (!this.db) return;
    this.db.run(sql);
    this.persist();
  }

  /**
   * 等待数据库就绪并获取实例
   */
  private async ensureDb(): Promise<SqlJsDatabase> {
    await this.ready;
    if (!this.db) throw new Error('数据库未初始化');
    return this.db;
  }

  // ── SQL 操作 ────────────────────────────────────────────

  /**
   * 重写 SQL 中的裸表名，添加开发态前缀
   *
   * 模拟宿主的 rewriteWithDeclaredTables 行为。
   * 开发环境下表名注入 "plugin_dev_" 前缀避免命名冲突。
   *
   * @param sql     - 原始 SQL
   * @param tables  - 声明的表名列表
   * @returns 重写后的 SQL
   */
  private rewriteSql(sql: string, tables: string[]): string {
    const prefix = '"plugin_dev_';
    let result = sql;
    for (const table of tables) {
      if (result.includes(prefix + table + '"')) continue;
      const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), prefix + table + '"');
    }
    return result;
  }

  async query<T = any>(sql: string, tables: string[], params?: any[]): Promise<Response> {
    const rewritten = this.rewriteSql(sql, tables);
    return this.queryRaw(rewritten, params);
  }

  /**
   * 执行原始查询（绕过表名重写）
   */
  private async queryRaw(sql: string, params?: any[]): Promise<Response> {
    const db = await this.ensureDb();
    try {
      const stmt = db.prepare(sql);
      if (params) stmt.bind(params);
      const rows: any[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return Response.ok(rows);
    } catch (e: any) { return Response.error(e.message); }
  }

  async execute(sql: string, tables: string[], params?: any[]): Promise<Response> {
    const rewritten = this.rewriteSql(sql, tables);
    return this.executeRaw(rewritten, params);
  }

  /**
   * 执行原始写操作（绕过表名重写）
   */
  private async executeRaw(sql: string, params?: any[]): Promise<Response> {
    const db = await this.ensureDb();
    try {
      db.run(sql, params);
      this.persist();
      return Response.ok({ rowsAffected: db.getRowsModified() });
    } catch (e: any) { return Response.error(e.message); }
  }

  async transaction(ops: { sql: string; tables: string[]; params?: any[] }[]): Promise<Response> {
    const db = await this.ensureDb();
    try {
      db.run('BEGIN');
      for (const op of ops) db.run(this.rewriteSql(op.sql, op.tables), op.params || []);
      db.run('COMMIT');
      this.persist();
      return Response.ok({ executed: ops.length });
    } catch (e: any) { db.run('ROLLBACK'); return Response.error(e.message); }
  }

  // ── 文件系统操作 ────────────────────────────────────────

  async readFile(path: string): Promise<string> {
    const content = localStorage.getItem(`file_${path}`);
    if (content === null) throw new Error(`文件不存在: ${path}`);
    return content;
  }

  async readBinaryFile(path: string): Promise<string> {
    return this.readFile(path);
  }

  async readDir(path: string): Promise<Array<{ name: string; path: string; isDirectory: boolean; isFile: boolean }>> {
    const prefix = path.endsWith('/') ? path : `${path}/`;
    const result: Array<{ name: string; path: string; isDirectory: boolean; isFile: boolean }> = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('file_') && !key.startsWith('dir_')) continue;
      const fullPath = key.slice(5);
      if (!fullPath.startsWith(prefix)) continue;
      const rest = fullPath.slice(prefix.length);
      if (!rest || rest.includes('/')) continue;
      result.push({ name: rest, path: fullPath, isDirectory: key.startsWith('dir_'), isFile: key.startsWith('file_') });
    }
    return result;
  }

  async writeFile(path: string, content: string): Promise<void> {
    localStorage.setItem(`file_${path}`, content);
  }

  async writeBinaryFile(path: string, base64Content: string): Promise<void> {
    localStorage.setItem(`file_${path}`, base64Content);
  }

  async mkdir(path: string): Promise<void> {
    localStorage.setItem(`dir_${path}`, '1');
  }

  async deleteFile(path: string): Promise<void> {
    localStorage.removeItem(`file_${path}`);
    localStorage.removeItem(`dir_${path}`);
  }

  async createFile(path: string, content?: string): Promise<void> {
    localStorage.setItem(`file_${path}`, content ?? '');
  }

  async createDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    localStorage.setItem(`dir_${path}`, '1');
  }

  async updateFile(path: string, content: string): Promise<void> {
    localStorage.setItem(`file_${path}`, content);
  }

  async deleteDir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive !== false) {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith('file_') && !key.startsWith('dir_')) continue;
        const fullPath = key.slice(5);
        if (fullPath === path || fullPath.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    }
    localStorage.removeItem(`dir_${path}`);
  }

  // ── 系统对话框 ──────────────────────────────────────────

  async selectDirectory(title: string): Promise<string | null> {
    return prompt(`请选择目录 (${title})`) || null;
  }

  async saveDialog(options: SaveDialogOptions): Promise<string | null> {
    const name = prompt('保存文件为:', options.defaultPath);
    if (!name) return null;
    return name;
  }

  // ── 配置管理 ────────────────────────────────────────────

  async getSettings(): Promise<Response> {
    const raw = localStorage.getItem(this.settingsKey);
    return Response.ok(raw ? JSON.parse(raw) : []);
  }

  async saveSetting(settings: any[]): Promise<Response> {
    localStorage.setItem(this.settingsKey, JSON.stringify(settings));
    return Response.ok({ updated: settings.length });
  }

  async getSettingByKey(paramKey: string): Promise<Response> {
    const all = await this.getSettings();
    if (all.code !== 1) return all;
    const found = (all.data || []).find((s: any) => s.param_key === paramKey);
    return found ? Response.ok(found) : Response.errorNotFound(paramKey);
  }

  async saveSettingByKey(paramKey: string, paramValue: string): Promise<Response> {
    const all = await this.getSettings();
    if (all.code !== 1) return all;
    const settings = all.data || [];
    const idx = settings.findIndex((s: any) => s.param_key === paramKey);
    if (idx >= 0) {
      settings[idx].param_value = paramValue;
      return this.saveSetting(settings);
    }
    settings.push({ param_key: paramKey, param_value: paramValue, id: Date.now() });
    return this.saveSetting(settings);
  }

  // ── 通用通道 ────────────────────────────────────────────

  /**
   * 通用 action 请求（开发态无宿主环境）
   *
   * 菜单注册/注销等操作在开发态无宿主环境，返回空响应不阻塞。
   * 生产环境中由宿主 pluginBridge.ts 处理。
   */
  async request(action: string, payload?: any): Promise<any> {
    // 菜单操作在开发态不可用，返回空响应
    return { code: 0, msg: '当前为开发模式，该操作不可用' };
  }

  async log(level: string, category: string, message: string, details?: any): Promise<void> {
    console.log(`[${level}][${category}] ${message}`, details || '');
  }

  async sendNotification(title: string, body: string, _options?: import('../types').NotificationOptions): Promise<void> {
    console.log(`[Notification] ${title}: ${body}`);
  }

  // ── 生命周期 ────────────────────────────────────────────

  /**
   * 销毁桥接 —— 清除定时器，持久化并关闭数据库
   */
  destroy() {
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.persist();
    if (this.db) this.db.close();
  }
}