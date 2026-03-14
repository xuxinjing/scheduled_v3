import { readFile } from "node:fs/promises";
import path from "node:path";

import { SettingsEditor } from "@/components/settings-editor";

export default async function SettingsPage() {
  const kitchenStateContent = await readFile(path.join(process.cwd(), "data", "kitchen_state.md"), "utf8");
  return <SettingsEditor kitchenStateContent={kitchenStateContent} />;
}
