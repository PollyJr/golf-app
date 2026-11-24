/**
 * Errors the application raises on purpose. The HTTP layer turns them into a
 * JSON body `{ code }` with the given status; anything else becomes a 500.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number = 400,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export const unauthenticated = () => new AppError("UNAUTHENTICATED", 401);
export const forbidden = (code = "FORBIDDEN") => new AppError(code, 403);
export const notFound = (code = "NOT_FOUND") => new AppError(code, 404);
export const conflict = (code: string) => new AppError(code, 409);
export const badRequest = (code = "INVALID_REQUEST", fields?: Record<string, string[]>) => new AppError(code, 400, fields);
export const tooManyRequests = () => new AppError("TOO_MANY_ATTEMPTS", 429);

/** PostgreSQL unique-violation, raised when an insert hits a unique index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, constraint: name } = error as { code?: string; constraint?: string };
  return code === "23505" && (constraint === undefined || name === constraint);
}
