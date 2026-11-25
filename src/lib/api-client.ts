/**
 * The browser's way of talking to our API: JSON in, JSON out, the CSRF token
 * attached to every mutation, and errors as typed exceptions.
 */

const CSRF_COOKIE = "fairway_csrf";
const CSRF_HEADER = "x-csrf-token";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const prefix = `${CSRF_COOKIE}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  signal?: AbortSignal;
  /** Tells the server which version we already have; a 304 resolves to `null`. */
  etag?: string | null;
}

export interface ApiResult<T> {
  data: T | null;
  etag: string | null;
  notModified: boolean;
}

async function send<T>(method: Method, url: string, body: unknown, options: RequestOptions): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers[CSRF_HEADER] = csrfToken();
  if (options.etag) headers["If-None-Match"] = options.etag;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK", 0);
  }

  if (response.status === 304) return { data: null, etag: options.etag ?? null, notModified: true };
  const payload = (await response.json().catch(() => null)) as (T & { code?: string; fields?: Record<string, string[]> }) | null;
  if (!response.ok) {
    throw new ApiError(payload?.code ?? "UNKNOWN", response.status, payload?.fields);
  }
  return { data: payload as T, etag: response.headers.get("etag"), notModified: false };
}

async function unwrap<T>(result: Promise<ApiResult<T>>): Promise<T> {
  return (await result).data as T;
}

export const api = {
  get: <T>(url: string, options: RequestOptions = {}) => unwrap(send<T>("GET", url, undefined, options)),
  /** GET with conditional-request support, for resources that are polled. */
  getConditional: <T>(url: string, options: RequestOptions = {}) => send<T>("GET", url, undefined, options),
  post: <T = { ok: true }>(url: string, body: unknown = {}, options: RequestOptions = {}) => unwrap(send<T>("POST", url, body, options)),
  put: <T = { ok: true }>(url: string, body: unknown = {}, options: RequestOptions = {}) => unwrap(send<T>("PUT", url, body, options)),
  patch: <T = { ok: true }>(url: string, body: unknown = {}, options: RequestOptions = {}) => unwrap(send<T>("PATCH", url, body, options)),
  delete: <T = { ok: true }>(url: string, body?: unknown, options: RequestOptions = {}) => unwrap(send<T>("DELETE", url, body, options)),
};

/** True for failures worth retrying later: offline, timeouts, server hiccups. */
export function isTransient(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.status === 429);
}
