/** Uppercases and collapses whitespace — doesn't validate format, since UK
 * VRM patterns vary (current, dateless, personalised, Northern Ireland). */
export function normalizeVrm(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}
