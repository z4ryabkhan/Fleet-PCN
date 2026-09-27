// UI review item 7: no emoji icons — real SVG, sized to inherit
// currentColor so they follow text colour/contrast rules automatically.
// Each is 20x20 by default; pass className to resize.

type IconProps = { className?: string };

export function CameraIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.5 4.5 5.7 6H3.5A1.5 1.5 0 0 0 2 7.5v7A1.5 1.5 0 0 0 3.5 16h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 16.5 6h-2.2l-.8-1.5A1 1 0 0 0 12.6 4H7.4a1 1 0 0 0-.9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.5" r="2.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function FolderIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 6a1 1 0 0 1 1-1h3.4l1.2 1.5H16a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="6.75" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.5 16c.6-2.8 2.9-4.5 5.5-4.5s4.9 1.7 5.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 2.5 18 16.5H2L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 8v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function DocumentCheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 2.5h5.5L15 6v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7.5 11 9.3 12.8 12.7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SendIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M17.5 2.5 2.5 8.8l5.4 2.1M17.5 2.5 11.3 17.5l-3.4-6.6M17.5 2.5 7.9 10.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
