import { result, type Result } from './result';

/** Internal bridge boundary. It is intentionally not exported from the SDK entrypoint. */
export interface BridgeTransport {
  call<T>(operation: string, payload?: unknown, timeoutMs?: number): Promise<Result<T>>;
  destroy?(): void;
}

export function normalizeResult<T>(value: unknown): Result<T> {
  if (typeof value === 'object' && value !== null && 'ok' in value) return value as Result<T>;
  return result.error('INTERNAL', '宿主返回了无效响应');
}
