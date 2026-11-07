import test from "node:test";
import assert from "node:assert/strict";
import { makeNote, MAX_IMPORT_BYTES } from "../src/model.js";
import { createBackup, importBackup, MAX_GZIP_RESTORE_BYTES } from "../src/backup.js";

const named = (blob, name, type = blob.type) => Object.assign(
  new Blob([blob], { type }), { name }
);

test("small backups remain standard compatible JSON", async () => {
  const original = [makeNote({ id: "small001", title: "Portable" })];
  const backup = await createBackup(original);
  assert.equal(backup.extension, ".json");
  assert.equal(backup.restorable, true);
  const decoded = await importBackup(named(backup.blob, "notebook.json"));
  assert.equal(decoded.notes[0].title, "Portable");
});

test("gzip allows restoring backups larger than the previous 22 MB JSON ceiling", async () => {
  if (typeof CompressionStream !== "function" || typeof DecompressionStream !== "function") {
    return; // Node 22 and current Chromium provide this API.
  }
  const body = "GoreeCloud local knowledge. ".repeat(38000); // ~1 MB, safely under per-note limit?
  const safeBody = body.slice(0, 955000);
  const originals = Array.from({ length: 25 }, (_, i) => ({
    ...makeNote({ id: "note_" + String(i).padStart(5, "0"), title: "Large note " + i }),
    body: safeBody
  }));
  const backup = await createBackup(originals);
  assert.equal(backup.extension, ".json.gz");
  assert.equal(backup.restorable, true);
  assert.ok(backup.blob.size < MAX_IMPORT_BYTES);
  const restored = await importBackup(named(backup.blob, "large.json.gz", "application/gzip"));
  assert.equal(restored.notes.length, originals.length);
  assert.equal(restored.notes[24].body, safeBody);
  assert.equal(restored.notes[3].id, originals[3].id);
});

test("invalid gzip, truncated gzip, and oversized plain JSON are rejected", async () => {
  await assert.rejects(
    importBackup(named(new Blob(["not gzip"]), "false.json.gz")),
    /valid gzip/
  );
  await assert.rejects(
    importBackup(named(new Blob(["{".repeat(MAX_IMPORT_BYTES + 1)]), "too-big.json")),
    /22 MB/
  );
  if (typeof DecompressionStream === "function") {
    await assert.rejects(
      importBackup(named(new Blob([new Uint8Array([0x1f, 0x8b, 0x08])]), "broken.gz", "application/gzip"))
    );
  }
});

test("decompressed-size limit is fixed to prevent gzip bombs", () => {
  assert.equal(MAX_GZIP_RESTORE_BYTES, 64_000_000);
});

test("gzip decompression refuses data beyond the 64 MB restore ceiling", async () => {
  if (typeof CompressionStream !== "function" || typeof DecompressionStream !== "function") return;
  // Repetitive content makes a small gzip container expanding beyond the limit.
  const huge = new Blob([" ".repeat(MAX_GZIP_RESTORE_BYTES + 8192)]);
  const zipped = await new Response(huge.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  assert.ok(zipped.size < 100_000, "Expected highly compressible test fixture");
  await assert.rejects(importBackup(named(zipped, "bomb.json.gz", "application/gzip")), /64 MB restore limit/);
});

test("gzip does not bypass per-note snapshot validation", async () => {
  if (typeof CompressionStream !== "function" || typeof DecompressionStream !== "function") return;
  const invalid = JSON.stringify({
    version: 1, notes: [{ ...makeNote({ id: "badbody1" }), body: "x".repeat(1_000_001) }]
  });
  const zipped = await new Response(new Blob([invalid]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
  await assert.rejects(importBackup(named(zipped, "invalid.json.gz", "application/gzip")), /Invalid note body/);
});

test("gzip failures retain a readable plaintext export and warn it cannot be reimported", async () => {
  if (typeof CompressionStream !== "function" || typeof DecompressionStream !== "function") return;
  const originals = Array.from({ length: 24 }, (_, i) => ({
    ...makeNote({ id: "fallback_" + String(i).padStart(4, "0") }),
    body: "Y".repeat(950_000)
  }));
  const originalConstructor = globalThis.CompressionStream;
  globalThis.CompressionStream = class {
    constructor() { throw new Error("Simulated compression failure"); }
  };
  try {
    const backup = await createBackup(originals);
    assert.equal(backup.extension, ".json");
    assert.equal(backup.restorable, false);
    assert.match(backup.reason, /compression failed/i);
    assert.ok(backup.blob.size > MAX_IMPORT_BYTES);
    const decoded = JSON.parse(await backup.blob.text());
    assert.equal(decoded.notes.length, 24);
  } finally {
    globalThis.CompressionStream = originalConstructor;
  }
});
