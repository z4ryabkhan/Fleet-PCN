import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// PDF pack export — build brief section 5's "Pre-filled PDF pack" send
// method, for issuers that only take post or a paper form. Combines the
// letter text (the same draft the email-send path uses) with every
// evidence file already on the case into one printable document, plus a
// short "print, sign, post" instructions page. No issuer directory exists
// yet (Phase 2 item), so the postal address is whatever the user has
// recorded against the case, or a placeholder telling them to fill it in
// themselves — never invented.

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export type PdfPackInput = {
  letterText: string;
  issuerName: string | null;
  postalAddress: string | null;
  vrm: string;
  referenceNumber: string | null;
  evidenceFiles: { bytes: Uint8Array; mimeType: string }[];
};

/** Builds the combined letter + evidence PDF and returns its bytes. */
export async function buildPdfPack(input: PdfPackInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // --- Page 1: instructions ---
  const instructionsPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  y = drawHeading(instructionsPage, boldFont, "Print, sign, and post", y);
  y -= 10;
  const instructions = [
    `This pack is for a PCN that ${input.issuerName ?? "the issuer"} only accepts by post or a paper form — not email.`,
    "",
    "1. Print every page of this document.",
    "2. Sign the letter on the last line, by hand, in ink.",
    "3. Attach copies of any evidence pages that follow (already included below).",
    "4. Post it to the address shown below. Keep a copy for your own records.",
    "",
    `Post to: ${input.postalAddress ?? "Address not recorded yet — check the notice itself or the issuer's website, then add it to this case."}`,
    "",
    "Nothing here has been sent on your behalf — Planal never posts anything for you.",
  ].join("\n");
  y = drawParagraph(instructionsPage, font, instructions, y);

  // --- Page(s): the letter itself ---
  let letterPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  y = PAGE_HEIGHT - MARGIN;
  y = drawHeading(
    letterPage,
    boldFont,
    `Re: ${input.referenceNumber ? `Notice ${input.referenceNumber}` : "Penalty notice"} — ${input.vrm}`,
    y
  );
  y -= 10;

  const lines = wrapText(input.letterText, font, 11, PAGE_WIDTH - MARGIN * 2);
  const lineHeight = 15;
  for (const line of lines) {
    if (y < MARGIN) {
      letterPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    letterPage.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.09, 0.09, 0.11) });
    y -= lineHeight;
  }

  // --- Evidence pages ---
  for (const file of input.evidenceFiles) {
    if (file.mimeType === "application/pdf") {
      const evidenceDoc = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const pages = await doc.copyPages(evidenceDoc, evidenceDoc.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
      continue;
    }

    const image =
      file.mimeType === "image/png" ? await doc.embedPng(file.bytes) : await doc.embedJpg(file.bytes);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const maxW = PAGE_WIDTH - MARGIN * 2;
    const maxH = PAGE_HEIGHT - MARGIN * 2;
    const scale = Math.min(maxW / image.width, maxH / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, {
      x: (PAGE_WIDTH - w) / 2,
      y: (PAGE_HEIGHT - h) / 2,
      width: w,
      height: h,
    });
  }

  return doc.save();
}

function drawHeading(page: PDFPage, font: PDFFont, text: string, y: number): number {
  page.drawText(text, { x: MARGIN, y, size: 15, font, color: rgb(0.06, 0.42, 0.36) });
  return y - 24;
}

function drawParagraph(page: PDFPage, font: PDFFont, text: string, y: number): number {
  const lines = wrapText(text, font, 11, PAGE_WIDTH - MARGIN * 2);
  for (const line of lines) {
    page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.09, 0.09, 0.11) });
    y -= 15;
  }
  return y;
}
