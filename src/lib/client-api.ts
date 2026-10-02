import type { DomainResult } from "./result";

/**
 * Browser-side helper that unwraps the domain envelope.
 * Throws with the domain message when the request is not successful.
 */
export async function apiRequest<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

  let body: DomainResult<T>;
  try {
    body = (await response.json()) as DomainResult<T>;
  } catch {
    throw new Error("Unexpected server response");
  }

  if (!body.success) {
    throw new Error(body.message);
  }
  return body.data;
}
