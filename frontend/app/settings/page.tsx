import { readFile } from "node:fs/promises";
import path from "node:path";

import { SettingsEditor } from "@/components/settings-editor";

export default async function SettingsPage() {
  const kitchenStateContent = await readFile(path.join(process.cwd(), "data", "kitchen_state.md"), "utf8");
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 pt-8 md:px-0">
      <div className="content-panel rounded-[24px] p-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Settings</p>
        <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.04em] text-[#111827]">Restaurant operating model</h1>
        <p className="mt-2 max-w-[760px] text-[15px] leading-7 text-[#667085]">
          Stable restaurant information lives here: roster, station structure, email defaults, and baseline week data.
        </p>
      </div>
      <SettingsEditor kitchenStateContent={kitchenStateContent} />
    </div>
  );
}
