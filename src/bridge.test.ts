import { afterEach, describe, expect, it, vi } from 'vitest';
import { result } from './result';
import { ProductionBridge, isKnownRequestType, responseTypeForRequest } from './bridge-impl/production';

interface CapturedMessage {
  type: string;
  requestId: string;
  operation: string;
  payload?: unknown;
}

function installTestWindow() {
  const listeners: Array<(event: MessageEvent) => void> = [];
  const parent = { postMessage: (_message?: unknown) => undefined };
  (globalThis as any).window = {
    addEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.push(listener),
    removeEventListener: () => undefined,
    parent,
  };
  return {
    listeners,
    parent,
    emit(data: Record<string, unknown>, source: unknown = parent) {
      for (const listener of listeners) listener({ data, source } as MessageEvent);
    },
  };
}

const originalWindow = globalThis.window;

afterEach(() => {
  (globalThis as any).window = originalWindow;
});

describe('request type mapping (方案 B: 按能力域拆分消息类型)', () => {
  it('maps every capability to a dedicated request type', () => {
    expect(isKnownRequestType('treasure-file-request')).toBe(true);
    expect(isKnownRequestType('treasure-directory-request')).toBe(true);
    expect(isKnownRequestType('treasure-storage-request')).toBe(true);
    expect(isKnownRequestType('treasure-db-request')).toBe(true);
    expect(isKnownRequestType('treasure-setting-request')).toBe(true);
    expect(isKnownRequestType('treasure-permission-request')).toBe(true);
    expect(isKnownRequestType('treasure-menu-request')).toBe(true);
    expect(isKnownRequestType('treasure-notification-request')).toBe(true);
    expect(isKnownRequestType('treasure-log-request')).toBe(true);
    expect(isKnownRequestType('treasure-menu-requestx')).toBe(false);
    expect(isKnownRequestType('treasure-menu-response')).toBe(false);
    expect(isKnownRequestType('treasure-unknown-request')).toBe(false);
  });

  it('derives the response type from the request type', () => {
    expect(responseTypeForRequest('treasure-menu-request')).toBe('treasure-menu-response');
    expect(responseTypeForRequest('treasure-db-request')).toBe('treasure-db-response');
    expect(responseTypeForRequest('treasure-file-request')).toBe('treasure-file-response');
  });

  it('sends requests through the message envelope matching the capability domain', async () => {
    const sent: CapturedMessage[] = [];
    const { parent, emit } = installTestWindow();
    parent.postMessage = (message?: unknown) => { sent.push(message as CapturedMessage); return undefined; };

    const bridge = new ProductionBridge();
    // timeoutMs = 0 使 pending 请求不设置超时，测试末尾显式模拟响应完成。
    const calls = [
      bridge.call('menus.register', { menuId: 'm', items: [] }, 0),
      bridge.call('files.openDialog', { kind: 'file' }, 0),
      bridge.call('database.query', { sql: 'SELECT 1' }, 0),
      bridge.call('logs.write', { message: 'x' }, 0),
    ];
    await Promise.resolve();
    expect(sent.map((message) => message.type)).toEqual([
      'treasure-menu-request',
      'treasure-file-request',
      'treasure-db-request',
      'treasure-log-request',
    ]);
    // 模拟宿主按域响应，释放 pending promise，避免测试悬挂。
    for (const message of sent) {
      emit({ type: message.type.replace(/-request$/, '-response'), requestId: message.requestId, result: { ok: true, value: undefined } }, parent);
    }
    await Promise.all(calls);
    bridge.destroy();
  });

  it('resolves only the response whose type matches the request capability', async () => {
    const { parent, emit } = installTestWindow();
    const sent: CapturedMessage[] = [];
    parent.postMessage = (message?: unknown) => { sent.push(message as CapturedMessage); return undefined; };

    const bridge = new ProductionBridge();
    const pending = bridge.call('menus.register', { menuId: 'm', items: [] }, 0);
    let settled = false;
    void pending.then(() => { settled = true; });

    const request = sent[0];
    // 错域响应：请求是 menus.register，响应若为 treasure-file-response 不应被消费。
    emit({ type: 'treasure-file-response', requestId: request.requestId, result: { ok: true, value: 'wrong' } }, parent);
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    // 正确域响应：treasure-menu-response 才被消费。
    emit({ type: 'treasure-menu-response', requestId: request.requestId, result: { ok: true, value: 'ok' } }, parent);
    await expect(pending).resolves.toMatchObject({ ok: true, value: 'ok' });
    bridge.destroy();
  });
});

describe('response forgery protection (已知契约缺口修复)', () => {
  it('ignores responses whose source is not the parent window', async () => {
    const { parent, emit } = installTestWindow();
    const sent: CapturedMessage[] = [];
    parent.postMessage = (message?: unknown) => { sent.push(message as CapturedMessage); return undefined; };

    const bridge = new ProductionBridge();
    const pending = bridge.call('settings.get', { key: 'k' }, 0);
    let settled = false;
    void pending.then(() => { settled = true; });

    const request = sent[0];
    emit({ type: 'treasure-setting-response', requestId: request.requestId, result: { ok: true, value: 'forged' } }, { postMessage: () => undefined });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    emit({ type: 'treasure-setting-response', requestId: request.requestId, result: { ok: true, value: 'real' } }, parent);
    await expect(pending).resolves.toMatchObject({ ok: true, value: 'real' });
    bridge.destroy();
  });
});

describe('menu listener registry', () => {
  it('returns a confirmed subscription only after the host acknowledges it', async () => {
    const { parent, emit } = installTestWindow();
    const sent: CapturedMessage[] = [];
    parent.postMessage = (message?: unknown) => { sent.push(message as CapturedMessage); return undefined; };
    const bridge = new ProductionBridge();
    const pending = bridge.subscribeConfirmed('m', () => undefined);
    await Promise.resolve();
    const subscribe = sent[0];
    emit({ type: 'treasure-menu-response', requestId: subscribe.requestId, result: { ok: true, value: undefined } }, parent);
    const subscription = await pending;
    expect(subscription.ok).toBe(true);
    if (subscription.ok) {
      const pendingUnsubscribe = subscription.value.unsubscribeConfirmed();
      await Promise.resolve();
      const unsubscribe = sent[1];
      emit({ type: 'treasure-menu-response', requestId: unsubscribe.requestId, result: { ok: true, value: undefined } }, parent);
      await expect(pendingUnsubscribe).resolves.toEqual(result.ok(undefined));
      expect(subscription.value.unsubscribe()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    }
    bridge.destroy();
  });

  it('forwards treasure-menu-event clicks to confirmed local listeners only from the parent', async () => {
    const { parent, emit } = installTestWindow();
    const sent: CapturedMessage[] = [];
    parent.postMessage = (message?: unknown) => { sent.push(message as CapturedMessage); return undefined; };
    const bridge = new ProductionBridge();
    const listener = vi.fn();
    const pending = bridge.subscribeConfirmed('shiyulu-view', listener);
    await Promise.resolve();
    emit({ type: 'treasure-menu-response', requestId: sent[0].requestId, result: { ok: true, value: undefined } }, parent);
    await pending;

    emit({ type: 'treasure-menu-event', menuId: 'shiyulu-view', itemId: 'editOnly', pluginCode: 'shiyulu' }, parent);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ menuId: 'shiyulu-view', itemId: 'editOnly', pluginCode: 'shiyulu' });

    // 非父窗口来源的菜单事件被拒绝（与响应防伪一致）。
    emit({ type: 'treasure-menu-event', menuId: 'shiyulu-view', itemId: 'previewOnly', pluginCode: 'shiyulu' }, { postMessage: () => undefined });
    expect(listener).toHaveBeenCalledTimes(1);
    bridge.destroy();
  });

  it('does not retain a listener when the host rejects its subscription', async () => {
    const { parent, emit } = installTestWindow();
    const sent: CapturedMessage[] = [];
    parent.postMessage = (message?: unknown) => { sent.push(message as CapturedMessage); return undefined; };
    const bridge = new ProductionBridge();
    const listener = vi.fn();
    const pending = bridge.subscribeConfirmed('shiyulu-view', listener);
    await Promise.resolve();
    emit({ type: 'treasure-menu-response', requestId: sent[0].requestId, result: { ok: false, error: { code: 'PERMISSION_DENIED', message: 'denied' } } }, parent);
    await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });

    emit({ type: 'treasure-menu-event', menuId: 'shiyulu-view', itemId: 'editOnly', pluginCode: 'shiyulu' }, parent);
    expect(listener).not.toHaveBeenCalled();
    bridge.destroy();
  });
});
