import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// AI appeal-strength assessment + draft generation — Part 2.4 of
// PLANAL_MASTER_PLAN.md. Returns null if no API key is configured, same
// "inert without the key" pattern as OCR/DVLA.
//
// Part 9 rule 2 / Part 2.6: this module only ever produces an assessment
// and editable draft text. Nothing here submits anything anywhere — the
// human-confirm step and "submit yourself, off-platform" framing live in
// the calling action and UI, not here.

export const APPEAL_GROUNDS = [
  "payment_already_made",
  "wrong_registration_recorded",
  "unclear_missing_signage",
  "incorrect_location_recorded",
  "vehicle_not_present_mistaken_identity",
  "grace_period_breach",
  "loading_unloading_exemption",
  "valid_blue_badge_displayed",
  "valid_permit_displayed",
  "procedural_error",
  "anpr_timing_error",
  "duplicate_notice",
  "mitigating_circumstances",
  "private_keeper_liability_dispute",
] as const;

export type AppealGround = (typeof APPEAL_GROUNDS)[number];

const GROUND_LABELS: Record<AppealGround, string> = {
  payment_already_made: "Payment already made",
  wrong_registration_recorded: "Wrong registration recorded",
  unclear_missing_signage: "Unclear or missing signage",
  incorrect_location_recorded: "Incorrect location recorded",
  vehicle_not_present_mistaken_identity: "Vehicle not present / mistaken identity",
  grace_period_breach: "Grace period breach",
  loading_unloading_exemption: "Loading/unloading exemption",
  valid_blue_badge_displayed: "Valid Blue Badge displayed",
  valid_permit_displayed: "Valid permit displayed",
  procedural_error: "Procedural error (e.g. Notice to Owner not properly served, invalid contravention code)",
  anpr_timing_error: "ANPR timing error",
  duplicate_notice: "Duplicate notice for the same event",
  mitigating_circumstances: "Mitigating circumstances (medical/breakdown)",
  private_keeper_liability_dispute:
    "Keeper-liability dispute specific to private PCNs (landowner authority, contract formation under POFA 2012)",
};

const AssessmentSchema = z.object({
  strength: z.enum(["weak", "moderate", "strong"]),
  applicableGrounds: z.array(
    z.object({
      ground: z.enum(APPEAL_GROUNDS),
      evidenceNeeded: z.string().describe("What evidence would support this ground, plain English"),
    })
  ),
  reasoningText: z
    .string()
    .describe("Plain-English explanation of the rating — never a bare score with no reasoning"),
  draftText: z
    .string()
    .describe(
      "A complete, editable draft appeal letter the user can review, edit, and submit " +
        "themselves. Address it generically (e.g. 'Dear Sir/Madam') since we don't always " +
        "know the exact adjudicator. Reference the specific case facts provided."
    ),
});

export type AppealAssessment = z.infer<typeof AssessmentSchema>;

/** Which adjudicator has the final say — for the mandatory disclaimer (Part 2.4). */
export function getAdjudicatorName(issuerType: string | null): string {
  switch (issuerType) {
    case "tfl_pcn":
    case "congestion_charge":
    case "ulez":
      return "London Tribunals";
    case "private_pcn":
      return "POPLA or IAS";
    default:
      return "the Traffic Penalty Tribunal (or London Tribunals, if the issuing authority is in London)";
  }
}

/** The mandatory copy Part 2.4 requires alongside every assessment. */
export function mandatoryDisclaimer(strength: string, issuerType: string | null): string {
  const label = strength.charAt(0).toUpperCase() + strength.slice(1);
  return `Appeal strength: ${label}. This is our assessment based on the evidence provided, not a guarantee. ${getAdjudicatorName(issuerType)} makes the final decision.`;
}

export function groundLabel(ground: AppealGround): string {
  return GROUND_LABELS[ground];
}

type CaseContext = {
  issuerType: string | null;
  issuerName: string | null;
  contraventionCode: string | null;
  locationText: string | null;
  eventDatetime: string | null;
  amountFull: number | null;
  amountDiscounted: number | null;
  vrm: string;
  evidenceTypes: string[];
};

const SYSTEM_PROMPT = `You assess UK parking/traffic penalty notice (PCN) appeals for Planal. Reason over these grounds only — do not invent grounds outside this list: ${APPEAL_GROUNDS.map((g) => GROUND_LABELS[g]).join(" · ")}.

Rules, non-negotiable:
- Never claim a guaranteed outcome. The adjudicator/tribunal always makes the final decision, not you.
- Never give a bare strength rating without plain-English reasoning explaining why.
- Only cite grounds that are actually plausible given the case facts provided — don't pad the list.
- For each applicable ground, state what evidence would support it, and be honest if that evidence hasn't been provided yet.
- The draft you write is for the user to review, edit, and submit themselves — never write as if you are submitting it, never address it as if the submission has already happened.
- If the facts given are too thin to assess properly, say so plainly in reasoningText and rate conservatively (weak) rather than inventing supporting detail.`;

/**
 * Assesses appeal strength and drafts appeal text. Returns null if no API
 * key is configured — callers should treat that as "not assessed yet",
 * never as an error blocking the case.
 */
export async function assessAppeal(ctx: CaseContext): Promise<AppealAssessment | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new Anthropic({ apiKey });

  const facts = `
Vehicle registration: ${ctx.vrm}
Issuer type: ${ctx.issuerType ?? "unknown"}
Issuer name: ${ctx.issuerName ?? "unknown"}
Contravention code: ${ctx.contraventionCode ?? "not recorded"}
Location: ${ctx.locationText ?? "not recorded"}
Event date/time: ${ctx.eventDatetime ?? "not recorded"}
Full amount: ${ctx.amountFull != null ? `£${ctx.amountFull}` : "not recorded"}
Discounted amount: ${ctx.amountDiscounted != null ? `£${ctx.amountDiscounted}` : "not recorded"}
Evidence already uploaded: ${ctx.evidenceTypes.length > 0 ? ctx.evidenceTypes.join(", ") : "none yet"}
`.trim();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(AssessmentSchema) },
      messages: [{ role: "user", content: `Assess this case:\n\n${facts}` }],
    });

    return response.parsed_output;
  } catch (err) {
    console.error("Appeal assessment failed", err);
    return null;
  }
}
