/**
 * treasure-sdk — Treasure 插件 SDK
 *
 * 2.0 只公开类型化能力模块和 Result<T>；路径、Base64 和 request(action) 不再公开。
 */

export { initTreasure, getTreasure, destroyTreasure } from './bridge';
export { files } from './files';
export { storage } from './storage';
export { result } from './result';
export type { Result, ResultErrorCode } from './result';
export type { FileReference, DirectoryReference, OpenDialogOptions, SaveDialogOptions, WriteFileInput } from './files';
export { createClient } from './client';
export type { TreasureClient, SqlStatement, DirectoryEntry, Setting, GrantDirectoryInput, MenuItem, MenuRegistration, LogLevel } from './client';
import { getTreasure as client } from './bridge';

/** Stable capability exports for code that prefers module-style imports. */
export const directories = {
  list: (directory: import('./files').DirectoryReference) => client().directories.list(directory),
  create: (input: { directory: import('./files').DirectoryReference; name: string }) => client().directories.create(input),
  remove: (input: { directory: import('./files').DirectoryReference; name?: string }) => client().directories.remove(input),
};
export const database = {
  query: <T>(statement: import('./client').SqlStatement) => client().database.query<T>(statement),
  execute: <T>(statement: import('./client').SqlStatement) => client().database.execute<T>(statement),
  transaction: (statements: import('./client').SqlStatement[]) => client().database.transaction(statements),
};
export const settings = {
  get: (key: string) => client().settings.get(key), set: (setting: import('./client').Setting) => client().settings.set(setting), list: () => client().settings.list(),
};
export const permissions = {
  grantDirectory: (input: import('./client').GrantDirectoryInput) => client().permissions.grantDirectory(input),
  getDirectory: (permissionKey: string) => client().permissions.getDirectory(permissionKey),
  revokeDirectory: (permissionKey: string) => client().permissions.revokeDirectory(permissionKey),
};
export const menus = {
  register: (registration: import('./client').MenuRegistration) => client().menus.register(registration), unregister: (id: string) => client().menus.unregister(id),
};
export const notifications = { send: (input: { title: string; body: string }) => client().notifications.send(input) };
export const logs = { write: (input: { level: import('./client').LogLevel; category: string; message: string; details?: unknown }) => client().logs.write(input) };
