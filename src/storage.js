// Only IndexedDB is used: nothing is sent to a server or third-party service.
const DB_NAME = "goreecloud-notebook-v1";
const STORE = "app";
let dbPromise;
function database() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("This browser does not support offline storage."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Database unavailable"));
    req.onblocked = () => reject(new Error("Close other Notebook tabs, then retry."));
  });
  return dbPromise;
}
export async function readState() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get("snapshot");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
export async function writeState(state) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, "snapshot");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Saving was interrupted"));
  });
}
