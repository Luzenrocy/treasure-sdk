import { describe, expect, it } from 'vitest';
import { result } from './result';

describe('result', () => {
  it('creates a successful result', () => {
    expect(result.ok('value')).toEqual({ ok: true, value: 'value' });
  });

  it('creates a structured failure result', () => {
    expect(result.error('CANCELLED', '用户取消')).toEqual({
      ok: false,
      error: { code: 'CANCELLED', message: '用户取消' },
    });
  });

  it('exposes specific authorization and reference failures to plugins', () => {
    expect(result.error('GRANT_NOT_FOUND', '目录授权已失效')).toEqual({
      ok: false,
      error: { code: 'GRANT_NOT_FOUND', message: '目录授权已失效' },
    });
    expect(result.error('REFERENCE_EXPIRED', '文件引用已过期')).toEqual({
      ok: false,
      error: { code: 'REFERENCE_EXPIRED', message: '文件引用已过期' },
    });
  });
});
