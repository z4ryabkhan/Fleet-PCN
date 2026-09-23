"use client";

import { useState, useActionState } from "react";
import { addEvidenceAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

export function EvidenceForm({ caseId, vehicleId }: { caseId: string; vehicleId: string }) {
  const [state, formAction, pending] = useActionState(addEvidenceAction, initialState);
  const [mayContainSpecialCategoryData, setMayContainSpecialCategoryData] = useState(false);

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-planal-border bg-planal-surface p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Add evidence</h2>
      <p className="text-sm text-planal-ink-muted">
        Photos, receipts, permits, Blue Badge, breakdown documents.
      </p>

      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <select
        name="evidenceType"
        required
        defaultValue=""
        className="w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-planal-ink focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint"
      >
        <option value="" disabled>
          Evidence type
        </option>
        <option value="receipt">Receipt</option>
        <option value="permit">Permit</option>
        <option value="blue_badge">Blue Badge</option>
        <option value="breakdown_doc">Breakdown document</option>
        <option value="other">Other</option>
      </select>

      <input
        name="file"
        type="file"
        required
        accept="application/pdf,image/*"
        className="w-full text-sm text-planal-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-planal-brand-tint file:px-3 file:py-2 file:text-sm file:font-medium file:text-planal-brand-dark hover:file:bg-planal-brand-tint-2"
      />

      <label className="flex items-start gap-2 text-sm text-planal-ink-muted">
        <input
          type="checkbox"
          name="mayContainSpecialCategoryData"
          value="true"
          checked={mayContainSpecialCategoryData}
          onChange={(e) => setMayContainSpecialCategoryData(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-planal-border"
        />
        This file may include health or medical information (e.g. supporting a medical
        mitigating-circumstances appeal)
      </label>

      {mayContainSpecialCategoryData && (
        <label className="flex items-start gap-2 rounded-xl border border-planal-amber-text/20 bg-planal-amber-bg p-3 text-sm text-planal-amber-text">
          <input type="checkbox" name="specialCategoryConsent" value="true" required className="mt-0.5 h-4 w-4" />
          I consent to Planal processing this health information, for the sole purpose of
          supporting my own appeal.
        </label>
      )}

      {state && "error" in state && <p className="text-sm text-planal-danger-text">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-planal-brand-dark">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-planal-border px-4 py-2 text-sm text-planal-ink-muted hover:bg-planal-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Add evidence"}
      </button>
    </form>
  );
}
