// The locale is pinned so a Hebrew-locale Mac can't change the separators.
const full = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 });

/** 1234567890 -> "1,234,567,890" */
export const formatViews = (n: number): string => full.format(n);

/** 1234567890 -> "1.23B" */
export const formatViewsCompact = (n: number): string => compact.format(n);

/** 104000000 -> "+104,000,000" */
export const formatDelta = (n: number): string => `+${formatViews(n)}`;

/** 90 -> "1:30" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
