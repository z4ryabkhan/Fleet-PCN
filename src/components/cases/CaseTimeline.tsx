// Build brief section 7 screen 3: vertical timeline with these exact five
// stages. "Council reply" has no real data behind it yet — reply detection
// is a Phase 2 item (build brief section 8) — so it always renders as the
// upcoming/pending stage rather than a fabricated "done".
//
// UI review item 7: an ordered list with a real check icon on completed
// stages, not just a filled dot with no shape difference for non-colour
// users.

import { CheckIcon } from "@/components/ui/icons";

type Stage = { label: string; at: string | null };

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CaseTimeline({
  uploadedAt,
  detailsConfirmedAt,
  appealReadyAt,
  sentAt,
}: {
  uploadedAt: string;
  detailsConfirmedAt: string | null;
  appealReadyAt: string | null;
  sentAt: string | null;
}) {
  const stages: Stage[] = [
    { label: "Uploaded", at: uploadedAt },
    { label: "Details confirmed", at: detailsConfirmedAt },
    { label: "Appeal ready for approval", at: appealReadyAt },
    { label: "Sent", at: sentAt },
    { label: "Council reply", at: null },
  ];

  return (
    <ol className="space-y-0">
      {stages.map((stage, i) => {
        const done = stage.at !== null;
        const isLast = i === stages.length - 1;
        return (
          <li key={stage.label} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[9px] top-5 h-full w-0.5 ${done ? "bg-planal-brand" : "bg-planal-border"}`}
              />
            )}
            <span
              aria-hidden
              className={`z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 ${
                done ? "border-planal-brand bg-planal-brand" : "border-planal-border bg-planal-surface"
              }`}
            >
              {done && <CheckIcon className="h-2.5 w-2.5 text-white" />}
            </span>
            <div>
              <p className={`text-sm font-medium ${done ? "text-planal-ink" : "text-planal-ink-muted"}`}>
                {stage.label}
              </p>
              {stage.at && <p className="text-sm text-planal-ink-muted">{formatWhen(stage.at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
