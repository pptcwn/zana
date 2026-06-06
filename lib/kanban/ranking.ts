import type { KanbanCard } from "./types";

export function rankForDrop(cards: KanbanCard[], targetIndex: number) {
  const sorted = [...cards].sort((a, b) => a.sortOrder - b.sortOrder);
  const previous = sorted[targetIndex - 1]?.sortOrder;
  const next = sorted[targetIndex]?.sortOrder;
  if (previous == null && next == null) return 1000;
  if (previous == null) return Math.max(1, next - 1000);
  if (next == null) return previous + 1000;
  return Math.floor((previous + next) / 2);
}
