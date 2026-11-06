// Portable JSON and standard gzip-compressed JSON backups (no remote services).
// Keep the plain-JSON import limit for low-memory devices. Large backups may
// use gzip, but the uncompressed JSON is still bounded before JSON.parse.
import { MAX_IMPORT_BYTES, exportSnapshot, supportedBackupSize, validateSnapshot } from "./model.js";

export const MAX_GZIP_RESTORE_BYTES = 64_000_000;
export const MAX_GZIP_FILE_BYTES = 66_000_000;

const hasGzipSupport = () =>
  typeof CompressionStream === "function" && typeof DecompressionStream === "function";

export async function createBackup(notes) {
  const json = new Blob([exportSnapshot(notes)], { type: "application/json" });
  if (supportedBackupSize(json.size)) {
    return { blob: json, extension: ".json", restorable: true };
  }

  // Even on browsers without CompressionStream, the owner can still export
  // a plain-text backup for manual recovery; never quietly throw notes away.
  if (!hasGzipSupport()) {
    return { blob: json, extension: ".json", restorable: false,
      reason: "This browser does not support gzip backups. The JSON export exceeds the 22 MB import limit." };
  }
  const compressed = await new Response(json.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  const restorable = json.size <= MAX_GZIP_RESTORE_BYTES && compressed.size <= MAX_GZIP_FILE_BYTES;
  return { blob: new Blob([compressed], { type: "application/gzip" }),
    extension: ".json.gz", restorable,
    reason: restorable ? "" : "This workspace exceeds the 64 MB decompressed-backup restore limit." };
}

async function decodeGzip(file) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser does not support gzip restore. Use a compatible browser or decompress it locally first.");
  }
  if (file.size > MAX_GZIP_FILE_BYTES) {
    throw new Error("Compressed backup exceeds the 66 MB input limit.");
  }
  const reader = file.stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  const fragments = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_GZIP_RESTORE_BYTES) {
        throw new Error("Decompressed backup exceeds the 64 MB restore limit.");
      }
      fragments.push(decoder.decode(value, { stream: true }));
    }
    fragments.push(decoder.decode());
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return validateSnapshot(JSON.parse(fragments.join("")));
}

export async function importBackup(file) {
  if (!file || typeof file.size !== "number" || typeof file.slice !== "function") {
    throw new Error("Select a valid Notebook backup file.");
  }
  const compressed = /\.gz$/i.test(file.name || "") || file.type === "application/gzip";
  if (compressed) {
    const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (header.length !== 2 || header[0] !== 0x1f || header[1] !== 0x8b) {
      throw new Error("Not a valid gzip file.");
    }
    return decodeGzip(file);
  }
  if (!supportedBackupSize(file.size)) {
    throw new Error("JSON backup exceeds 22 MB. Use a compressed .json.gz backup for larger workspaces.");
  }
  return validateSnapshot(JSON.parse(await file.text()));
}
