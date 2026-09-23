"use client";

import { useActionState, useRef, useState } from "react";
import { addManualCaseAction, type CaseActionState } from "@/app/dashboard/cases/actions";

const initialState: CaseActionState = undefined;

/** Home screen capture entry (build brief section 7 screen 1): a large
 * "Photograph your ticket" button (native camera on mobile via
 * capture="environment") plus "Upload a letter or PDF instead". Picking a
 * file reveals a vehicle picker inline rather than as a separate form
 * field shown up front — the ticket comes first, per the brief's capture
 * flow, not the vehicle. */
export function TicketCaptureForm({ vehicles }: { vehicles: { id: string; vrm: string }[] }) {
  const [state, formAction, pending] = useActionState(addManualCaseAction, initialState);
  const [fileChosen, setFileChosen] = useState(false);
  const [fileName, setFileName] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenFileHolder = useRef<HTMLInputElement>(null);

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileChosen(true);
    // Both the camera input and the plain file input feed the same hidden
    // "ticket" field the form actually submits, so addManualCaseAction
    // doesn't need to know which button was used.
    if (hiddenFileHolder.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      hiddenFileHolder.current.files = dt.files;
    }
  }

  if (vehicles.length === 0) {
    return (
      <div className="rounded-2xl border border-planal-border bg-planal-surface p-5 text-sm text-planal-ink-muted">
        Add and verify a vehicle first, then come back here to photograph a ticket.{" "}
        <a href="/dashboard/vehicles" className="font-semibold text-planal-brand">
          Add a vehicle →
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input ref={hiddenFileHolder} type="file" name="ticket" required className="hidden" />

      {!fileChosen ? (
        <div className="space-y-3">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFilePicked}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-planal-brand px-4 py-4 text-[17px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            📷 Photograph your ticket
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={onFilePicked}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border border-planal-border bg-planal-surface px-4 py-3.5 text-[15px] font-medium text-planal-ink hover:bg-planal-bg"
          >
            Upload a letter or PDF instead
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-planal-border bg-planal-surface p-4">
          <p className="text-sm text-planal-ink-muted">
            Ready to send: <span className="font-medium text-planal-ink">{fileName}</span>
          </p>

          <label className="block text-sm font-medium text-planal-ink">
            Which vehicle is this for?
            <select
              name="vehicleId"
              required
              defaultValue=""
              className="mt-1.5 w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-[15px] text-planal-ink focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint"
            >
              <option value="" disabled>
                Choose a vehicle
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vrm}
                </option>
              ))}
            </select>
          </label>

          {state && "error" in state && <p className="text-sm text-planal-danger-text">{state.error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setFileChosen(false);
                setFileName("");
              }}
              className="rounded-xl border border-planal-border px-4 py-2.5 text-sm font-medium text-planal-ink-muted hover:bg-planal-bg"
            >
              Retake
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-2xl bg-planal-brand px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Reading your ticket…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
