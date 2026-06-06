import type { KanbanCard } from "@/lib/kanban/types";
import { KanbanCardView } from "./kanban-card";

export function KanbanOverlay({ card }: { card: KanbanCard }) {
  return (
    <div className="w-[280px] transform-gpu">
      <KanbanCardView card={card} active />
    </div>
  );
}
