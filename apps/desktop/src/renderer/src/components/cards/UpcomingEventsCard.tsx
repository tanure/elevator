import { useCallback, useEffect, useState, type ReactElement } from "react";
import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { CalendarEvent, Integration } from "@elevator/shared";

interface AggregatedEvent extends CalendarEvent {
  source: string;
}

function formatWhen(event: AggregatedEvent): string {
  const start = new Date(event.start);
  const sameDay = new Date().toDateString() === start.toDateString();
  if (event.allDay) {
    return start.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  }
  return sameDay
    ? start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : start.toLocaleString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
}

export function UpcomingEventsCard(): ReactElement {
  const [events, setEvents] = useState<AggregatedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const integrations: Integration[] = await window.elevator.integrations.list();
    const collected: AggregatedEvent[] = [];
    for (const integration of integrations) {
      const data = await window.elevator.integrations.getSyncData(integration.id);
      if (data?.kind === "calendar" && data.events) {
        for (const e of data.events) {
          collected.push({ ...e, source: integration.displayName });
        }
      }
    }
    collected.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    setEvents(collected.slice(0, 6));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CalendarCheck className="h-4 w-4 text-primary" />
          Upcoming events
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Connect a calendar integration and click Sync to see upcoming events.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((event) => (
              <li key={`${event.source}|${event.id}`} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 text-muted-foreground">{formatWhen(event)}</span>
                <span className="flex-1 truncate font-medium text-foreground" title={event.title}>
                  {event.title}
                </span>
                {event.location && (
                  <span className="hidden truncate text-muted-foreground md:inline" title={event.location}>
                    {event.location}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
