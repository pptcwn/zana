export function needsRebalance(cards: { sortOrder: number }[]): boolean {
  const sorted = [...cards].map((c) => c.sortOrder).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < 128) return true;
  }
  return false;
}
