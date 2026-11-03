import { describe, expect, it, vi } from 'vitest';
import { createClient, type MenuSubscription } from './client';

describe('public menu capability', () => {
  it('exposes register, update, subscribe and unsubscribe without serializing listeners', async () => {
    const calls: Array<[string, unknown]> = [];
    const transport = Object.assign(vi.fn(async <T>(_operation: string, payload?: unknown) => { calls.push([_operation, payload]); return { ok: true as const, value: undefined as T }; }), {
      subscribe: vi.fn((_menuId: string, _listener: (event: unknown) => void) => ({
        ok: true as const,
        value: { token: 't1', unsubscribe: () => ({ ok: true as const, value: undefined }) } satisfies MenuSubscription,
      })),
      unsubscribe: vi.fn(() => ({ ok: true as const, value: undefined })),
    });
    const client = createClient(transport as any, transport as any);
    await expect(client.menus.register({ menuId: 'm', rootLabel: 'File', items: [] })).resolves.toMatchObject({ ok: true });
    await expect(client.menus.update({ menuId: 'm', rootLabel: 'File', items: [] })).resolves.toMatchObject({ ok: true });
    const listener = vi.fn();
    const subscription = client.menus.subscribe('m', listener);
    expect(subscription.ok).toBe(true);
    if (subscription.ok) subscription.value.unsubscribe();
    client.menus.unsubscribe('t1');
    expect(transport.subscribe).toHaveBeenCalledWith('m', listener);
    expect(transport.unsubscribe).toHaveBeenCalledWith('t1');
  });

  it('returns UNSUPPORTED when a host lacks menu subscription capability', () => {
    const client = createClient(async <T>() => ({ ok: true as const, value: undefined as T }));
    expect(client.menus.subscribe('m', () => undefined)).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
  });
});
