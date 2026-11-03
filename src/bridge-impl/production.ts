import { result, type Result } from '../result';
import { normalizeResult, type BridgeTransport } from '../transport';
import type { MenuListener, MenuSubscription, MenuTransport } from '../client';

interface PendingRequest {
  resolve: (value: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/** Production transport. Plugin identity is derived by the host from MessageEvent.source. */
export class ProductionBridge implements BridgeTransport, MenuTransport {
  private requestId = 0;
  private pending = new Map<string, PendingRequest>();
  private menuListeners = new Map<string, { menuId: string; listener: MenuListener }>();
  private menuToken = 0;

  constructor() {
    window.addEventListener('message', this.handleResponse);
    window.addEventListener('message', this.handleMenuEvent);
  }

  destroy() {
    window.removeEventListener('message', this.handleResponse);
    window.removeEventListener('message', this.handleMenuEvent);
    this.menuListeners.clear();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve(result.error('IO_ERROR', '桥接已销毁'));
    }
    this.pending.clear();
  }

  private handleResponse = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type !== 'treasure-db-response') return;
    const pending = this.pending.get(data.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(data.requestId);
    pending.resolve(data.result ?? data);
  };

  private handleMenuEvent = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type !== 'treasure-menu-event' || event.source !== window.parent) return;
    if (typeof data.menuId !== 'string' || typeof data.itemId !== 'string') return;
    for (const entry of this.menuListeners.values()) {
      if (entry.menuId === data.menuId) entry.listener({ menuId: data.menuId, itemId: data.itemId, pluginCode: data.pluginCode });
    }
  };

  subscribe(menuId: string, listener: MenuListener): Result<MenuSubscription> {
    const token = `menu_${++this.menuToken}`;
    this.menuListeners.set(token, { menuId, listener });
    void this.call('menus.subscribe', { menuId, token });
    return result.ok({ token, unsubscribe: () => this.unsubscribe(token) });
  }

  unsubscribe(token: string): Result<void> {
    if (!this.menuListeners.delete(token)) return result.error('NOT_FOUND', '菜单订阅不存在');
    void this.call('menus.unsubscribe', { token });
    return result.ok(undefined);
  }

  private send(operation: string, payload?: unknown, timeoutMs = 10_000): Promise<unknown> {
    return new Promise((resolve) => {
      const requestId = `req_${++this.requestId}`;
      const pending: PendingRequest = { resolve };
      if (timeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.pending.delete(requestId);
          resolve(result.error('IO_ERROR', '请求超时'));
        }, timeoutMs);
      }
      this.pending.set(requestId, pending);
      window.parent.postMessage({ type: 'treasure-db-request', requestId, operation, payload }, '*');
    });
  }

  async call<T>(operation: string, payload?: unknown, timeoutMs?: number): Promise<Result<T>> {
    try {
      return normalizeResult<T>(await this.send(operation, payload, timeoutMs));
    } catch (error: unknown) {
      return result.error('IO_ERROR', error instanceof Error ? error.message : '桥接通信失败');
    }
  }
}
