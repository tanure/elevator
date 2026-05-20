import { describe, expect, it } from "vitest";
import { parseIcs } from "../ics.js";

const ICS_HEADER = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:test\r\n";
const ICS_FOOTER = "END:VCALENDAR\r\n";

function wrap(body: string): string {
  return ICS_HEADER + body + ICS_FOOTER;
}

describe("parseIcs", () => {
  it("returns an empty array for an empty calendar", () => {
    expect(parseIcs(wrap(""))).toEqual([]);
  });

  it("parses a single VEVENT with UTC start/end", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "UID:event-1@elevator",
        "SUMMARY:Standup",
        "DTSTART:20260101T150000Z",
        "DTEND:20260101T153000Z",
        "LOCATION:Teams",
        "END:VEVENT"
      ].join("\r\n") + "\r\n"
    );
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "event-1@elevator",
      title: "Standup",
      location: "Teams",
      allDay: false
    });
    expect(events[0].start).toBe(new Date(Date.UTC(2026, 0, 1, 15, 0, 0)).toISOString());
    expect(events[0].end).toBe(new Date(Date.UTC(2026, 0, 1, 15, 30, 0)).toISOString());
  });

  it("treats DTSTART;VALUE=DATE as all-day", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "UID:allday-1",
        "SUMMARY:Holiday",
        "DTSTART;VALUE=DATE:20260704",
        "END:VEVENT"
      ].join("\r\n") + "\r\n"
    );
    const [event] = parseIcs(ics);
    expect(event.allDay).toBe(true);
    expect(event.title).toBe("Holiday");
  });

  it("decodes escaped characters in SUMMARY", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "UID:esc-1",
        "SUMMARY:Line1\\nLine2\\, with comma",
        "DTSTART:20260101T120000Z",
        "END:VEVENT"
      ].join("\r\n") + "\r\n"
    );
    const [event] = parseIcs(ics);
    expect(event.title).toBe("Line1\nLine2, with comma");
  });

  it("unfolds RFC 5545 continuation lines", () => {
    // Lines starting with a space continue the previous logical line.
    // The continuation marker (space/tab) is consumed per RFC 5545 §3.1.
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "UID:fold-1",
        "SUMMARY:Very long ",
        " title that spans",
        "DTSTART:20260101T120000Z",
        "END:VEVENT"
      ].join("\r\n") + "\r\n"
    );
    const [event] = parseIcs(ics);
    expect(event.title).toBe("Very long title that spans");
  });

  it("falls back to a synthetic id when UID is missing", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "SUMMARY:No uid",
        "DTSTART:20260101T120000Z",
        "END:VEVENT"
      ].join("\r\n") + "\r\n"
    );
    const [event] = parseIcs(ics);
    expect(event.id).toContain("No uid");
  });

  it("extracts ORGANIZER CN and strips mailto:", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "UID:org-1",
        "SUMMARY:Meeting",
        "DTSTART:20260101T120000Z",
        "ORGANIZER;CN=Alice:mailto:alice@example.com",
        "END:VEVENT"
      ].join("\r\n") + "\r\n"
    );
    const [event] = parseIcs(ics);
    expect(event.organizer).toBe("Alice");
  });

  it("skips VEVENT without DTSTART", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "UID:skip-1",
        "SUMMARY:Skip me",
        "END:VEVENT"
      ].join("\r\n") + "\r\n"
    );
    expect(parseIcs(ics)).toEqual([]);
  });
});
