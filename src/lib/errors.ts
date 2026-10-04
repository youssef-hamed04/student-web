import type { ApiErrorCode } from '@/types/api';

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  errors?: Record<string, string[]>;
  requestId?: string;

  constructor(params: {
    code: ApiErrorCode;
    status: number;
    message: string;
    errors?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.errors = params.errors;
    this.requestId = params.requestId;
  }
}

export const SESSION_ENDING = new Set<ApiErrorCode>([
  'SESSION_EXPIRED',
  'ACCOUNT_DISABLED',
  'DEVICE_NOT_AUTHORIZED',
  'DEVICE_LIMIT_REACHED',
  'DEVICE_CHANGE_PENDING',
  'DEVICE_INTEGRITY_FAILED',
]);

interface BackendErrorBody {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
  statusCode?: number;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
  requestId?: string;
}

export function toApiError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as BackendErrorBody;
  const code = (b.error?.code ?? b.code ?? 'UNKNOWN') as ApiErrorCode;
  const message = b.error?.message ?? b.message ?? 'Something went wrong';
  const errors = b.error?.fields ?? b.errors;
  const requestId = b.requestId;

  return new ApiError({ code, status, message, errors, requestId });
}

export function networkError(kind: 'offline' | 'timeout' | 'unreachable'): ApiError {
  const code: ApiErrorCode =
    kind === 'offline' ? 'NETWORK_OFFLINE' : kind === 'timeout' ? 'NETWORK_TIMEOUT' : 'SERVER_UNREACHABLE';
  const message =
    kind === 'offline'
      ? 'No internet connection.'
      : kind === 'timeout'
        ? 'The request took too long.'
        : 'Cannot reach the server.';
  return new ApiError({ code, status: 0, message });
}

export function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof Error) {
    return new ApiError({ code: 'UNKNOWN', status: 0, message: e.message });
  }
  return new ApiError({ code: 'UNKNOWN', status: 0, message: String(e) });
}
