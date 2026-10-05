const LABELS: Record<string, string> = {
  Rock_Metal: 'Rock & Metal',
  Pop: 'Pop',
  Hip_Hop_Rap: 'Hip-Hop & Rap',
  Punk_Alternative: 'Punk & Alternative',
  Latin_Mizrahi: 'Latin & Mizrahi',
};

/** "Rock_Metal" -> "Rock & Metal". Unknown categories just lose their underscores. */
export const categoryLabel = (category: string): string => LABELS[category] ?? category.replace(/_/g, ' ');

/** Rock & Metal first, then Pop (the order the songs are being prepared in), then the rest A-Z. */
export function sortCategories(categories: readonly string[]): string[] {
  const order = ['Rock_Metal', 'Pop'];
  const rank = (c: string) => {
    const i = order.indexOf(c);
    return i < 0 ? order.length : i;
  };
  return [...categories].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
