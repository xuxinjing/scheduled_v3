import { readFile } from "node:fs/promises";
import path from "node:path";

import { SettingsEditor } from "@/components/settings-editor";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const kitchenStateContent = await readFile(path.join(process.cwd(), "data", "kitchen_state.md"), "utf8");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Stable restaurant information lives here: roster, station structure, email defaults, and baseline week data.
          </CardDescription>
        </CardHeader>
      </Card>
      <SettingsEditor kitchenStateContent={kitchenStateContent} />
    </div>
  );
}
