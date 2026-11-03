import { describe, expect, it } from 'vitest';
import { result } from './result';
import { ProductionBridge } from './bridge-impl/production';

describe('menu listener registry', () => {
  it('returns a local subscription token and rejects duplicate removal', () => {
    const listeners: Array<(event: MessageEvent) => void> = [];
    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      addEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.push(listener),
      removeEventListener: () => undefined,
      parent: { postMessage: () => undefined },
    };
    const bridge = new ProductionBridge();
    const subscription = bridge.subscribe('m', () => undefined);
    expect(subscription.ok).toBe(true);
    if (subscription.ok) {
      expect(subscription.value.unsubscribe()).toEqual(result.ok(undefined));
      expect(subscription.value.unsubscribe()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    }
    bridge.destroy();
    (globalThis as any).window = originalWindow;
  });
});
