import type { KanbanEntity } from "./types";

export function needsRebalance(cards: { sortOrder: number }[]): boolean {
  const sorted = [...cards].map((c) => c.sortOrder).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < 2) return true;
  }
  return false;
}

export type RebalanceInput = {
  entity: KanbanEntity;
  stage: string;
  adminId: string;
};
