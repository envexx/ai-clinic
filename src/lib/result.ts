/**
 * Domain result envelope shared by every API route and domain service.
 * See PRD section 16 for the contract and the accepted error codes.
 */

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "SLOT_UNAVAILABLE",
  "ACTION_EXPIRED",
  "VERSION_CONFLICT",
  "POLICY_REQUIRES_STAFF",
  "SERVICE_UNAVAILABLE",
  "RATE_LIMITED",
  "UNKNOWN_COMMIT_STATUS",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type Ok<T> = {
  success: true;
  code: null;
  requestId: string;
  data: T;
  retryable: false;
};

export type Err = {
  success: false;
  code: ErrorCode;
  requestId: string;
  message: string;
  retryable: boolean;
};

export type DomainResult<T> = Ok<T> | Err;

export function ok<T>(requestId: string, data: T): Ok<T> {
  return { success: true, code: null, requestId, data, retryable: false };
}

export function err(
  requestId: string,
  code: ErrorCode,
  message: string,
  retryable = false,
): Err {
  return { success: false, code, requestId, message, retryable };
}

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  ACTION_EXPIRED: 409,
  VERSION_CONFLICT: 409,
  POLICY_REQUIRES_STAFF: 409,
  SERVICE_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  UNKNOWN_COMMIT_STATUS: 503,
  INTERNAL_ERROR: 500,
};

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code];
}

/**
 * A domain error that is safe to surface to clients. Anything that is not a
 * DomainError must be treated as an internal error and must not leak details.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly httpStatus: number;

  constructor(code: ErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.retryable = retryable;
    this.httpStatus = httpStatusFor(code);
  }
}
