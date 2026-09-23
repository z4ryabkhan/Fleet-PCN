import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildPdfPack } from "@/lib/pdf-pack";

function guessMimeType(fileRef: string): string {
  const ext = fileRef.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg"; // jpg/jpeg, and a safe default for anything else
}

/** Build brief section 5: the "Pre-filled PDF pack" send method for
 * issuers that only accept post or a paper form. Streams a combined
 * letter + evidence PDF for the user to print, sign, and post themselves —
 * nothing here is ever sent on their behalf. */
export async function GET(_req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caseRow } = await supabase
    .from("cases")
    .select("issuer_name, reference_number, vehicles(vrm)")
    .eq("id", caseId)
    .single();
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vehicle = caseRow.vehicles as unknown as { vrm: string } | null;

  const { data: appeal } = await supabase
    .from("appeals")
    .select("draft_text, user_edited_text")
    .eq("case_id", caseId)
    .maybeSingle();

  const letterText =
    appeal?.user_edited_text ??
    appeal?.draft_text ??
    `To whom it may concern,\n\nI am writing regarding ${caseRow.reference_number ? `notice ${caseRow.reference_number}` : "the penalty notice"} issued against vehicle ${vehicle?.vrm ?? ""}. [No AI-drafted appeal exists yet for this case — add your own representations here before printing.]\n\nYours faithfully,`;

  const { data: evidenceRows } = await supabase
    .from("evidence")
    .select("file_ref")
    .eq("case_id", caseId)
    .order("uploaded_at", { ascending: true });

  const evidenceFiles: { bytes: Uint8Array; mimeType: string }[] = [];
  for (const row of evidenceRows ?? []) {
    const { data: blob, error } = await supabase.storage.from("case-evidence").download(row.file_ref);
    if (error || !blob) continue;
    evidenceFiles.push({
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: guessMimeType(row.file_ref),
    });
  }

  const pdfBytes = await buildPdfPack({
    letterText,
    issuerName: caseRow.issuer_name,
    postalAddress: null, // no issuer directory yet (Phase 2) — never fabricated
    vrm: vehicle?.vrm ?? "",
    referenceNumber: caseRow.reference_number,
    evidenceFiles,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="planal-appeal-${vehicle?.vrm ?? caseId}.pdf"`,
    },
  });
}
