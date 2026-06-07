export type TrendScoreInput = {
  bookmarks?: number;
  views?: number;
  ageHours?: number;
};

export function calculateTrendScore(input: TrendScoreInput): number {
  const bookmarks = input.bookmarks ?? 0;
  const views = input.views ?? 0;
  const ageHours = Math.max(input.ageHours ?? 0, 0);
  const freshness = 1 / Math.sqrt(ageHours + 2);

  return Number(((bookmarks * 5 + views * 0.05) * freshness).toFixed(4));
}
