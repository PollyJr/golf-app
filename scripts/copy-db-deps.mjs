// Makes the database scripts (db/migrate.mjs, db/bootstrap.mjs) runnable in
// the production image.
//
// The image only ships Next's standalone output. Its node_modules is a traced
// subset: enough for the server, with no promise that a script outside the
// app finds every file it imports. This copies the complete `pg` package and
// everything it depends on into the standalone node_modules, then proves the
// scripts' imports resolve from there.
//
//   node scripts/copy-db-deps.mjs [--target .next/standalone]
import { access, cp, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const ROOT_PACKAGES = ["pg"];
const root = process.cwd();
const targetFlag = process.argv.indexOf("--target");
const target = path.resolve(root, targetFlag >= 0 ? process.argv[targetFlag + 1] : ".next/standalone");

const exists = (file) => access(file).then(() => true, () => false);

if (!(await exists(target))) {
  console.error(`copy-db-deps: ${target} does not exist. Run "npm run build" first.`);
  process.exit(1);
}

/** Every package reachable from the roots through (optional) dependencies. */
async function closure(names) {
  const found = new Map();
  const queue = names.map((name) => ({ name, optional: false }));
  while (queue.length > 0) {
    const { name, optional } = queue.shift();
    if (found.has(name)) continue;
    const directory = path.join(root, "node_modules", name);
    if (!(await exists(path.join(directory, "package.json")))) {
      // Optional packages (other platforms, alternative runtimes) may be absent.
      if (optional) continue;
      throw new Error(`Dependency "${name}" is not installed`);
    }
    found.set(name, directory);
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) queue.push({ name: dependency, optional: false });
    for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) queue.push({ name: dependency, optional: true });
  }
  return found;
}

const packages = await closure(ROOT_PACKAGES);
await mkdir(path.join(target, "node_modules"), { recursive: true });
for (const [name, directory] of packages) {
  await cp(directory, path.join(target, "node_modules", name), { recursive: true, force: true, dereference: true });
}

// Resolve exactly as db/*.mjs will in the image: from a file next to node_modules.
const requireFromTarget = createRequire(path.join(target, "db", "check.mjs"));
for (const name of ROOT_PACKAGES) {
  const loaded = requireFromTarget(name);
  if (name === "pg" && typeof loaded.Pool !== "function") throw new Error("pg was copied but does not load correctly");
}

console.log(`copy-db-deps: ${packages.size} packages available to the database scripts (${[...packages.keys()].join(", ")}).`);
