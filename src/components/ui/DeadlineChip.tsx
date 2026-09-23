// Deadline chip — build brief section 7: red (2 days or less), amber (3-7
// days), green tint once sent/won. Colour is never the only signal (brief
// section 7 accessibility rule) — the day count/label is always the visible
// text, colour just reinforces urgency.

function daysUntil(iso: string): number {
  const today = new Date();
  const target = new Date(`${iso}T00:00:00Z`);
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - utcToday) / 86_400_000);
}

export function DeadlineChip({
  deadline,
  settled,
}: {
  deadline: string | null;
  settled?: boolean;
}) {
  if (settled) {
    return (
      <span className="inline-flex items-center rounded-full bg-planal-brand-tint px-3 py-1 text-xs font-semibold text-planal-brand-dark">
        Sent
      </span>
    );
  }

  if (!deadline) {
    return (
      <span className="inline-flex items-center rounded-full bg-planal-border px-3 py-1 text-xs font-semibold text-planal-ink-muted">
        No deadline yet
      </span>
    );
  }

  const days = daysUntil(deadline);
  const label = days < 0 ? "Overdue" : days === 0 ? "Due today" : days === 1 ? "1 day left" : `${days} days left`;

  const classes =
    days <= 2
      ? "bg-planal-danger-bg text-planal-danger-text"
      : days <= 7
        ? "bg-planal-amber-bg text-planal-amber-text"
        : "bg-planal-brand-tint-2 text-planal-brand-dark";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}
