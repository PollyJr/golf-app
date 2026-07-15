import { EventsLive } from "@/components/events-live";
import { requireSession } from "@/lib/auth";
import { getCourses, getEvents } from "@/lib/dal";

export default async function EventsPage() { const session = await requireSession(["player"]); const [events,courses] = await Promise.all([getEvents(session.clubId!,session.accountId),getCourses(session.clubId!)]); return <EventsLive initialEvents={events} courses={courses}/>; }
