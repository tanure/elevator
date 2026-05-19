import type { CalendarEvent } from "@elevator/shared";

/**
 * Minimal RFC 5545 (iCalendar) parser sufficient for read-only sync.
 *
 * Limitations (acceptable for MVP):
 *   - Single VCALENDAR; multiple VEVENTs supported.
 *   - No timezone DB lookups — TZID is recorded but treated as a hint;
 *     UTC ("Z") and floating local times are honoured.
 *   - RRULE is *not* expanded — the connector returns only DTSTART
 *     occurrences. Recurring series will need RRULE expansion later.
 *   - Line folding (RFC 5545 §3.1) is unfolded before tokenisation.
 */

function unfold(text: string): string {
  // Lines beginning with a space or tab continue the previous line.
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

interface RawEvent {
  uid?: string;
  summary?: string;
  dtstart?: string;
  dtend?: string;
  dtstartParams?: Record<string, string>;
  location?: string;
  url?: string;
  organizer?: string;
}

function parseDate(value: string, params?: Record<string, string>): {
  iso: string;
  allDay: boolean;
} {
  const allDay = params?.VALUE === "DATE";
  if (allDay) {
    // YYYYMMDD → ISO date at start of day in local time.
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (m) {
      const [, y, mo, d] = m;
      return { iso: new Date(Number(y), Number(mo) - 1, Number(d)).toISOString(), allDay: true };
    }
  }
  // YYYYMMDDTHHMMSSZ or local YYYYMMDDTHHMMSS
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return { iso: new Date(value).toISOString(), allDay: false };
  const [, y, mo, d, hh, mm, ss, z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss))
    : new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
  return { iso: date.toISOString(), allDay: false };
}

function splitKeyParams(rawKey: string): { key: string; params: Record<string, string> } {
  const parts = rawKey.split(";");
  const key = parts.shift()!.toUpperCase();
  const params: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { key, params };
}

export function parseIcs(text: string): CalendarEvent[] {
  const unfolded = unfold(text);
  const lines = unfolded.split(/\r?\n/);
  const events: CalendarEvent[] = [];
  let current: RawEvent | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.dtstart) {
        const start = parseDate(current.dtstart, current.dtstartParams);
        const end = current.dtend ? parseDate(current.dtend) : start;
        events.push({
          id: current.uid ?? `${start.iso}|${current.summary ?? ""}`,
          title: current.summary ?? "(no title)",
          start: start.iso,
          end: end.iso,
          allDay: start.allDay,
          location: current.location,
          url: current.url,
          organizer: current.organizer
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const { key, params } = splitKeyParams(line.slice(0, sep));
    const value = line.slice(sep + 1);
    switch (key) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.summary = decodeIcsText(value);
        break;
      case "DTSTART":
        current.dtstart = value;
        current.dtstartParams = params;
        break;
      case "DTEND":
        current.dtend = value;
        break;
      case "LOCATION":
        current.location = decodeIcsText(value);
        break;
      case "URL":
        current.url = value;
        break;
      case "ORGANIZER":
        current.organizer = (params.CN ?? value).replace(/^mailto:/i, "");
        break;
    }
  }
  return events;
}

function decodeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
