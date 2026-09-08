// Humanises audit_log.action for the case Activity log (Part 4 rule 7:
// "Audit log every access to a vehicle's case data — actor, action,
// timestamp"). Keep this in sync with the action strings the trigger
// functions in supabase/migrations actually write — there's no shared
// enum between SQL and TypeScript, so a new logged action needs a label
// added here too, or it just falls back to the raw snake_case string.
const ACTION_LABELS: Record<string, string> = {
  case_created: "Case created",
  case_updated: "Case details updated",
  case_deleted: "Case deleted",
  case_viewed: "Case viewed",
  appeal_created: "AI appeal assessment generated",
  appeal_updated: "Appeal updated",
  appeal_deleted: "Appeal deleted",
  evidence_added: "Evidence uploaded",
  evidence_updated: "Evidence updated",
  evidence_deleted: "Evidence deleted",
  gmail_appeal_draft_created: "Appeal draft pushed to Gmail",
  case_charge_created: "Payment record created",
  case_charge_updated: "Payment status updated",
};

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}
