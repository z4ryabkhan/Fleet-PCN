import Link from "next/link";
import { CameraIcon, FolderIcon, UserIcon } from "@/components/ui/icons";

// Brief section 7 screen 1: bottom nav (Cases, centre capture button,
// Account). Fixed to the viewport bottom, mobile-first — desktop users on
// the fleet dashboard (a separate screen per brief section 7 screen 4)
// don't see this.
//
// UI review item 7: SVG icons, not emoji. The centre button links to /try
// (the photo-first capture flow), not /dashboard — its label promises
// "photograph a new ticket", so it should go straight there.
export function BottomNav({ active }: { active: "cases" | "account" }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-planal-border bg-planal-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around px-6 py-2">
        <Link
          href="/dashboard/cases"
          className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand ${
            active === "cases" ? "text-planal-brand" : "text-planal-ink-muted"
          }`}
        >
          <FolderIcon className="h-5 w-5" />
          Cases
        </Link>

        <Link
          href="/try"
          aria-label="Photograph a new ticket"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-planal-brand text-white shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
        >
          <CameraIcon className="h-6 w-6" />
        </Link>

        <Link
          href="/dashboard/settings"
          className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand ${
            active === "account" ? "text-planal-brand" : "text-planal-ink-muted"
          }`}
        >
          <UserIcon className="h-5 w-5" />
          Account
        </Link>
      </div>
    </nav>
  );
}
