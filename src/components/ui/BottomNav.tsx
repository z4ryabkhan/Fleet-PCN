import Link from "next/link";

// Brief section 7 screen 1: bottom nav (Cases, centre "+" capture button,
// Account). Fixed to the viewport bottom, mobile-first — desktop users on
// the fleet dashboard (a separate screen per brief section 7 screen 4)
// don't see this.
export function BottomNav({ active }: { active: "cases" | "account" }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-planal-border bg-planal-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around px-6 py-2">
        <Link
          href="/dashboard/cases"
          className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-xs font-medium ${
            active === "cases" ? "text-planal-brand" : "text-planal-ink-muted"
          }`}
        >
          <span aria-hidden className="text-lg">🗂️</span>
          Cases
        </Link>

        <Link
          href="/dashboard"
          aria-label="Photograph a new ticket"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-planal-brand text-2xl text-white shadow-md"
        >
          +
        </Link>

        <Link
          href="/dashboard/settings"
          className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-xs font-medium ${
            active === "account" ? "text-planal-brand" : "text-planal-ink-muted"
          }`}
        >
          <span aria-hidden className="text-lg">👤</span>
          Account
        </Link>
      </div>
    </nav>
  );
}
