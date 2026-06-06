import type { KanbanCard, KanbanEntity, KanbanSnapshot } from "./types";

export function optimisticMove(
  snapshot: KanbanSnapshot,
  entity: KanbanEntity,
  id: string,
  stage: string,
  sortOrder: number
) {
  return {
    ...snapshot,
    [entity]: snapshot[entity].map((card) =>
      card.id === id ? { ...card, stage, sortOrder } : card
    ),
  };
}

export function replaceCanonicalCard(
  snapshot: KanbanSnapshot,
  canonical: KanbanCard
) {
  return {
    ...snapshot,
    [canonical.entity]: snapshot[canonical.entity].map((card) =>
      card.id === canonical.id ? canonical : card
    ),
  };
}
