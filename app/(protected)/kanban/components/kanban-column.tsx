"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { KanbanCard, KanbanColumn as Column } from "@/lib/kanban/types";
import { KanbanCard as Card } from "./kanban-card";

export function KanbanColumn({
  column,
  cards,
  highlighted,
}: {
  column: Column;
  cards: KanbanCard[];
  highlighted: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: "column", stage: column.id },
  });
  const active = highlighted || isOver;

  return (
    <section
      ref={setNodeRef}
      className={`w-[300px] shrink-0 rounded-[22px] border p-3 transition-all duration-300 ease-out motion-reduce:transition-none ${
        active
          ? "scale-[1.01] border-primary/25 bg-primary/[0.045] ring-1 ring-primary/20"
          : "border-pink-100 bg-white/45"
      }`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {column.label}
        </h2>
        <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] text-primary">
          {cards.length}
        </span>
      </header>
      <SortableContext
        items={cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-28 space-y-3">
          {cards.map((card) => <Card key={card.id} card={card} />)}
        </div>
      </SortableContext>
    </section>
  );
}
