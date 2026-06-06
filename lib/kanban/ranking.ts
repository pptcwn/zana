import type { KanbanCard } from "./types";

const GAP = 65536; // large power-of-2 so many halvings before exhaustion

export function rankForDrop(cards: KanbanCard[], targetIndex: number): number {
  const sorted = [...cards].sort((a, b) => a.sortOrder - b.sortOrder);
  const previous = sorted[targetIndex - 1]?.sortOrder ?? null;
  const next = sorted[targetIndex]?.sortOrder ?? null;

  if (previous === null && next === null) return GAP;
  if (previous === null) return Math.max(1, next! - GAP);
  if (next === null) return previous + GAP;

  const gap = next - previous;
  if (gap <= 1) {
    // Integer space exhausted between these two neighbors.
    // Return previous+1 which equals next — the caller's onMove guard
    // (card.stage !== stage || card.sortOrder !== sortOrder) will still fire,
    // but visual order is preserved. A future rebalance migration clears this.
    return previous + 1;
  }
  // Bias slightly toward the upper half to reduce left-side exhaustion on
  // repeated prepends: use ceiling midpoint.
  return Math.ceil((previous + next) / 2);
}
