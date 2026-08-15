export type ResultErrorCode =
  | 'CANCELLED'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'GRANT_NOT_FOUND'
  | 'REFERENCE_EXPIRED'
  | 'INVALID_FILE_NAME'
  | 'VALIDATION_FAILED'
  | 'FILE_TOO_LARGE'
  | 'IO_ERROR'
  | 'CONFLICT'
  | 'UNSUPPORTED'
  | 'INTERNAL';

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ResultErrorCode; message: string } };

export const result = {
  ok<T>(value: T): Result<T> {
    return { ok: true, value };
  },

  error<T = never>(code: ResultErrorCode, message: string): Result<T> {
    return { ok: false, error: { code, message } };
  },
};
