import { result, type Result } from '../result';
import { normalizeResult, type BridgeTransport } from '../transport';

interface PendingRequest {
  resolve: (value: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/** Production transport. Plugin identity is derived by the host from MessageEvent.source. */
export class ProductionBridge implements BridgeTransport {
  private requestId = 0;
  private pending = new Map<string, PendingRequest>();

  constructor() {
    window.addEventListener('message', this.handleResponse);
  }

  destroy() {
    window.removeEventListener('message', this.handleResponse);
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
