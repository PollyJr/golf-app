import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, roleAllowed, verifyMutation, type Access, type ClubSession, type Session } from "../auth/session";
import { AppError, forbidden, unauthenticated } from "../errors";
import { assertSameOrigin } from "../security";

type Schema = z.ZodType;
type Infer<S> = S extends Schema ? z.infer<S> : undefined;

type SessionFor<A extends Access> = A extends "public"
  ? Session | null
  : A extends "platform"
    ? Session
    : ClubSession;

export interface RouteInput<A extends Access, B, Q, P> {
  request: Request;
  session: SessionFor<A>;
  body: B;
  query: Q;
  params: P;
}

interface RouteConfig<A extends Access, B extends Schema | undefined, Q extends Schema | undefined, P extends Schema | undefined> {
  /** Who may call this route. Anything but `public` requires a signed-in account of that kind. */
  access: A;
  body?: B;
  query?: Q;
  params?: P;
  /**
   * An account that still has to replace its one-time PIN or password may call
   * this route. Everything else is refused until the secret has been changed.
   */
  allowBeforeSecretChange?: boolean;
}

type NextRouteHandler = (request: Request, context: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return NextResponse.json({ code: error.code, fields: error.fields }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", fields: z.flattenError(error).fieldErrors },
      { status: 400 },
    );
  }
  console.error("unhandled route error:", error);
  return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON", 400);
  }
}

/**
 * Wraps a route handler with everything every endpoint needs: authentication
 * and role check, same-origin and CSRF verification for mutations, input
 * validation, and uniform JSON errors. The handler returns plain data (sent as
 * JSON) or a `Response` for anything special.
 */
export function route<
  A extends Access,
  B extends Schema | undefined = undefined,
  Q extends Schema | undefined = undefined,
  P extends Schema | undefined = undefined,
>(
  config: RouteConfig<A, B, Q, P>,
  handler: (input: RouteInput<A, Infer<B>, Infer<Q>, Infer<P>>) => Promise<unknown>,
): NextRouteHandler {
  return async (request, context) => {
    try {
      const session = await getSession();
      const mutation = !SAFE_METHODS.has(request.method);

      if (config.access !== "public") {
        if (!session) throw unauthenticated();
        if (!roleAllowed(session.role, config.access)) throw forbidden();
        if (config.access !== "platform" && (!session.clubId || !session.club)) throw forbidden();
        if (session.user.mustChangeSecret && !config.allowBeforeSecretChange) throw forbidden("SECRET_CHANGE_REQUIRED");
        if (mutation) await verifyMutation(request, session);
      } else if (mutation) {
        assertSameOrigin(request);
      }

      const params = config.params ? config.params.parse(await context.params) : undefined;
      const query = config.query
        ? config.query.parse(Object.fromEntries(new URL(request.url).searchParams))
        : undefined;
      const body = config.body ? config.body.parse(await readJson(request)) : undefined;

      const result = await handler({
        request,
        session: session as SessionFor<A>,
        body: body as Infer<B>,
        query: query as Infer<Q>,
        params: params as Infer<P>,
      });

      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const idParams = z.object({ id: z.uuid() });
export const tokenParams = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{16,200}$/) });

/** Weak ETag derived from a revision counter. */
export function revisionTag(revision: number | string): string {
  return `W/"r${revision}"`;
}

/** JSON response with revision-based conditional GET support. */
export function conditionalJson(request: Request, revision: number | string, data: unknown): Response {
  const etag = revisionTag(revision);
  const headers = { ETag: etag, "Cache-Control": "private, no-store" };
  const candidates = request.headers.get("if-none-match")?.split(",").map((value) => value.trim()) ?? [];
  if (candidates.includes(etag)) return new Response(null, { status: 304, headers });
  return NextResponse.json(data, { headers });
}
