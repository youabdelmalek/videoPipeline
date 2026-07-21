/** Message from a caught value, falling back when it is not an Error. */
export function messageFrom(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}
