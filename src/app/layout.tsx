import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";

// Brand system per the approved mockup: Fraunces (700) for headlines/
// wordmark, Instrument Sans (400/500/600) for body. Both loaded as CSS
// variables so any element can opt into the headline face with
// font-[family-name:var(--font-fraunces)] without every heading needing a
// wrapper component.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Planal — Catch every PCN before the deadline",
  description:
    "Planal watches for parking and traffic penalty notices the moment they land, tracks deadlines, and helps you draft appeals — with you always in control before anything is submitted.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-planal-bg text-planal-ink">{children}</body>
    </html>
  );
}
