import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: MessageEvent) => void;
let listeners: Listener[];
let postMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  listeners = [];
  postMessage = vi.fn();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      parent: { postMessage },
      addEventListener: vi.fn((_type: string, listener: Listener) => listeners.push(listener)),
      removeEventListener: vi.fn((_type: string, listener: Listener) => { listeners = listeners.filter(current => current !== listener); }),
    },
  });
});

afterEach(() => { delete (globalThis as { window?: unknown }).window; });

describe('ProductionBridge', () => {
  it('keeps native system dialogs pending until the user confirms or cancels', async () => {
    const { ProductionBridge } = await import('./production');
    const bridge = new ProductionBridge();
    const pending = bridge.call('files.saveDialog', { defaultFileName: '报告.pdf' }, 0);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ operation: 'files.saveDialog' }), '*');
    const requestId = postMessage.mock.calls[0]![0].requestId;
    listeners.forEach(listener => listener({ data: { type: 'treasure-db-response', requestId, result: { ok: true, value: { id: 'file-1' } } } } as MessageEvent));
    await expect(pending).resolves.toEqual({ ok: true, value: { id: 'file-1' } });
    bridge.destroy();
  });
  it('sends a typed operation without a caller-controlled plugin identity', async () => {
    const { ProductionBridge } = await import('./production');
    const bridge = new ProductionBridge();
    const pending = bridge.call<{ rows: Array<{ id: number }> }>('database.query', { sql: 'SELECT id FROM notes', tables: ['notes'] }, 0);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'treasure-db-request', operation: 'database.query', payload: { sql: 'SELECT id FROM notes', tables: ['notes'] },
    }), '*');
    expect(postMessage.mock.calls[0]![0]).not.toHaveProperty('pluginCode');
    const requestId = postMessage.mock.calls[0]![0].requestId;
    listeners.forEach(listener => listener({ data: { type: 'treasure-db-response', requestId, result: { ok: true, value: { rows: [{ id: 1 }] } } } } as MessageEvent));
    await expect(pending).resolves.toEqual({ ok: true, value: { rows: [{ id: 1 }] } });
    bridge.destroy();
  });

  it('settles outstanding calls with a Result error when destroyed', async () => {
    const { ProductionBridge } = await import('./production');
    const bridge = new ProductionBridge();
    const pending = bridge.call('storage.read', { key: 'cache/a' }, 0);
    bridge.destroy();
    await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'IO_ERROR' } });
  });

  it('ignores unrelated responses and normalizes a postMessage failure', async () => {
    postMessage.mockImplementation(() => { throw new Error('parent unavailable'); });
    const { ProductionBridge } = await import('./production');
    const bridge = new ProductionBridge();
    listeners.forEach(listener => listener({ data: { type: 'other' } } as MessageEvent));
    await expect(bridge.call('settings.list', undefined, 0)).resolves.toMatchObject({
      ok: false, error: { code: 'IO_ERROR', message: 'parent unavailable' },
    });
    bridge.destroy();
  });

  it('does not settle a request for another requestId', async () => {
    const { ProductionBridge } = await import('./production');
    const bridge = new ProductionBridge();
    const pending = bridge.call('settings.list', undefined, 0);
    listeners.forEach(listener => listener({ data: { type: 'treasure-db-response', requestId: 'another-request', result: { ok: true, value: [] } } } as MessageEvent));
    bridge.destroy();
    await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'IO_ERROR' } });
  });

  it('returns a Result timeout when the host does not answer', async () => {
    vi.useFakeTimers();
    try {
      const { ProductionBridge } = await import('./production');
      const bridge = new ProductionBridge();
      const pending = bridge.call('settings.list', undefined, 10);
      await vi.advanceTimersByTimeAsync(10);
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'IO_ERROR', message: '请求超时' } });
      bridge.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
