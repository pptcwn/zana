"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import type { KanbanCard as Card } from "@/lib/kanban/types";
import { WorkflowConnector } from "./workflow-connector";

function CardBody({ card, active = false }: { card: Card; active?: boolean }) {
  return (
    <div
      className={`relative rounded-2xl border bg-white/85 p-4 text-left backdrop-blur-xl transform-gpu transition-[transform,box-shadow,opacity] duration-300 ease-out motion-reduce:transition-none ${
        active
          ? "scale-[1.025] cursor-grabbing border-primary/30 shadow-[0_18px_50px_rgba(197,107,122,0.24)] ring-1 ring-primary/35"
          : "border-pink-100 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{card.subtitle}</p>
      {card.meta ? <p className="mt-3 text-[11px] text-primary/75">{card.meta}</p> : null}
      <WorkflowConnector active={active} />
    </div>
  );
}

export const KanbanCardView = memo(CardBody);

export const KanbanCard = memo(function KanbanCard({ card }: { card: Card }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "card", card } });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className="block w-full touch-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        opacity: isDragging ? 0.28 : 1,
        willChange: isDragging ? "transform" : undefined,
      }}
    >
      <CardBody card={card} />
    </button>
  );
});
