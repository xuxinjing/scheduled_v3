import { readFile } from "node:fs/promises";
import path from "node:path";

async function readDataFile(name: string) {
  const filePath = path.join(process.cwd(), "data", name);
  return readFile(filePath, "utf8");
}

export async function loadSchedulingContext() {
  const [kitchenState, constraintTypes, baselineWeekConfig] = await Promise.all([
    readDataFile("kitchen_state.md"),
    readDataFile("constraint_types.md"),
    readDataFile("week_config.json"),
  ]);

  return {
    kitchenState,
    constraintTypes,
    baselineWeekConfig,
  };
}
