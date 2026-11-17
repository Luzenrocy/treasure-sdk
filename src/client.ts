import type { Result } from './result';
import type { DirectoryReference, FileReference, OpenDialogOptions, SaveDialogOptions, WriteFileInput } from './files';

export type SqlStatement = { sql: string; tables: string[]; params?: unknown[] };
export type Transport = <T>(operation: string, payload?: unknown) => Promise<Result<T>>;

export interface DirectoryEntry {
  name: string;
  kind: 'file' | 'directory';
  file?: FileReference;
  directory?: DirectoryReference;
}

export interface PlainSetting {
  key: string;
  value: string;
  paramType?: never;
}

export interface DirectorySetting {
  key: string;
  paramType: 'dir';
  accessGrantId: string | null;
  pathHash: string | null;
  directoryName: string | null;
}

export type Setting = PlainSetting | DirectorySetting;
export type SetSettingInput = PlainSetting | { key: string; directory: DirectoryReference };

/** A stable, plugin-defined name for one durable directory permission. */
export interface GrantDirectoryInput {
  permissionKey: string;
  directory: DirectoryReference;
}

/** Persistent authorization identity plus a newly issued session reference. */
export interface DirectoryGrant {
  accessGrantId: string;
  directory: DirectoryReference;
}

export interface VerifyDirectoryGrantInput {
  permissionKey: string;
  accessGrantId: string;
  pathHash: string;
}

export interface MenuItem {
  id: string;
  label: string;
  enabled?: boolean;
}
export interface MenuRegistration {
  menuId: string;
  rootLabel: string;
  submenuLabel?: string;
  /** type: 'check' 为带勾选框菜单项，'normal' 为普通项，'separator' 为分隔线（宿主均支持）。 */
  items: Array<MenuItem & { type?: 'normal' | 'check' | 'separator'; checked?: boolean }>;
}
export interface MenuClickEvent { menuId: string; itemId: string; pluginCode?: string }
/** A local subscription handle. `subscribe` remains synchronous for 2.x compatibility. */
export interface MenuSubscription { token: string; unsubscribe: () => Result<void> }
export type MenuListener = (event: MenuClickEvent) => void;
export interface MenuTransport {
  subscribe: (menuId: string, listener: MenuListener) => Result<MenuSubscription>;
  unsubscribe: (token: string) => Result<void>;
  /** Optional additive API for callers that require a host acknowledgement. */
  subscribeConfirmed?: (menuId: string, listener: MenuListener) => Promise<Result<MenuSubscription>>;
  unsubscribeConfirmed?: (token: string) => Promise<Result<void>>;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Document rendering is performed in a host-owned isolated Webview. */

/** Typed public SDK surface. Transport operation names are protocol internals. */
export function createClient(transport: Transport, menuTransport?: MenuTransport) {
  return {
    files: {
      openDialog: (options: OpenDialogOptions) => transport<FileReference[] | DirectoryReference>('files.openDialog', options),
      saveDialog: (options: SaveDialogOptions) => transport<FileReference>('files.saveDialog', options),
      readFile: (file: FileReference) => transport<Uint8Array>('files.readFile', { file }),
      writeFile: (input: WriteFileInput) => transport<FileReference>('files.writeFile', input),
    },
    directories: {
      list: (directory: DirectoryReference) => transport<DirectoryEntry[]>('directories.list', { directory }),
      create: (input: { directory: DirectoryReference; name: string }) => transport<DirectoryReference>('directories.create', input),
      remove: (input: { directory: DirectoryReference; name?: string }) => transport<void>('directories.remove', input),
    },
    storage: {
      read: (key: string) => transport<Uint8Array>('storage.read', { key }),
      write: (input: { key: string; data: Uint8Array }) => transport<void>('storage.write', input),
      remove: (key: string) => transport<void>('storage.remove', { key }),
    },
    database: {
      query: <T>(statement: SqlStatement) => transport<{ rows: T[] }>('database.query', statement),
      execute: <T>(statement: SqlStatement) => transport<{ affectedRows: number; lastInsertId?: number; rows?: T[] }>('database.execute', statement),
      transaction: (statements: SqlStatement[]) => transport<Array<{ affectedRows: number; lastInsertId?: number }>>('database.transaction', { statements }),
    },
    settings: {
      get: (key: string) => transport<Setting>('settings.get', { key }),
      set: (setting: SetSettingInput) => transport<void>('settings.set', setting),
      list: () => transport<Setting[]>('settings.list'),
    },
    permissions: {
      grantDirectory: (input: GrantDirectoryInput) => transport<DirectoryGrant>('permissions.grantDirectory', input),
      verifyDirectoryGrant: (input: VerifyDirectoryGrantInput) => transport<DirectoryGrant>('permissions.verifyDirectoryGrant', input),
      revokeDirectory: (permissionKey: string) => transport<void>('permissions.revokeDirectory', { permissionKey }),
    },
    menus: {
      register: (registration: MenuRegistration) => transport<void>('menus.register', registration),
      /** 与 register 语义一致（重复注册同一 menuId 即覆盖更新），保留为兼容别名。 */
      update: (registration: MenuRegistration) => transport<void>('menus.update', registration),
      /**
       * 轻量路径：只更新指定菜单项的勾选状态，不触发整窗菜单重建。
       * 优先于"重新 register 全量菜单"用于动态勾选同步。
       */
      updateChecked: (menuId: string, itemId: string, checked: boolean) => transport<void>('menus.updateChecked', { menuId, itemId, checked }),
      subscribe: (menuId: string, listener: MenuListener): Result<MenuSubscription> => menuTransport?.subscribe(menuId, listener) ?? { ok: false, error: { code: 'UNSUPPORTED', message: '菜单订阅能力不可用' } },
      unsubscribe: (token: string): Result<void> => menuTransport?.unsubscribe(token) ?? { ok: false, error: { code: 'UNSUPPORTED', message: '菜单订阅能力不可用' } },
      subscribeConfirmed: (menuId: string, listener: MenuListener): Promise<Result<MenuSubscription>> => menuTransport?.subscribeConfirmed?.(menuId, listener) ?? Promise.resolve({ ok: false, error: { code: 'UNSUPPORTED', message: '菜单确认订阅能力不可用' } }),
      unsubscribeConfirmed: (token: string): Promise<Result<void>> => menuTransport?.unsubscribeConfirmed?.(token) ?? Promise.resolve({ ok: false, error: { code: 'UNSUPPORTED', message: '菜单确认取消订阅能力不可用' } }),
      unregister: (id: string) => transport<void>('menus.unregister', { id }),
    },
    notifications: {
      send: (input: { title: string; body: string }) => transport<void>('notifications.send', input),
    },
    logs: {
      write: (input: { level: LogLevel; category: string; message: string; details?: unknown }) => transport<void>('logs.write', input),
    },
  };
}

export type TreasureClient = ReturnType<typeof createClient>;
