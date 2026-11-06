// Pure, dependency-free GoreeCloud Notebook domain model.
export const SCHEMA_VERSION = 1;
export const MAX_NOTES = 5000;
export const MAX_BODY_LENGTH = 1000000;
export const MAX_IMPORT_BYTES = 22_000_000;
const validTypes = new Set(["note", "task", "journal", "research", "meeting", "code"]);
const iso = () => new Date().toISOString();
const text = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
export function makeNote({ id, title = "Untitled note", parentId = null, type = "note" } = {}) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{4,128}$/.test(id)) throw new Error("Invalid note identifier");
  const time = iso();
  return { id, title: text(title, 180).replace(/[\r\n\t]+/g, " ").trim() || "Untitled note", body: "", parentId, type: validTypes.has(type) ? type : "note", tags: [], favorite: false, archived: false, trashed: false, completed: false, dueDate: "", createdAt: time, updatedAt: time };
}
export function childrenOf(notes, parentId) {
  return notes.filter(note => note.parentId === parentId && !note.trashed && !note.archived).sort((a, b) => a.title.localeCompare(b.title));
}
export function descendantsOf(notes, id) {
  const descendants = new Set(), queue = [id];
  while (queue.length) {
    const parent = queue.shift();
    for (const note of notes) if (note.parentId === parent && !descendants.has(note.id)) {
      descendants.add(note.id);
      queue.push(note.id);
    }
  }
  return descendants;
}
export function moveNote(notes, id, parentId) {
  if (!notes.some(note => note.id === id)) throw new Error("Note not found");
  if (parentId !== null && !notes.some(note => note.id === parentId)) throw new Error("Parent note not found");
  if (parentId === id || descendantsOf(notes, id).has(parentId)) throw new Error("Moving here would create a cycle");
  return notes.map(note => note.id === id ? { ...note, parentId, updatedAt: iso() } : note);
}
export function updateNote(notes, id, changes) {
  const allowed = ["title", "body", "tags", "favorite", "archived", "trashed", "completed", "dueDate", "type"];
  if (!notes.some(note => note.id === id)) throw new Error("Note not found");
  const patch = {};
  for (const field of allowed) if (Object.hasOwn(changes, field)) patch[field] = changes[field];
  if (patch.title !== undefined) patch.title = text(patch.title, 180).replace(/[\r\n\t]+/g, " ").trim() || "Untitled note";
  if (patch.body !== undefined) patch.body = text(patch.body, MAX_BODY_LENGTH);
  if (patch.tags !== undefined) patch.tags = Array.isArray(patch.tags) ? [...new Set(patch.tags.filter(t => typeof t === "string").map(t => t.trim().slice(0, 48)).filter(Boolean))].slice(0, 24) : [];
  if (patch.type !== undefined && !validTypes.has(patch.type)) throw new Error("Invalid note type");
  if (patch.dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dueDate) && patch.dueDate !== "") throw new Error("Invalid due date");
  for (const f of ["favorite", "archived", "trashed", "completed"]) if (patch[f] !== undefined) patch[f] = Boolean(patch[f]);
  return notes.map(note => note.id === id ? { ...note, ...patch, updatedAt: iso() } : note);
}
export function searchNotes(notes, query, view = "all") {
  const q = query.trim().toLocaleLowerCase();
  return notes.filter(note => {
    if (view === "trash") return note.trashed;
    if (note.trashed || (note.archived && view !== "archive")) return false;
    if (view === "favorites" && !note.favorite) return false;
    if (view === "tasks" && note.type !== "task") return false;
    if (view === "archive" && !note.archived) return false;
    return !q || [note.title, note.body, ...note.tags].some(value => value.toLocaleLowerCase().includes(q));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
// ID links remain valid when titles change; legacy [[Title]] links remain supported.
export function stableNoteLink(note) {
  if (!note || typeof note.id !== "string" || !/^[A-Za-z0-9_-]{4,128}$/.test(note.id)) throw new Error("Invalid note for linking");
  return "[[id:" + note.id + "]]";
}
export function resolveNoteLink(notes, reference) {
  const value = typeof reference === "string" ? reference.trim() : "";
  if (/^id:[A-Za-z0-9_-]{4,128}$/.test(value)) {
    return notes.find(note => !note.trashed && note.id === value.slice(3)) || null;
  }
  return notes.find(note => !note.trashed && note.title.toLocaleLowerCase() === value.toLocaleLowerCase()) || null;
}
export function backlinks(notes, target) {
  const idMarker = stableNoteLink(target).toLocaleLowerCase();
  const titleMarker = "[[" + target.title.toLocaleLowerCase() + "]]";
  return notes.filter(note => !note.trashed && note.id !== target.id && (
    note.body.toLocaleLowerCase().includes(idMarker) || note.body.toLocaleLowerCase().includes(titleMarker)
  ));
}
export function stats(notes) {
  const visible = notes.filter(note => !note.trashed && !note.archived);
  return { notes: visible.length, tasks: visible.filter(n => n.type === "task" && !n.completed).length, favorites: visible.filter(n => n.favorite).length, tags: new Set(visible.flatMap(n => n.tags)).size };
}
export function validateSnapshot(raw) {
  if (!raw || typeof raw !== "object" || raw.version !== SCHEMA_VERSION || !Array.isArray(raw.notes) || raw.notes.length > MAX_NOTES) throw new Error("Unsupported or oversized Notebook backup");
  const ids = new Set();
  const notes = raw.notes.map(n => {
    if (!n || typeof n !== "object" || typeof n.id !== "string" || !/^[A-Za-z0-9_-]{4,128}$/.test(n.id) || ids.has(n.id)) throw new Error("Invalid or duplicate note ID");
    ids.add(n.id);
    if (typeof n.body !== "string" || n.body.length > MAX_BODY_LENGTH) throw new Error("Invalid note body");
    if (!validTypes.has(n.type)) throw new Error("Invalid note type");
    if (n.parentId !== null && typeof n.parentId !== "string") throw new Error("Invalid parent");
    const defaults = makeNote({ id: n.id, title: n.title, parentId: n.parentId, type: n.type });
    return { ...defaults, body: n.body, tags: Array.isArray(n.tags) ? [...new Set(n.tags.filter(t => typeof t === "string").map(t => t.slice(0, 48)))].slice(0, 24) : [], favorite: n.favorite === true, archived: n.archived === true, trashed: n.trashed === true, completed: n.completed === true, dueDate: typeof n.dueDate === "string" && (/^\d{4}-\d{2}-\d{2}$/.test(n.dueDate) || n.dueDate === "") ? n.dueDate : "", createdAt: typeof n.createdAt === "string" ? n.createdAt.slice(0, 40) : defaults.createdAt, updatedAt: typeof n.updatedAt === "string" ? n.updatedAt.slice(0, 40) : defaults.updatedAt };
  });
  const byId = new Map(notes.map(n => [n.id, n]));
  for (const note of notes) {
    const visited = new Set([note.id]);
    let parent = note.parentId;
    while (parent !== null) {
      if (!byId.has(parent) || visited.has(parent)) throw new Error("Broken or cyclic note hierarchy");
      visited.add(parent);
      parent = byId.get(parent).parentId;
    }
  }
  return { version: SCHEMA_VERSION, notes };
}
export function exportSnapshot(notes) {
  return JSON.stringify(validateSnapshot({ version: SCHEMA_VERSION, notes }), null, 2);
}
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
