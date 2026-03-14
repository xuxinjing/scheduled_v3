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
          <div className="relative flex h-full bg-white">
            <aside className="relative hidden h-full w-[240px] flex-shrink-0 overflow-hidden md:block">
              <div className="flex h-full w-full flex-col bg-[var(--tenant-sidebar-bg)] tenant-shell">
                <div className="flex items-center justify-between px-4 pb-2 pt-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h1 className="whitespace-nowrap text-sm font-semibold text-[#0e1940]">Acquerello Scheduled</h1>
                      <p className="text-[11px] text-slate-500">Kitchen operations</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
                  <div className="flex flex-col gap-2 md:pl-1 md:pr-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} className="sidebar-link">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Icon className="h-4 w-4 text-slate-500" />
                            <span>{item.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-auto p-3">
                  <div className="text-[11px] text-slate-500">Powered by Engagement AI</div>
                </div>
              </div>
            </aside>

            <main className="relative h-full flex-1 overflow-hidden bg-[#f5f5f4]">
              <div className="absolute left-0 top-0 z-50 w-full bg-white">
                <div className="flex h-14 w-full items-center justify-between px-4 md:px-5" />
              </div>

              <div className="relative z-10 h-full overflow-y-auto pt-12 2xl:pt-14">
                <div className="mx-auto flex min-h-full w-full flex-col md:max-w-[95%] 2xl:w-[80%]">
                  <div className="flex-1 pb-6">{children}</div>
                </div>
              </div>
            </main>
          </div>
        </section>
      </body>
    </html>
  );
}
