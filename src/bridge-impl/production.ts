import { result, type Result } from '../result';
import { normalizeResult, type BridgeTransport } from '../transport';
import type { MenuListener, MenuSubscription, MenuTransport } from '../client';

/**
 * 能力域 → 请求消息类型映射（方案 B：按能力域拆分消息类型）。
 *
 * 与宿主 `treasure/src/bridge/pluginBridge.ts` 中的映射保持一致：
 * 插件请求发送到 `treasure-{domain}-request` 信封，宿主按 type 分发，
 * 并以 `treasure-{domain}-response` 响应。`database` 域沿用历史名称
 * `treasure-db-request/-response`。
 */
export const REQUEST_TYPE_BY_CAPABILITY: Record<string, string> = {
  files: 'treasure-file-request',
  directories: 'treasure-directory-request',
  storage: 'treasure-storage-request',
  database: 'treasure-db-request',
  settings: 'treasure-setting-request',
  permissions: 'treasure-permission-request',
  menus: 'treasure-menu-request',
  notifications: 'treasure-notification-request',
  logs: 'treasure-log-request',
};

const REQUEST_TYPES = new Set(Object.values(REQUEST_TYPE_BY_CAPABILITY));

/** 请求类型 → 对应响应类型，如 `treasure-menu-request` → `treasure-menu-response`。 */
export function responseTypeForRequest(requestType: string): string {
  return requestType.replace(/-request$/, '-response');
}

function requestTypeForOperation(operation: string): string {
  const domain = operation.split('.')[0];
  return REQUEST_TYPE_BY_CAPABILITY[domain] ?? 'treasure-db-request';
}

/** 解析父窗口 origin；解析失败（如 plugin:// 自定义协议）时返回 null。 */
function resolveParentOrigin(): string | null {
  try {
    const referrer = document.referrer;
    if (!referrer) return null;
    return new URL(referrer).origin;
  } catch {
    return null;
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
  responseType: string;
}

/** Production transport. Plugin identity is derived by the host from MessageEvent.source. */
export class ProductionBridge implements BridgeTransport, MenuTransport {
  private requestId = 0;
  private pending = new Map<string, PendingRequest>();
  private menuListeners = new Map<string, { menuId: string; listener: MenuListener }>();
  private menuToken = 0;
  private readonly parentOrigin: string | null;

  constructor() {
    // 已知缺口修复：初始化时确定父窗口 origin；无法解析时回退 '*'，
    // 交由 handleResponse/handleMenuEvent 的 `event.source === window.parent` 校验兜底。
    this.parentOrigin = resolveParentOrigin();
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
    if (event.source !== window.parent) return;
    // 已知缺口修复（origin 二次校验）：能解析父窗口 origin 时，拒绝非父 origin 的伪造响应。
    if (this.parentOrigin && event.origin !== this.parentOrigin) return;
    if (!data || typeof data.type !== 'string' || !data.type.endsWith('-response')) return;
    const pending = this.pending.get(data.requestId);
    if (!pending) return;
    // 只有与请求能力域匹配的响应类型才会被消费，避免跨域响应错配。
    if (data.type !== pending.responseType) return;
    clearTimeout(pending.timer);
    this.pending.delete(data.requestId);
    pending.resolve(data.result ?? data);
  };

  private handleMenuEvent = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type !== 'treasure-menu-event' || event.source !== window.parent) return;
    // 已知缺口修复（origin 二次校验）：能解析父窗口 origin 时，拒绝非父 origin 的伪造菜单事件。
    if (this.parentOrigin && event.origin !== this.parentOrigin) return;
    if (typeof data.menuId !== 'string' || typeof data.itemId !== 'string') return;
    for (const entry of this.menuListeners.values()) {
      if (entry.menuId === data.menuId) entry.listener({ menuId: data.menuId, itemId: data.itemId, pluginCode: data.pluginCode });
    }
  };

  subscribe(menuId: string, listener: MenuListener): Result<MenuSubscription> {
    const token = `menu_${++this.menuToken}`;
    this.menuListeners.set(token, { menuId, listener });
    // Keep the original 2.x contract: registration is local and returns at once.
    // Callers that need an acknowledgement can use subscribeConfirmed instead.
    void this.call('menus.subscribe', { menuId, token });
    return result.ok({ token, unsubscribe: () => this.unsubscribe(token) });
  }

  unsubscribe(token: string): Result<void> {
    if (!this.menuListeners.delete(token)) return result.error('NOT_FOUND', '菜单订阅不存在');
    void this.call('menus.unsubscribe', { token });
    return result.ok(undefined);
  }

  async subscribeConfirmed(menuId: string, listener: MenuListener): Promise<Result<MenuSubscription>> {
    const token = `menu_${++this.menuToken}`;
    const subscribed = await this.call<void>('menus.subscribe', { menuId, token });
    if (!subscribed.ok) return subscribed;
    this.menuListeners.set(token, { menuId, listener });
    return result.ok({ token, unsubscribe: () => this.unsubscribe(token) });
  }

  async unsubscribeConfirmed(token: string): Promise<Result<void>> {
    if (!this.menuListeners.has(token)) return result.error('NOT_FOUND', '菜单订阅不存在');
    const unsubscribed = await this.call<void>('menus.unsubscribe', { token });
    if (!unsubscribed.ok) return unsubscribed;
    this.menuListeners.delete(token);
    return result.ok(undefined);
  }

  private send(operation: string, payload?: unknown, timeoutMs = 10_000): Promise<unknown> {
    return new Promise((resolve) => {
      const requestId = `req_${++this.requestId}`;
      const requestType = requestTypeForOperation(operation);
      const responseType = responseTypeForRequest(requestType);
      const pending: PendingRequest = { resolve, responseType };
      if (timeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.pending.delete(requestId);
          resolve(result.error('IO_ERROR', '请求超时'));
        }, timeoutMs);
      }
      this.pending.set(requestId, pending);
      // 已知缺口修复：targetOrigin 优先使用解析到的父窗口 origin，失败回退 '*'。
      window.parent.postMessage({ type: requestType, requestId, operation, payload }, this.parentOrigin ?? '*');
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

/** 供契约测试与工具使用：判断某消息类型是否属于已知的能力域请求信封。 */
export function isKnownRequestType(type: unknown): type is string {
  return typeof type === 'string' && REQUEST_TYPES.has(type);
}
