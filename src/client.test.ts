import { describe, expect, it, vi } from 'vitest';
import { createClient, type ConfirmedMenuSubscription, type MenuSubscription } from './client';

describe('public menu capability', () => {
  it('preserves synchronous menu subscriptions and exposes optional confirmed subscriptions', async () => {
    const calls: Array<[string, unknown]> = [];
    const transport = Object.assign(vi.fn(async <T>(_operation: string, payload?: unknown) => { calls.push([_operation, payload]); return { ok: true as const, value: undefined as T }; }), {
      subscribe: vi.fn((_menuId: string, _listener: (event: unknown) => void) => ({
        ok: true as const,
        value: { token: 't1', unsubscribe: () => ({ ok: true as const, value: undefined }) } satisfies MenuSubscription,
      })),
      unsubscribe: vi.fn(() => ({ ok: true as const, value: undefined })),
      subscribeConfirmed: vi.fn(async (_menuId: string, _listener: (event: unknown) => void) => ({
        ok: true as const,
        value: {
          token: 't2',
          unsubscribe: () => ({ ok: true as const, value: undefined }),
          unsubscribeConfirmed: async () => ({ ok: true as const, value: undefined }),
        } satisfies ConfirmedMenuSubscription,
      })),
      unsubscribeConfirmed: vi.fn(async () => ({ ok: true as const, value: undefined })),
    });
    const client = createClient(transport as any, transport as any);
    await expect(client.menus.register({ menuId: 'm', rootLabel: 'File', items: [] })).resolves.toMatchObject({ ok: true });
    // 轻量勾选更新走 menus.updateChecked operation（建议 3）
    await expect(client.menus.updateChecked('m', 'item-a', true)).resolves.toMatchObject({ ok: true });
    expect(calls).toContainEqual(['menus.updateChecked', { menuId: 'm', itemId: 'item-a', checked: true }]);
    const listener = vi.fn();
    const subscription = client.menus.subscribe('m', listener);
    expect(subscription.ok).toBe(true);
    if (subscription.ok) subscription.value.unsubscribe();
    client.menus.unsubscribe('t1');
    const confirmed = await client.menus.subscribeConfirmed('m', listener);
    if (confirmed.ok) await expect(confirmed.value.unsubscribeConfirmed()).resolves.toMatchObject({ ok: true });
    await expect(client.menus.unsubscribeConfirmed('t2')).resolves.toMatchObject({ ok: true });
    expect(transport.subscribe).toHaveBeenCalledWith('m', listener);
    expect(transport.unsubscribe).toHaveBeenCalledWith('t1');
    expect(transport.unsubscribeConfirmed).toHaveBeenCalledWith('t2');
  });

  it('returns UNSUPPORTED when a host lacks menu subscription capability', async () => {
    const client = createClient(async <T>() => ({ ok: true as const, value: undefined as T }));
    expect(client.menus.subscribe('m', () => undefined)).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
    await expect(client.menus.subscribeConfirmed('m', () => undefined)).resolves.toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
  });
});
