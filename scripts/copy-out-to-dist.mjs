import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

if (!existsSync("out")) {
  throw new Error("Expected Next static export output directory: out");
}

await rm("dist", { recursive: true, force: true });
await cp("out", "dist", { recursive: true });
