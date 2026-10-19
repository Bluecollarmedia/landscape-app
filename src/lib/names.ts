// Names always show with a capital letter at the start of each word ("zisha" -> "Zisha", "eli semah" -> "Eli Semah",
// "o'brien" -> "O'Brien", "mary-jane" -> "Mary-Jane"). Only ever raises a first letter: nothing else is changed, so
// "McDonald", "DeAngelo" and "HOA" stay exactly as typed. Pure, display only.

/** Capitalises the first letter of every word (after a space, hyphen, apostrophe or slash). Never lowercases anything. */
export function properName(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(/(^|[\s\-'’/(])(\p{Ll})/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

/** "first last" with both parts capitalised, skipping empty parts. */
export function fullName(first?: string | null, last?: string | null): string {
  return [properName(first), properName(last)].filter(Boolean).join(' ');
}
