"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { KanbanCard, KanbanEntity } from "@/lib/kanban/types";
import { KANBAN_COLUMNS, canMoveCard } from "@/lib/kanban/transitions";
import { rankForDrop } from "@/lib/kanban/ranking";
import { KanbanColumn } from "./kanban-column";
import { KanbanOverlay } from "./kanban-overlay";

export function KanbanBoard({
  entity,
  cards,
  moving,
  onMove,
}: {
  entity: KanbanEntity;
  cards: KanbanCard[];
  moving: boolean;
  onMove: (card: KanbanCard, stage: string, sortOrder: number) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 140, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const activeCard = useMemo(
    () => cards.find((card) => card.id === activeId) ?? null,
    [activeId, cards]
  );

  function stageFromEvent(event: DragEndEvent) {
    const over = event.over;
    if (!over) return null;
    if (String(over.id).startsWith("column:")) {
      return String(over.id).slice("column:".length);
    }
    return cards.find((card) => card.id === over.id)?.stage ?? null;
  }

  function handleStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleEnd(event: DragEndEvent) {
    const card = cards.find((item) => item.id === event.active.id);
    const stage = stageFromEvent(event);
    setActiveId(null);
    setOverStage(null);
    if (!card || !stage || moving || !canMoveCard(entity, card.stage, stage)) return;
    const targetCards = cards
      .filter((item) => item.stage === stage && item.id !== card.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const overIndex = targetCards.findIndex((item) => item.id === event.over?.id);
    const sortOrder = rankForDrop(
      targetCards,
      overIndex >= 0 ? overIndex : targetCards.length
    );
    if (card.stage !== stage || card.sortOrder !== sortOrder) {
      onMove(card, stage, sortOrder);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleStart}
      onDragOver={(event) => {
        const id = String(event.over?.id ?? "");
        setOverStage(
          id.startsWith("column:")
            ? id.slice("column:".length)
            : cards.find((card) => card.id === id)?.stage ?? null
        );
      }}
      onDragCancel={() => {
        setActiveId(null);
        setOverStage(null);
      }}
      onDragEnd={handleEnd}
    >
      <div className="relative overflow-x-auto pb-5">
        <div className="pointer-events-none absolute left-8 right-8 top-8 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="relative flex min-w-max gap-4 pt-2">
          {KANBAN_COLUMNS[entity].map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={cards.filter((card) => card.stage === column.id)}
              highlighted={overStage === column.id}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" }}>
        {activeCard ? <KanbanOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
