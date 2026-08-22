import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Claude API OCR/extraction for manually uploaded PCN photos/PDFs. Per
// Part 6 of PLANAL_MASTER_PLAN.md. Returns null if no API key is
// configured — callers should treat that as "no extraction yet available",
// never as a blocking error (a case can exist with fields filled in later,
// manually or on retry).

const ISSUER_TYPES = [
  "council_pcn",
  "tfl_pcn",
  "congestion_charge",
  "ulez",
  "dart_charge",
  "private_pcn",
  "bus_lane",
  "moving_traffic",
] as const;

const PcnExtractionSchema = z.object({
  issuerName: z.string().nullable(),
  issuerType: z.enum(ISSUER_TYPES).nullable(),
  referenceNumber: z.string().nullable(),
  contraventionCode: z.string().nullable(),
  locationText: z.string().nullable(),
  eventDatetime: z
    .string()
    .nullable()
    .describe("ISO 8601 datetime the contravention occurred, if stated"),
  noticeDate: z
    .string()
    .nullable()
    .describe(
      "ISO 8601 date (YYYY-MM-DD) the notice itself was issued/served — often labelled " +
        "'date of issue' or similar. This is usually a different, later date than " +
        "eventDatetime, especially on postal notices. This is the date deadlines are " +
        "legally counted from, so extract it carefully and separately from eventDatetime."
    ),
  amountFull: z.number().nullable().describe("Full penalty amount in GBP"),
  amountDiscounted: z.number().nullable().describe("Early-payment discounted amount in GBP, if stated"),
  discountDeadline: z
    .string()
    .nullable()
    .describe("ISO 8601 date (YYYY-MM-DD), only if a specific deadline date is explicitly printed on the notice"),
  finalDeadline: z
    .string()
    .nullable()
    .describe("ISO 8601 date (YYYY-MM-DD), only if a specific deadline date is explicitly printed on the notice"),
});

export type PcnExtraction = z.infer<typeof PcnExtractionSchema>;

const PROMPT = `This is a photo or PDF of a UK parking or traffic penalty notice (PCN). Extract the fields defined by the schema. Use null for any field that isn't legible or isn't present on the document — never guess or invent a value, and never calculate a deadline yourself: only fill discountDeadline/finalDeadline if a specific date is explicitly printed on the notice, not if you'd have to work it out from other dates. eventDatetime (when the contravention happened) and noticeDate (when the notice was issued/served) are usually different dates — extract each separately from wherever it actually appears on the document, don't assume they're the same. Amounts are in GBP as plain numbers (e.g. 70, not "£70"). Dates are ISO 8601.`;

export async function extractPcnFromFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<PcnExtraction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new Anthropic({ apiKey });
  const base64Data = fileBuffer.toString("base64");

  const contentBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam =
    mimeType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64Data,
          },
        };

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: { format: zodOutputFormat(PcnExtractionSchema) },
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: PROMPT }],
        },
      ],
    });

    return response.parsed_output;
  } catch (err) {
    console.error("PCN OCR extraction failed", err);
    return null;
  }
}
