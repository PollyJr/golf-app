import { getSession } from "@/server/auth/session";
import { forbidden, notFound, unauthenticated } from "@/server/errors";
import { errorResponse, idParams } from "@/server/http/route";
import { getLocale } from "@/server/i18n";
import { externalOrigin } from "@/server/security";
import { buildCalendarFile, getEvent } from "@/server/services/events";

/** "Add to calendar": players and staff of the club may download the entry. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) throw unauthenticated();
    if (!session.clubId || !session.club) throw forbidden();
    const { id } = idParams.parse(await context.params);
    const event = await getEvent(session.clubId, id, await getLocale(), { includeDrafts: session.role !== "player" });
    if (!event) throw notFound("EVENT_NOT_FOUND");
    const file = buildCalendarFile(event, session.club.name, `${externalOrigin(request)}/app/events/${event.id}`);
    return new Response(file, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="event-${event.id.slice(0, 8)}.ics"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
