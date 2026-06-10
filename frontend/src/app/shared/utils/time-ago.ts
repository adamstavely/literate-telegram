/** Relative time label matching the prototype (today / yesterday / Nd ago / Nmo ago). */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const days = (Date.now() - then) / 86_400_000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return `${Math.round(days)}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
