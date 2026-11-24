// Next's standalone output does not include static assets. Copy them next to
// the standalone server so `node .next/standalone/server.js` serves a complete
// app, locally and in the Docker image alike.
import { cp, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

try {
  await access(standalone);
} catch {
  console.log("postbuild: no standalone output found, skipping asset copy.");
  process.exit(0);
}

await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
console.log("postbuild: copied static assets into .next/standalone.");
