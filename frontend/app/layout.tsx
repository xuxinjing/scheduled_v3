import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Acquerello Scheduler",
  description: "Voice-first kitchen scheduling workflow",
};

const nav = [
  { href: "/", label: "Schedule" },
  { href: "/settings", label: "Settings" },
  { href: "/history", label: "History" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-5xl px-4 pb-8 pt-4 sm:px-6">
          <header className="mb-5 rounded-2xl border border-[hsl(var(--border))] bg-white">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    scheduled v3
                  </p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-2xl">
                    Acquerello Scheduler
                  </h1>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Voice-first weekly scheduling built for phone and tablet.
                  </p>
                </div>
              </div>
              <nav className="grid grid-cols-3 gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--secondary))]"
                >
                  {item.label}
                </Link>
              ))}
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
