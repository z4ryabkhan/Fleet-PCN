"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SettingsActionState = { error: string } | { success: string } | undefined;

// Completes Part 2.3's "notification preferences" — see migration
// 0026_notification_preferences.sql for why sms_reminders_enabled is a
// separate opt-in from just having a phone number on file. RLS ("users
// can update their own profile", 0002) already scopes this to the
// caller's own row; no extra authorization check needed here.
export async function updateNotificationSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const fullName = String(formData.get("fullName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const smsRemindersEnabled = formData.get("smsRemindersEnabled") === "true";

  if (smsRemindersEnabled && !phone) {
    return { error: "Add a phone number to enable SMS reminders." };
  }

  const { error } = await supabase
    .from("users")
    .update({
      full_name: fullName || null,
      phone: phone || null,
      sms_reminders_enabled: smsRemindersEnabled,
    })
    .eq("id", user.id);

  if (error) return { error: "Could not save your settings. Please try again." };

  revalidatePath("/dashboard/settings");
  return { success: "Settings saved." };
}
