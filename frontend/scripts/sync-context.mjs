import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const dataDir = path.join(frontendRoot, "data");

await mkdir(dataDir, { recursive: true });

const files = [
  ["kitchen_state.md", "kitchen_state.md"],
  ["CONSTRAINT_TYPES.md", "constraint_types.md"],
  ["week_config.json", "week_config.json"],
  ["week_constraints.md", "week_constraints.md"],
];

await Promise.all(
  files.map(([source, target]) =>
    copyFile(path.join(repoRoot, source), path.join(dataDir, target)),
  ),
);
