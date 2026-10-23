import slugify from "slugify";

/**
 * Convert user-facing text (including Unicode styled alphabets) into a stable URL slug.
 * NFKC first converts compatibility characters such as mathematical bold letters/digits
 * to their ordinary equivalents; NFD then separates Vietnamese diacritics for removal.
 */
export function slugifyText(text: string): string {
  if (!text) return "";

  const normalized = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\/\\]+/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  return slugify(normalized, {
    lower: true,
    strict: true,
    trim: true,
  });
}
