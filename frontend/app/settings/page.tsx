import { readFile } from "node:fs/promises";
import path from "node:path";

import { SettingsEditor } from "@/components/settings-editor";

export default async function SettingsPage() {
  const kitchenStateContent = await readFile(path.join(process.cwd(), "data", "kitchen_state.md"), "utf8");
  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 pt-8">
      <div className="px-1">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#1d1d1f]">Settings</h1>
        <p className="mt-1 text-[15px] text-[#86868b]">
          Restaurant roster, station structure, email defaults, and baseline week data.
        </p>
      </div>
      <SettingsEditor kitchenStateContent={kitchenStateContent} />
    </div>
  );
}
