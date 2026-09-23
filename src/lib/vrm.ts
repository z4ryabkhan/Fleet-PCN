/** Uppercases and strips all whitespace — doesn't validate format, since UK
 * VRM patterns vary (current, dateless, personalised, Northern Ireland).
 * Whitespace is stripped entirely, not collapsed to one space: plates are
 * conventionally written with a space ("AB12 CDE") in correspondence but
 * commonly stored/typed without one, and this is the single normalization
 * both the app and scan-mailboxes rely on to match the two. */
export function normalizeVrm(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
