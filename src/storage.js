// GoreeCloud Notebook local storage. All note content remains in this browser profile.
const DB_NAME = "goreecloud-notebook-v1";
const STORE = "app";
let dbPromise;

export class StorageConflictError extends Error {
  constructor() {
    super("Another Notebook tab changed this workspace. Export your unsaved changes, then reload to review the newer version.");
    this.name = "StorageConflictError";
    this.code = "NOTEBOOK_STORAGE_CONFLICT";
  }
}

function revisionOf(snapshot) {
  return Number.isSafeInteger(snapshot?.revision) && snapshot.revision >= 0 ? snapshot.revision : 0;
}

function database() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("This browser does not support offline storage."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error("Database unavailable"));
    req.onblocked = () => reject(new Error("Close other Notebook tabs, then retry."));
  }).catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}

export async function readState() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get("snapshot");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Could not read your notebook."));
  });
}

// Atomic compare-and-swap prevents a stale tab from replacing newer edits.
// Legacy v1 snapshots without a revision are treated as revision zero.
const RECOVERY_KEY = "pre-import-recovery";

// Return the last workspace replaced by an import or a recovery. This is local plaintext
// stored in the same browser profile, not a substitute for an external backup.
export async function readRecoveryState() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(RECOVERY_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Could not read the import recovery checkpoint."));
  });
}

async function persistState(state, expectedRevision, preserveCurrent = false) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error("Saving requires a valid expected revision.");
  }
  const db = await database();
  return new Promise((resolve, reject) => {
    let settled = false;
    let nextRevision;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error || new Error("Saving was interrupted."));
    };
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const read = store.get("snapshot");
    read.onsuccess = () => {
      const actual = revisionOf(read.result);
      if (actual !== expectedRevision) {
        fail(new StorageConflictError());
        tx.abort();
        return;
      }
      nextRevision = actual + 1;
      if (preserveCurrent && read.result) store.put(read.result, RECOVERY_KEY);
      store.put({ ...state, revision: nextRevision }, "snapshot");
    };
    read.onerror = () => fail(read.error || new Error("Could not check the current revision."));
    tx.oncomplete = () => {
      if (!settled) { settled = true; resolve(nextRevision); }
    };
    tx.onerror = () => fail(tx.error || new Error("Storage transaction failed."));
    tx.onabort = () => fail(tx.error || new Error("Storage transaction was aborted."));
  });
}

// Ordinary autosaves do not duplicate the entire workspace in recovery storage.
export function writeState(state, expectedRevision) {
  return persistState(state, expectedRevision, false);
}

// A whole-workspace replacement captures the previous snapshot in the SAME
// IndexedDB transaction, then writes the imported or restored version. Failed
// transactions leave both keys unchanged.
export function replaceStateWithRecovery(state, expectedRevision) {
  return persistState(state, expectedRevision, true);
}
