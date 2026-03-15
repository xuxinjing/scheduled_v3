import type { Metadata } from "next";
import Link from "next/link";
import { History, MessageSquarePlus, Settings } from "lucide-react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Acquerello Scheduled",
  description: "Voice-first kitchen scheduling workflow",
};

const navItems = [
  { href: "/", label: "New Chat", icon: MessageSquarePlus },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
      </head>
      <body>
        <section className="app-container overflow-x-hidden">
          <div className="relative flex h-full">
            {/* Desktop sidebar — ChatGPT style */}
            <aside className="relative hidden h-full w-[260px] flex-shrink-0 md:block">
              <div className="flex h-full w-full flex-col bg-[var(--chatgpt-sidebar-bg)] tenant-shell">
                {/* New chat button */}
                <div className="px-3 pt-3">
                  <Link
                    href="/"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[var(--chatgpt-text)] transition-colors hover:bg-[var(--chatgpt-hover)]"
                  >
                    <MessageSquarePlus className="h-5 w-5" strokeWidth={1.8} />
                    <span>New chat</span>
                  </Link>
                </div>

                {/* Nav items */}
                <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
                  <div className="flex flex-col gap-0.5">
                    {navItems.slice(1).map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} className="sidebar-link">
                          <Icon className="h-[18px] w-[18px] text-[var(--chatgpt-text-secondary)]" strokeWidth={1.8} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[var(--chatgpt-border)] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chatgpt-green)] text-white text-[13px] font-semibold">
                      A
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--chatgpt-text)]">Acquerello</p>
                      <p className="text-[11px] text-[var(--chatgpt-text-secondary)]">Scheduled</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="relative h-full flex-1 overflow-hidden bg-white">
              <div className="relative z-10 h-full overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full flex-col">
                  <div className="flex-1">{children}</div>
                </div>
              </div>
            </main>
          </div>
        </section>
      </body>
    </html>
  );
}
