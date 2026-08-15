import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('initTreasure', () => {
  const localStorage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };

  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        parent: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    window.parent = window;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { querySelector: vi.fn(() => null) },
    });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('never creates browser simulation storage when the plugin is opened outside Treasure', async () => {
    const { initTreasure, destroyTreasure } = await import('./bridge');

    const client = initTreasure();
    await client.settings.list();

    expect(client).toBeDefined();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    destroyTreasure();
  });
});
