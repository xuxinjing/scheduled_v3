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
      <body className="grain">
        <div className="mx-auto min-h-screen max-w-[1680px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/60 bg-white/70 px-5 py-4 shadow-panel backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[hsl(var(--muted-foreground))]">
                Acquerello Scheduling Engine
              </p>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[hsl(var(--foreground))]">
                Voice-first weekly scheduling
              </h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-[hsl(var(--border))] bg-white/80 px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
