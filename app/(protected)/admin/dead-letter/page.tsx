import { requireCapability } from "@/lib/auth/shield";
import { getDeadLetterEvents } from "@/lib/data/dead-letter";
import { DeadLetterClient } from "./dead-letter-client";

export default async function DeadLetterPage() {
  await requireCapability("integrations:manage");
  const events = await getDeadLetterEvents();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dead-Letter Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Webhook events ที่ประมวลผลล้มเหลว — Replay หรือ Dismiss แต่ละรายการ
        </p>
      </div>
      <DeadLetterClient events={events} />
    </div>
  );
}
