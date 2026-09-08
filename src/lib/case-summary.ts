// Part 2.2 step 3's plain-English summary sentence — the thing that was
// missing while the case page only ever showed raw fields. One function,
// not an AI call: everything it needs is already sitting on the case row,
// so there's no reason to spend a Claude request re-deriving a sentence
// from data Planal already has.

export type CaseSummaryInput = {
  status: string;
  issuerName: string | null;
  amountFull: number | null;
  amountDiscounted: number | null;
  discountDeadline: string | null; // ISO date
  finalDeadline: string | null; // ISO date
  contraventionDescription: string | null;
  contraventionCode: string | null;
  paidAt: string | null; // ISO datetime
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function money(n: number): string {
  return `£${n.toFixed(2).replace(/\.00$/, "")}`;
}

export function formatCaseSummary(c: CaseSummaryInput): string {
  const issuer = c.issuerName ? ` from ${c.issuerName}` : "";
  const reason = c.contraventionDescription
    ? ` for ${c.contraventionDescription.charAt(0).toLowerCase()}${c.contraventionDescription.slice(1)}`
    : c.contraventionCode
      ? ` (contravention code ${c.contraventionCode})`
      : "";
  const amount = c.amountFull != null ? ` ${money(c.amountFull)}` : "";
  const opener = `You have a${amount} PCN${issuer}${reason}.`;

  if (c.status === "new" || c.status === "reviewing") {
    if (c.amountFull == null) {
      return "We're still reading the details off this ticket — check back in a moment, or fill them in yourself below.";
    }
  }

  if (c.status === "paid") {
    const when = c.paidAt ? ` on ${formatDate(c.paidAt.slice(0, 10))}` : "";
    return `${opener} Marked as paid${when}.`;
  }

  if (c.status === "appealed") {
    return `${opener} You've appealed this — check back here once you hear the outcome.`;
  }

  if (c.status === "closed") {
    return `${opener} This case is closed.`;
  }

  if (c.amountDiscounted != null && c.discountDeadline) {
    return `${opener} Pay ${money(c.amountDiscounted)} before ${formatDate(c.discountDeadline)}, or review your appeal options.`;
  }
  if (c.finalDeadline) {
    return `${opener} Pay${amount ? ` ${money(c.amountFull!)}` : ""} before ${formatDate(c.finalDeadline)}, or review your appeal options.`;
  }
  return `${opener} Review your appeal options below.`;
}
