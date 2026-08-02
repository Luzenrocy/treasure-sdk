/**
 * 文件系统操作包装器
 *
 * 对 bridge 底层方法的友好封装，统一返回 TreasureResponse 格式。
 * 插件业务代码应优先使用此模块而非直接调用 bridge 方法。
 *
 * @packageDocumentation
 */

import { getTreasure } from './bridge';
import type { TreasureResponse, FileEntry, CreateDirOptions, DeleteDirOptions } from './types';

/**
 * 文件操作工具集
 *
 * 所有方法均返回 TreasureResponse，避免 bridge 底层抛异常。
 * code === 1 时 data 为正常数据，code !== 1 时 msg 包含错误描述。
 *
 * @example
 * ```typescript
 * import { file } from 'treasure-sdk';
 *
 * const res = await file.readFile('/path/to/notes.md');
 * if (res.code === 1) {
 *   console.log(res.data); // 文件内容
 * } else {
 *   console.error(res.msg); // 错误信息
 * }
 * ```
 */
export const file = {
  /** 读取文本文件内容 */
  async readFile(path: string): Promise<TreasureResponse<string>> {
    try {
      const db = getTreasure();
      const data = await db.readFile(path);
      return { code: 1, data };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 列出目录下的文件和子目录 */
  async readDir(path: string): Promise<TreasureResponse<FileEntry[]>> {
    try {
      const db = getTreasure();
      const data = await db.readDir(path);
      return { code: 1, data };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 读取二进制文件（返回 base64 编码字符串） */
  async readBinaryFile(path: string): Promise<TreasureResponse<string>> {
    try {
      const db = getTreasure();
      const data = await db.readBinaryFile(path);
      return { code: 1, data };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 写入二进制文件（content 为 base64 编码） */
  async writeBinaryFile(path: string, base64Content: string): Promise<TreasureResponse<void>> {
    try {
      const db = getTreasure();
      await db.writeBinaryFile(path, base64Content);
      return { code: 1 };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 创建文件（可指定初始内容） */
  async createFile(path: string, content?: string): Promise<TreasureResponse<void>> {
    try {
      const db = getTreasure();
      await db.createFile(path, content);
      return { code: 1 };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 创建目录 */
  async createDir(path: string, options?: CreateDirOptions): Promise<TreasureResponse<void>> {
    try {
      const db = getTreasure();
      await db.createDir(path, options);
      return { code: 1 };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 更新文件内容 */
  async updateFile(path: string, content: string): Promise<TreasureResponse<void>> {
    try {
      const db = getTreasure();
      await db.updateFile(path, content);
      return { code: 1 };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 删除文件 */
  async deleteFile(path: string): Promise<TreasureResponse<void>> {
    try {
      const db = getTreasure();
      await db.deleteFile(path);
      return { code: 1 };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },

  /** 删除目录 */
  async deleteDir(path: string, options?: DeleteDirOptions): Promise<TreasureResponse<void>> {
    try {
      const db = getTreasure();
      await db.deleteDir(path, options);
      return { code: 1 };
    } catch (e: any) {
      return { code: 0, msg: e.message };
    }
  },
};