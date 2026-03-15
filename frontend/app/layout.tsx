import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, History, MessageSquarePlus, Settings } from "lucide-react";

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
      <body>
        <section className="app-container overflow-x-hidden">
          <div className="relative flex h-full">
            {/* Desktop sidebar */}
            <aside className="relative hidden h-full w-[220px] flex-shrink-0 md:block">
              <div className="flex h-full w-full flex-col bg-[var(--tenant-sidebar-bg)] tenant-shell">
                <div className="px-4 pb-3 pt-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[hsl(var(--primary))] text-white">
                      <Calendar className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      <h1 className="text-[13px] font-semibold text-[#1d1d1f]">Acquerello</h1>
                      <p className="text-[11px] text-[#86868b]">Scheduled</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2.5 pb-4 pt-2">
                  <div className="flex flex-col gap-0.5">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} className="sidebar-link">
                          <div className="flex items-center gap-2.5 text-[13px] text-[#1d1d1f]">
                            <Icon className="h-[18px] w-[18px] text-[#86868b]" strokeWidth={1.6} />
                            <span>{item.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <div className="text-[11px] text-[#86868b]">Powered by Engagement AI</div>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="relative h-full flex-1 overflow-hidden bg-[#f5f5f7]">
              <div className="relative z-10 h-full overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full flex-col px-4 md:max-w-[96%] md:px-0 2xl:max-w-[860px]">
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
