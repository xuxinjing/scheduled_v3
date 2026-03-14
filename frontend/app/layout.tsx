import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Acquerello Scheduler",
  description: "Voice-first kitchen scheduling workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-md bg-white sm:max-w-lg">{children}</div>
      </body>
    </html>
  );
}
