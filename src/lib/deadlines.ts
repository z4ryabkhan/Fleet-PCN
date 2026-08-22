// Deadline engine — Part 8 Phase 4 of PLANAL_MASTER_PLAN.md.
//
// Rules verified against current UK sources (councils, TfL, Traffic
// Penalty Tribunal, National Highways/Dart Charge, POFA 2012 guidance) as
// of 2026-08 — see the commit this file was introduced in for the research
// behind each figure. These are standard-case windows, not a substitute
// for the actual notice: exact wording and the operator's own stated dates
// always take precedence, and this is surfaced to the user as an estimate,
// never a guarantee, matching the "not a guarantee" posture Part 2.4
// requires for appeal-strength output.
//
// Critically, every window here is counted from the notice/issue date
// (when the PCN was served), not the contravention event date — those are
// frequently different days, especially for postal/CCTV-detected PCNs.

// Mirrors the `cases.issuer_type` check constraint in
// supabase/migrations/0010_cases_and_evidence.sql — keep these in sync.
export type IssuerType =
  | "council_pcn"
  | "tfl_pcn"
  | "congestion_charge"
  | "ulez"
  | "dart_charge"
  | "private_pcn"
  | "bus_lane"
  | "moving_traffic";

type DeadlineRule = { discountDays: number; finalDays: number };

// discountDays: days from notice_date to pay at the discounted rate.
// finalDays: days from notice_date to pay in full or lodge representations
// / an appeal — after this, escalation (Notice to Owner, Charge
// Certificate, POPLA/tribunal referral, etc.) begins.
const DEADLINE_RULES: Record<NonNullable<IssuerType>, DeadlineRule> = {
  council_pcn: { discountDays: 14, finalDays: 28 },
  tfl_pcn: { discountDays: 14, finalDays: 28 },
  congestion_charge: { discountDays: 14, finalDays: 28 },
  ulez: { discountDays: 14, finalDays: 28 },
  dart_charge: { discountDays: 14, finalDays: 28 },
  private_pcn: { discountDays: 14, finalDays: 28 },
  // Postal/CCTV-detected — these get 21 days for the discount, not 14,
  // per the Traffic Management Act 2004 as amended (in force since 31 May
  // 2022). Final/representations window stays 28 days across the board.
  bus_lane: { discountDays: 21, finalDays: 28 },
  moving_traffic: { discountDays: 21, finalDays: 28 },
};

export type ComputedDeadlines = {
  discountDeadline: string; // ISO date (YYYY-MM-DD)
  finalDeadline: string; // ISO date (YYYY-MM-DD)
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Computes standard-case discount/final deadlines from the notice date and
 * issuer type. Returns null if either input is missing, or the issuer type
 * has no defined rule — callers should leave the case's deadline fields
 * unset in that case, never fabricate a date.
 */
export function computeDeadlines(
  issuerType: IssuerType | null | undefined,
  noticeDate: string | null | undefined
): ComputedDeadlines | null {
  if (!issuerType || !noticeDate) return null;
  const rule = DEADLINE_RULES[issuerType];
  if (!rule) return null;

  return {
    discountDeadline: addDays(noticeDate, rule.discountDays),
    finalDeadline: addDays(noticeDate, rule.finalDays),
  };
}
