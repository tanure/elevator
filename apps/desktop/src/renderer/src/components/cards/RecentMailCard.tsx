import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { Integration, MailMessage } from "@elevator/shared";

interface AggregatedMail extends MailMessage {
  source: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function RecentMailCard(): ReactElement {
  const [messages, setMessages] = useState<AggregatedMail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const integrations: Integration[] = await window.elevator.integrations.list();
    const collected: AggregatedMail[] = [];
    for (const integration of integrations) {
      const data = await window.elevator.integrations.getSyncData(integration.id);
      if (data?.kind === "mail" && data.mail) {
        for (const m of data.mail) {
          collected.push({ ...m, source: integration.displayName });
        }
      }
    }
    collected.sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
    setMessages(collected.slice(0, 6));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Mail className="h-4 w-4 text-primary" />
          Recent mail
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Connect a mail integration and click Sync to see recent messages.
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((msg) => (
              <li key={`${msg.source}|${msg.id}`} className="text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex-1 truncate ${msg.unread ? "font-semibold text-foreground" : "text-foreground"}`}
                    title={msg.subject}
                  >
                    {msg.subject}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatTime(msg.receivedAt)}</span>
                </div>
                <div className="truncate text-muted-foreground" title={msg.from}>
                  {msg.from}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
