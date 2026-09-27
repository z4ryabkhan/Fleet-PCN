// "Why are you appealing?" reason catalogue (Zaryab's spec, 2026-09-24,
// adapted to this repo's existing PcnExtraction/CaseContext shapes rather
// than the standalone reference implementation it was pasted from). This
// is a fixed, honest picklist of what the user says happened — never
// AI-generated. It's an input to src/lib/appeal.ts's assessAppeal(), which
// still writes the real letter: this file only supplies the grounded
// starting sentence (via renderBody) and, later, the evidenceHints an
// evidence-request banner will show once that feature exists.
//
// Wording verified against no official source yet — flagged in the spec
// itself as "a starting point, not legal advice." Treat this catalogue the
// same way as an issuer directory entry with no verified_at: usable, but
// due a real legal check before this is relied on at scale.

export type AppealReasonKind = "ground" | "mitigation";
export type AppealReasonAppliesTo = "council" | "private" | "both";

export type AppealReasonCode =
  | "not_owner"
  | "hire_firm"
  | "already_paid"
  | "signs_unclear"
  | "entitled_to_park"
  | "notice_error"
  | "amount_wrong"
  | "vehicle_taken"
  | "medical_emergency"
  | "hospital_urgent"
  | "breakdown"
  | "bereavement"
  | "permit_delay"
  | "new_resident"
  | "new_restriction"
  | "emergency_other"
  | "hardship"
  | "other";

export interface AppealReason {
  code: AppealReasonCode;
  label: string;
  kind: AppealReasonKind;
  appliesTo: AppealReasonAppliesTo;
  /** Body sentence(s) for the letter. Placeholders: {{pcn}} {{vrm}} {{date}} {{location}} */
  body: string;
  /** Shown only once an issuer's reply actually asks for evidence — never required up front. */
  evidenceHints: string[];
}

export const APPEAL_REASONS: AppealReason[] = [
  // Legal grounds
  {
    code: "not_owner",
    label: "I wasn't the owner at the time",
    kind: "ground",
    appliesTo: "both",
    body: "I was not the owner of this vehicle on the date of the alleged contravention. I ask that the notice be cancelled.",
    evidenceHints: ["Sale receipt or bill of sale", "DVLA or V5C confirmation showing the date", "Insurance cancellation or transfer letter"],
  },
  {
    code: "hire_firm",
    label: "The vehicle was on hire to someone else",
    kind: "ground",
    appliesTo: "both",
    body: "The vehicle was on hire under a hire agreement at the time, and the hirer accepted liability for penalties. Please redirect this notice to the hirer.",
    evidenceHints: ["Hire agreement with the liability clause", "Hirer name and address", "Hire start and end dates"],
  },
  {
    code: "already_paid",
    label: "I've already paid this penalty",
    kind: "ground",
    appliesTo: "both",
    body: "This penalty has already been paid. I ask that the notice be cancelled.",
    evidenceHints: ["Payment receipt", "Bank or card statement line", "Confirmation email"],
  },
  {
    code: "signs_unclear",
    label: "The signs or road markings were unclear or missing",
    kind: "ground",
    appliesTo: "both",
    body: "The signs or road markings at {{location}} were missing, unclear or incorrect. I ask that the notice be cancelled because the contravention did not occur.",
    evidenceHints: ["Photos of the signs and markings", "Photo from the driver viewpoint", "Date and time of the photos"],
  },
  {
    code: "entitled_to_park",
    label: "I was allowed to park there",
    kind: "ground",
    appliesTo: "both",
    body: "I was entitled to park at {{location}} at the time. I ask that the notice be cancelled.",
    evidenceHints: ["Valid permit, ticket or receipt", "Photo of the bay or restriction", "Blue Badge or permit details"],
  },
  {
    code: "notice_error",
    label: "The notice has a mistake",
    kind: "ground",
    appliesTo: "both",
    body: "The notice contains an error or the required procedure was not followed. I ask that it be cancelled.",
    evidenceHints: ["A clear copy of the notice", "The specific error you found"],
  },
  {
    code: "amount_wrong",
    label: "The penalty amount is wrong",
    kind: "ground",
    appliesTo: "council",
    body: "The penalty amount requested is higher than allowed. I ask that the notice be corrected or cancelled.",
    evidenceHints: ["The notice showing the amount", "The current penalty band for the contravention"],
  },
  {
    code: "vehicle_taken",
    label: "The vehicle was stolen or taken without my consent",
    kind: "ground",
    appliesTo: "both",
    body: "The vehicle was taken without my consent at the time. I ask that the notice be cancelled.",
    evidenceHints: ["Police crime reference number", "Insurance claim reference"],
  },

  // Ask for discretion
  {
    code: "medical_emergency",
    label: "Medical emergency",
    kind: "mitigation",
    appliesTo: "both",
    body: "I was dealing with a medical emergency and could not move the vehicle. I ask the issuer to use its discretion and cancel this penalty.",
    evidenceHints: ["Doctor or hospital letter with dates and times", "Ambulance or A&E record"],
  },
  {
    code: "hospital_urgent",
    label: "Urgent hospital or doctor visit",
    kind: "mitigation",
    appliesTo: "both",
    body: "I was making an urgent hospital or doctor visit and could not park legally nearby. I ask the issuer to use its discretion and cancel this penalty.",
    evidenceHints: ["Appointment or hospital letter", "Why you could not walk from legal parking"],
  },
  {
    code: "breakdown",
    label: "My vehicle broke down",
    kind: "mitigation",
    appliesTo: "both",
    body: "My vehicle broke down and I was unable to move it. I ask the issuer to use its discretion and cancel this penalty.",
    evidenceHints: ["Breakdown or recovery invoice with time and place", "Garage repair bill"],
  },
  {
    code: "bereavement",
    label: "Bereavement or funeral",
    kind: "mitigation",
    appliesTo: "both",
    body: "I was dealing with a bereavement at the time. I ask the issuer to use its discretion and cancel this penalty.",
    evidenceHints: ["Funeral service sheet or funeral director letter"],
  },
  {
    code: "permit_delay",
    label: "Permit delayed by the issuer",
    kind: "mitigation",
    appliesTo: "council",
    body: "My permit was delayed by an administrative issue with the issuer. I ask that this penalty be cancelled.",
    evidenceHints: ["Application or renewal documents", "Correspondence with the issuer"],
  },
  {
    code: "new_resident",
    label: "I've recently moved",
    kind: "mitigation",
    appliesTo: "council",
    body: "I had recently moved and was not yet registered for a permit. I ask that this penalty be cancelled.",
    evidenceHints: ["Proof of address", "Date you moved"],
  },
  {
    code: "new_restriction",
    label: "The restriction was newly introduced",
    kind: "mitigation",
    appliesTo: "council",
    body: "This restriction had only recently been introduced. I ask the issuer to use its discretion and cancel this penalty.",
    evidenceHints: ["Date the restriction started", "Photos of the signage"],
  },
  {
    code: "emergency_other",
    label: "Another emergency",
    kind: "mitigation",
    appliesTo: "both",
    body: "I was dealing with an urgent emergency at the time. I ask the issuer to use its discretion and cancel this penalty.",
    evidenceHints: ["Any independent record of the emergency"],
  },
  {
    code: "hardship",
    label: "Financial hardship",
    kind: "mitigation",
    appliesTo: "council",
    body: "Paying this penalty would cause me financial hardship. I ask the issuer to use its discretion and cancel or reduce it.",
    evidenceHints: ["Proof of your financial position"],
  },
  {
    code: "other",
    label: "Something else",
    kind: "mitigation",
    appliesTo: "both",
    body: "There were circumstances that led to this penalty. I ask the issuer to use its discretion and cancel it.",
    evidenceHints: ["Anything that supports what happened"],
  },
];

const REASON_BY_CODE = new Map(APPEAL_REASONS.map((r) => [r.code, r]));

export function reasonByCode(code: string | null | undefined): AppealReason | null {
  if (!code) return null;
  return REASON_BY_CODE.get(code as AppealReasonCode) ?? null;
}

export function appealReasonLabel(code: string | null | undefined): string | null {
  return reasonByCode(code)?.label ?? null;
}

/** cases.issuer_type has more categories than the spec's simple
 * council/private split — everything except 'private_pcn' counts as
 * non-private here (TfL, congestion charge, ULEZ, Dart Charge, bus lane
 * and moving-traffic notices are all issued by a public authority, same
 * as a council PCN, for the purposes of which reasons make sense). */
export function reasonsForIssuerType(issuerType: string | null | undefined): AppealReason[] {
  const isPrivateOperator = issuerType === "private_pcn";
  return APPEAL_REASONS.filter(
    (r) => r.appliesTo === "both" || (r.appliesTo === "council" && !isPrivateOperator)
  );
}

/** Fills a reason's body template from the ticket's own facts — never
 * invents any; a missing fact falls back to a generic phrase rather than
 * leaving a literal {{placeholder}} in the letter. */
export function renderReasonBody(
  reason: AppealReason,
  ticket: { referenceNumber?: string | null; vrm?: string | null; date?: string | null; location?: string | null }
): string {
  return reason.body
    .replaceAll("{{pcn}}", ticket.referenceNumber || "this notice")
    .replaceAll("{{vrm}}", ticket.vrm || "the vehicle")
    .replaceAll("{{date}}", ticket.date || "the date shown on the notice")
    .replaceAll("{{location}}", ticket.location || "this location");
}
