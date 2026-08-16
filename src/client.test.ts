import { describe, expect, it, vi } from 'vitest';
import { createClient } from './client';

describe('createClient', () => {
  it('exposes typed modules without a public generic request method', () => {
    const client = createClient(async () => ({ ok: true, value: [] as never }));
    expect(typeof client.files.openDialog).toBe('function');
    expect(typeof client.files.saveDialog).toBe('function');
    expect(typeof client.directories.list).toBe('function');
    expect(typeof client.storage.write).toBe('function');
    expect(typeof client.database.query).toBe('function');
    expect(typeof client.settings.get).toBe('function');
    expect(typeof client.permissions.grantDirectory).toBe('function');
    expect(typeof client.permissions.verifyDirectoryGrant).toBe('function');
    expect(client.permissions).not.toHaveProperty('getDirectory');
    expect(client.settings).not.toHaveProperty('getStorageDirectory');
    expect(typeof client.menus.register).toBe('function');
    expect(typeof client.notifications.send).toBe('function');
    expect(typeof client.logs.write).toBe('function');
    expect('request' in client).toBe(false);
  });

  it('forwards a typed SQL query through the database capability', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, value: { rows: [{ id: 1 }] } });
    const client = createClient(call);
    await expect(client.database.query({ sql: 'SELECT id FROM notes', tables: ['notes'] })).resolves.toEqual({ ok: true, value: { rows: [{ id: 1 }] } });
    expect(call).toHaveBeenCalledWith('database.query', { sql: 'SELECT id FROM notes', tables: ['notes'] });
  });

  it('routes every capability through its fixed operation name', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const client = createClient(call);
    const directory = { id: 'dir-1', name: '资料', kind: 'directory' as const };
    const file = { id: 'file-1', name: '资料.txt', kind: 'file' as const };
    const statement = { sql: 'UPDATE notes SET title = ?', tables: ['notes'], params: ['新标题'] };
    await Promise.all([
      client.files.openDialog({ kind: 'file' }), client.files.saveDialog({ title: '保存报告', defaultFileName: '报告.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] }), client.files.readFile(file), client.files.writeFile({ directory, fileName: '导出.txt', data: new Uint8Array([1]) }),
      client.directories.list(directory), client.directories.create({ directory, name: '子目录' }), client.directories.remove({ directory, name: '子目录' }),
      client.storage.read('附件/资料.txt'), client.storage.write({ key: '附件/资料.txt', data: new Uint8Array([1]) }), client.storage.remove('附件/资料.txt'),
      client.database.execute(statement), client.database.transaction([statement]),
      client.settings.get('theme'), client.settings.set({ key: 'theme', value: 'dark' }), client.settings.set({ key: 'storage_dir', directory }), client.settings.list(),
      client.permissions.grantDirectory({ permissionKey: 'notes_directory', directory }), client.permissions.verifyDirectoryGrant({ permissionKey: 'notes_directory', accessGrantId: 'grant-1', pathHash: 'abc' }), client.permissions.revokeDirectory('notes_directory'),
      client.menus.register({ menuId: 'export', rootLabel: 'File', items: [{ id: 'export', label: '导出' }] }), client.menus.unregister('export'),
      client.notifications.send({ title: '完成', body: '已导出' }), client.logs.write({ level: 'info', category: 'test', message: 'ok' }),
    ]);
    expect(call.mock.calls.map(([operation]) => operation)).toEqual(expect.arrayContaining([
      'files.openDialog', 'files.saveDialog', 'files.readFile', 'files.writeFile', 'directories.list', 'directories.create', 'directories.remove',
      'storage.read', 'storage.write', 'storage.remove', 'database.execute', 'database.transaction', 'settings.get', 'settings.set', 'settings.list',
      'permissions.grantDirectory', 'permissions.verifyDirectoryGrant', 'permissions.revokeDirectory',
      'menus.register', 'menus.unregister', 'notifications.send', 'logs.write',
    ]));
  });
});
