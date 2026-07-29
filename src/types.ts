/**
 * Treasure 插件 SDK — 核心类型定义
 *
 * 本文件定义了插件与宿主之间的完整通信协议。
 * 宿主端（pluginBridge.ts）的 switch-case 与这里的 action 一一对应。
 *
 * @packageDocumentation
 */

// ============================================================
// 基础响应类型
// ============================================================

/**
 * 标准响应体 —— 所有 SDK 方法的统一返回值
 *
 * @typeParam T - data 字段的具体类型
 *
 * @example
 * ```typescript
 * // 成功响应
 * { code: 1, data: [{ id: 1, title: 'hello' }] }
 * // 错误响应
 * { code: 0, msg: '文件不存在' }
 * ```
 */
export interface TreasureResponse<T = unknown> {
  /** 状态码：1=成功, 0=错误 */
  code: number;
  /** 错误消息（code !== 1 时存在） */
  msg?: string;
  /** 响应数据（code === 1 时存在） */
  data?: T;
}

// ============================================================
// 文件系统类型
// ============================================================

/** 目录条目 */
export interface FileEntry {
  name: string;        // 文件名（不含路径）
  path: string;        // 完整路径
  isDirectory: boolean;
  isFile: boolean;
}

/** 创建目录选项 */
export interface CreateDirOptions {
  /** 是否递归创建父目录，默认 true */
  recursive?: boolean;
}

/** 删除目录选项 */
export interface DeleteDirOptions {
  /** 是否递归删除子文件/子目录，默认 true */
  recursive?: boolean;
}

/** 保存文件对话框选项 */
export interface SaveDialogOptions {
  /** 默认文件名（如 "output.md"） */
  defaultPath?: string;
  /** 文件类型过滤器 */
  filters?: { name: string; extensions: string[] }[];
}

// ============================================================
// 数据表定义类型（manifest.json 声明用）
// ============================================================

/** 表列定义 */
export interface TableColumn {
  name: string;
  type: string;
  comment?: string;
  options?: { primaryKey?: boolean; notNull?: boolean; default?: string; unique?: boolean };
}

/** 表定义 */
export interface TableDef {
  name: string;
  columns: TableColumn[];
  comment?: string;
}

// ============================================================
// 通知类型
// ============================================================

/** 通知选项 */
export interface NotificationOptions {
  /** 通知声音 */
  sound?: string;
  /** 附加负载（任意可 JSON 序列化的数据） */
  payload?: any;
}

// ============================================================
// 桥接接口 —— 插件与宿主通信的核心契约
// ============================================================

/**
 * Treasure 宿主桥接接口 —— 插件通过此接口访问宿主能力
 *
 * 所有方法均返回 Promise。生产环境通过 postMessage 与宿主通信，
 * 开发环境使用 localStorage + sql.js 模拟。
 */
export interface TreasureBridge {
  // ── SQL 数据库操作 ──────────────────────────────────────

  /**
   * 查询数据（SELECT）
   *
   * @param sql      SQL 语句（使用裸表名，宿主自动添加 plugin_{code}_ 前缀）
   * @param tables   声明的表名列表（宿主根据此列表验证 SQL 安全性和重写表名）
   * @param params   SQL 参数（? 占位符）
   *
   * @example
   * ```typescript
   * const res = await bridge.query(
   *   'SELECT * FROM notes WHERE status = ?',
   *   ['notes'],
   *   ['active']
   * );
   * ```
   */
  query<T = any>(sql: string, tables: string[], params?: any[]): Promise<Response>;

  /**
   * 执行写操作（INSERT / UPDATE / DELETE）
   *
   * @param sql      SQL 语句（使用裸表名）
   * @param tables   声明的表名列表
   * @param params   SQL 参数
   */
  execute(sql: string, tables: string[], params?: any[]): Promise<Response>;

  /**
   * 事务执行（多条 SQL 原子提交）
   *
   * @param ops  事务操作列表，每条需包含 sql 和声明的 tables
   */
  transaction(ops: { sql: string; tables: string[]; params?: any[] }[]): Promise<Response>;

  // ── 文件系统操作 ────────────────────────────────────────

  /** 读取文本文件 */
  readFile(path: string): Promise<string>;
  /** 读取二进制文件（返回 base64 编码字符串） */
  readBinaryFile(path: string): Promise<string>;
  /** 列出目录内容 */
  readDir(path: string): Promise<Array<FileEntry>>;
  /** 写入文本文件（覆盖） */
  writeFile(path: string, content: string): Promise<void>;
  /** 写入二进制文件（content 为 base64 编码） */
  writeBinaryFile(path: string, base64Content: string): Promise<void>;
  /** 创建目录（别名，同 createDir） */
  mkdir(path: string): Promise<void>;
  /** 删除文件 */
  deleteFile(path: string): Promise<void>;
  /** 创建文件 */
  createFile(path: string, content?: string): Promise<void>;
  /** 创建目录 */
  createDir(path: string, options?: CreateDirOptions): Promise<void>;
  /** 更新文件内容 */
  updateFile(path: string, content: string): Promise<void>;
  /** 删除目录 */
  deleteDir(path: string, options?: DeleteDirOptions): Promise<void>;

  // ── 系统对话框 ──────────────────────────────────────────

  /** 打开目录选择对话框 */
  selectDirectory(title: string): Promise<string | null>;
  /**
   * 打开文件保存对话框
   *
   * @note 旧版宿主可能不支持此方法，调用前请判断 `bridge.saveDialog` 是否存在
   */
  saveDialog?(options: SaveDialogOptions): Promise<string | null>;

  // ── 系统通知 ────────────────────────────────────────────

  /**
   * 发送系统通知
   *
   * @param title   通知标题
   * @param body    通知内容
   * @param options 通知选项
   */
  sendNotification?(title: string, body: string, options?: NotificationOptions): Promise<void>;

  // ── 配置管理 ────────────────────────────────────────────

  /** 获取当前插件的全部配置 */
  getSettings(): Promise<Response>;
  /** 保存当前插件的全部配置 */
  saveSetting(settings: any[]): Promise<Response>;
  /** 按 param_key 获取单个配置（宿主可选实现） */
  getSettingByKey?(paramKey: string): Promise<Response>;
  /** 按 param_key 保存单个配置（宿主可选实现） */
  saveSettingByKey?(paramKey: string, paramValue: string): Promise<Response>;

  // ── 通用通道 ——————————————————————————————————————————
  // 以下方法通过通用 action 机制扩展，宿主 pluginBridge.ts 按 action 字符串分发

  /**
   * 通用 action 请求通道
   *
   * 用于菜单注册/注销、状态同步等非标准操作。
   * action 字符串直接对应宿主 pluginBridge.ts 的 switch-case。
   *
   * @param action  操作名称（如 'registerMenu', 'unregisterMenu'）
   * @param payload 操作参数
   */
  request?(action: string, payload?: any): Promise<any>;

  /**
   * 写结构化日志
   * @param level 日志级别：trace | debug | info | warn | error
   * @param category 日志分类：db | biz | sys | bridge
   * @param message 日志消息
   * @param details 附加详情（任意可 JSON 序列化的对象）
   */
  log?(level: 'trace' | 'debug' | 'info' | 'warn' | 'error', category: 'db' | 'biz' | 'sys' | 'bridge', message: string, details?: any): Promise<void>;
}

// ============================================================
// Response 工具类
// ============================================================

/**
 * 统一响应类 —— 带静态工厂方法
 *
 * 插件和宿主两端共享此工具类，确保响应格式一致。
 *
 * code 约定：
 *   1  = 成功
 *   0  = 通用错误
 *  -1  = 参数错误
 *  -2  = 权限错误
 *  -3  = 未找到
 */
export class Response {
  code: number;
  msg: string;
  data: any;

  static ok(data: any) { return new Response({ code: 1, data }); }
  static okMsg(msg: string) { return new Response({ code: 1, msg }); }
  static error(msg: string) { return new Response({ code: 0, msg }); }
  static errorParam(msg: string) { return new Response({ code: -1, msg }); }
  static errorPermission(msg: string) { return new Response({ code: -2, msg }); }
  static errorNotFound(msg: string) { return new Response({ code: -3, msg }); }

  constructor(source: any = {}) {
    if ('string' === typeof source) source = JSON.parse(source);
    this.code = source["code"];
    this.msg = source["msg"];
    this.data = source["data"];
  }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 从 DOM 中读取插件编码
 *
 * 插件编码在 index.html 的 <meta name="treasure-plugin-code"> 中声明，
 * 详见 SDK-PLUGIN.md 1.3 节。
 */
export function getPluginCode(): string {
  const meta = document.querySelector('meta[name="treasure-plugin-code"]');
  return meta?.getAttribute('content') || 'unknown';
}