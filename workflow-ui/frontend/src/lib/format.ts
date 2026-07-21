/** Format a backend epoch-seconds timestamp as a local clock time. */
export function formatRunTime(value: number | null | undefined): string {
  if (!value) {
    return 'n/a';
  }
  return new Date(value * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
