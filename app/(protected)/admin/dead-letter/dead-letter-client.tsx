"use client";

import { useState, useTransition } from "react";
import type { DeadLetterEvent } from "@/lib/data/dead-letter";
import { replayEventAction, dismissEventAction } from "./actions";
import { toast } from "@/components/ui/feedback";

export function DeadLetterClient({ events }: { events: DeadLetterEvent[] }) {
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function handleReplay(eventId: string) {
    setWorking(eventId);
    startTransition(async () => {
      try {
        await replayEventAction({ eventId });
        toast.success("Event re-queued");
      } catch {
        toast.error("Replay failed");
      } finally {
        setWorking(null);
      }
    });
  }

  function handleDismiss(eventId: string) {
    setWorking(eventId);
    startTransition(async () => {
      try {
        await dismissEventAction({ eventId });
        toast.success("Event dismissed");
      } catch {
        toast.error("Dismiss failed");
      } finally {
        setWorking(null);
      }
    });
  }

  if (events.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        ไม่มี failed events
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="rounded-2xl border border-pink-100 bg-white/70 p-4 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">
                {event.platform} · {event.eventType}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {event.accountName ?? "unknown account"} · {event.externalEventId}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                attempts: {event.attempts} · received:{" "}
                {new Date(event.receivedAt).toLocaleString("th-TH")}
              </p>
              {event.lastError && (
                <p className="mt-1 rounded bg-red-50 px-2 py-1 font-mono text-[11px] text-red-600">
                  {event.lastError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={working === event.id}
                onClick={() => handleReplay(event.id)}
                className="btn-primary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Replay
              </button>
              <button
                type="button"
                disabled={working === event.id}
                onClick={() => handleDismiss(event.id)}
                className="rounded-lg border border-pink-100 bg-white px-3 py-1.5 text-xs text-muted-foreground hover:bg-pink-50 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
