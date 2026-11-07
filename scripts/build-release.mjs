// Safe, allowlisted static Notebook distribution. No test suites or private data.
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const files = Object.freeze([
  "LICENSE",
  "licenses/GC-UI-APACHE-2.0.txt",
  "THIRD_PARTY_NOTICES.md",
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets/gc-ui-foundations.v1.css",
  "assets/styles.css",
  "assets/icon.svg",
  "src/app.js",
  "src/tables.js",
  "src/templates.js",
  "src/formatting.js",
  "src/model.js",
  "src/storage.js",
  "src/backup.js"
]);

// Never clear a previous build that may have been inspected or modified by its owner.
if (existsSync(output)) {
  throw new Error("dist/ already exists. Preserve or manually rename it before generating a new release package.");
}
const staging = mkdtempSync(join(root, ".notebook-dist-staging-"));
try {
  for (const file of files) {
    const from = resolve(root, file);
    if (!from.startsWith(root + sep) || !lstatSync(from).isFile()) {
      throw new Error("Unsupported or missing static source file: " + file);
    }
    const target = resolve(staging, file);
    if (!target.startsWith(staging + sep)) throw new Error("Unsafe target path");
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(from, target);
  }
  renameSync(staging, output);
  console.log("GoreeCloud Notebook static release candidate staged to dist/ (" + files.length + " allowlisted files).");
  console.log("This build was not deployed or certified for production.");
} catch (error) {
  // Cleanup is limited to the unique staging directory created by this process.
  rmSync(staging, { recursive: true, force: true });
  throw error;
}
