import type { NextRequest } from "next/server";
import type { ZodType } from "zod";

import { logger } from "./logger";
import { DomainError, err, type DomainResult } from "./result";

export function getRequestId(req: Request): string {
  const header = req.headers.get("x-request-id");
  if (header && header.length > 0 && header.length <= 128) {
    return header;
  }
  return crypto.randomUUID();
}

export function jsonResponse<T>(
  body: DomainResult<T>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function respondOk<T>(requestId: string, data: T, status = 200): Response {
  return jsonResponse({ success: true, code: null, requestId, data, retryable: false }, status);
}

function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  return new DomainError("INTERNAL_ERROR", "Unexpected server error", true);
}

type WithRequestId<C> = C & { requestId: string };

/**
 * Wraps a route handler with request-id propagation, structured logging and a
 * uniform error envelope. Unknown errors never leak internal details.
 */
export function withRoute<C extends Record<string, unknown> = Record<string, unknown>>(
  handler: (req: NextRequest, ctx: WithRequestId<C>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const requestId = getRequestId(req);
    const startedAt = Date.now();
    const routeCtx = { ...(ctx ?? ({} as C)), requestId };

    try {
      const response = await handler(req, routeCtx);
      logger.info("http.request", {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      const domainError = toDomainError(error);
      logger.error("http.error", {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        code: domainError.code,
        message: domainError.message,
        durationMs: Date.now() - startedAt,
      });
      return jsonResponse(
        err(requestId, domainError.code, domainError.message, domainError.retryable),
        domainError.httpStatus,
      );
    }
  };
}

export async function parseJson<T>(
  req: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new DomainError("VALIDATION_ERROR", "Request body must be valid JSON");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request body",
    );
  }
  return parsed.data;
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * CSRF defense for cookie-authenticated mutations: reject requests whose Origin
 * does not match the host. Non-browser clients without an Origin are allowed.
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  if (!origin) return;

  const host = req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new DomainError("FORBIDDEN", "Invalid Origin header");
  }

  if (!host || originHost !== host) {
    throw new DomainError("FORBIDDEN", "Cross-origin request rejected");
  }
}
