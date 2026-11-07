import { SCHEMA_VERSION, MAX_NOTES, makeNote, moveNote, updateNote, childrenOf, descendantsOf, searchNotes, backlinks, stableNoteLink, resolveNoteLink, auditNoteLinks, stats, validateSnapshot, describeImportImpact, escapeHtml } from "./model.js";
import { readState, writeState, readRecoveryState, replaceStateWithRecovery, subscribeToWorkspaceRevisions } from "./storage.js";
import { createBackup, importBackup } from "./backup.js";

const root = document.getElementById("app");
// Apply the released GC UI high-contrast palette when the user's system requests it.
// This never changes the saved notebook theme or the user's notes.
const systemContrast = window.matchMedia?.("(prefers-contrast: more)");
function syncSystemContrast() {
  document.documentElement.dataset.gcContrast = systemContrast?.matches ? "high" : "normal";
}
syncSystemContrast();
systemContrast?.addEventListener?.("change", syncSystemContrast);

const icons = {
  home: "⌂", notes: "▤", favorites: "★", tasks: "✓", archive: "◫", trash: "♻",
  add: "+", search: "⌕", settings: "⚙", export: "⇩", shield: "◇"
};
let state = { version: SCHEMA_VERSION, notes: [], selectedId: null, view: "home", query: "", theme: "light", preview: false };
let saveChain = Promise.resolve();
let saveTimer;
let savedRevision = 0;
let changeNumber = 0;
let enqueuedNumber = 0;
let persistedGeneration = 0;
let saveBlocked = false;
let saveError = "";
let workspaceReady = false;
const safe = escapeHtml;
const uid = () => crypto.randomUUID().replace(/-/g, "");
const selected = () => state.notes.find(note => note.id === state.selectedId) || null;
const date = value => { try { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; } };
function notify(message, error = false) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.dataset.error = error ? "true" : "false";
  el.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { el.hidden = true; }, 4000);
}
function pendingSnapshot() {
  return {
    version: SCHEMA_VERSION,
    // Capture an immutable representation of the current edits before the asynchronous write.
    notes: state.notes.map(note => ({ ...note, tags: [...note.tags] })),
    selectedId: state.selectedId,
    theme: state.theme
  };
}
function showSaveStatus(label) {
  const node = document.getElementById("saveStatus");
  if (node) node.textContent = label;
}
function formatStorageBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "unknown";
  return (value / (1024 * 1024)).toFixed(1) + " MiB";
}
async function refreshStorageStatus() {
  const indicator = document.getElementById("storageStatus");
  if (!indicator) return;
  if (!navigator.storage?.estimate) {
    indicator.textContent = "This browser does not expose an origin-storage estimate.";
    return;
  }
  try {
    const [estimate, persistent] = await Promise.all([
      navigator.storage.estimate(),
      typeof navigator.storage.persisted === "function" ? navigator.storage.persisted() : Promise.resolve(null)
    ]);
    if (!indicator.isConnected) return;
    indicator.textContent = "Browser origin storage (approximate): " +
      formatStorageBytes(estimate.usage) + " used of " + formatStorageBytes(estimate.quota) +
      " quota. Persistence: " + (persistent === true ? "granted" : persistent === false ? "not granted" : "unknown") +
      ". This is not an external backup or protection from manual data clearing.";
  } catch {
    if (indicator.isConnected) indicator.textContent = "Browser storage status is unavailable.";
  }
}
async function requestPersistentStorage() {
  if (typeof navigator.storage?.persist !== "function") {
    notify("Persistent storage requests are unsupported by this browser.", true);
    return;
  }
  try {
    const granted = await navigator.storage.persist();
    notify(granted
      ? "This browser granted persistent storage. Keep external backups as well."
      : "This browser did not grant persistent storage. Export backups regularly.", !granted);
  } catch {
    notify("The browser could not process the storage protection request.", true);
  }
  await refreshStorageStatus();
}
async function onOtherTabCommitted(revision) {
  // Broadcasts are only hints. Re-read IndexedDB to confirm the actual committed
  // revision, so a forged or delayed message cannot block the editor.
  if (!workspaceReady || saveBlocked || revision <= savedRevision) return;
  // Wait for this tab's in-flight write to finish before comparing revisions.
  // An own successful commit must never be mistaken for somebody else's change.
  await saveChain;
  if (saveBlocked || revision <= savedRevision) return;
  try {
    const latest = await readState();
    if (saveBlocked || !latest || latest.revision <= savedRevision) return;
    clearTimeout(saveTimer);
    saveBlocked = true;
    saveError = changeNumber !== persistedGeneration
      ? "Another Notebook tab saved a newer workspace. Your edits remain in this tab but are NOT saved."
      : "Another Notebook tab saved newer notes. This tab is read-only until you reload the latest workspace.";
    render();
    notify(saveError, true);
  } catch {
    // If the read fails, the transactional revision check will still reject stale writes.
  }
}
function queueSave() {
  if (saveBlocked) {
    notify("Saving is paused. Export unsaved changes, then reload.", true);
    return;
  }
  changeNumber += 1;
  clearTimeout(saveTimer);
  showSaveStatus("Saving locally…");
  saveTimer = setTimeout(flushSave, 250);
}
function flushSave() {
  clearTimeout(saveTimer);
  if (saveBlocked || changeNumber === enqueuedNumber) return saveChain;
  const generation = changeNumber;
  enqueuedNumber = generation;
  const snapshot = pendingSnapshot();
  saveChain = saveChain.then(async () => {
    if (saveBlocked) return;
    try {
      savedRevision = await writeState(snapshot, savedRevision);
      persistedGeneration = generation;
      if (changeNumber === generation) showSaveStatus("Saved on this device");
    } catch (error) {
      saveBlocked = true;
      saveError = error?.code === "NOTEBOOK_STORAGE_CONFLICT"
        ? "Another tab has newer changes. Your edits are still in this tab but were NOT saved."
        : error?.name === "QuotaExceededError"
          ? "The browser rejected this save because its storage quota was exceeded. Your edits remain in this tab but were NOT saved."
          : "This browser could not save your notes. Your edits remain in this tab but were NOT saved.";
      render();
      notify(saveError + " Export a backup before reloading.", true);
    }
  });
  return saveChain;
}
function create(type = "note", parentId = null) {
  if (saveBlocked) return notify("Export unsaved changes, then reload before editing.", true);
  if (state.notes.length >= MAX_NOTES) return notify("Note limit reached. Export or archive content.", true);
  const note = makeNote({ id: uid(), type, parentId, title: type === "task" ? "New task" : type === "journal" ? "Daily journal" : "Untitled note" });
  state.notes.unshift(note);
  state.selectedId = note.id;
  state.view = "notes";
  state.preview = false;
  queueSave();
  render();
  document.getElementById("noteTitle")?.focus();
}
function patch(changes, rerender = true) {
  if (saveBlocked) return notify("Saving is paused. Export unsaved edits before reloading.", true);
  if (!selected()) return;
  try { state.notes = updateNote(state.notes, state.selectedId, changes); queueSave(); if (rerender) render(); }
  catch (error) { notify(error.message, true); }
}
function openNote(id) {
  if (!state.notes.some(n => n.id === id)) return;
  state.selectedId = id;
  state.view = "notes";
  state.preview = false;
  render();
}
function changeView(view) {
  state.view = view;
  if (view !== "notes") state.selectedId = null;
  render();
}
function renderTree(parentId = null, depth = 0, visiting = new Set()) {
  if (depth > 24) return "";
  return childrenOf(state.notes, parentId).map(note => {
    if (visiting.has(note.id)) return "";
    const next = new Set(visiting); next.add(note.id);
    const child = renderTree(note.id, depth + 1, next);
    return '<div class="tree-node depth-' + Math.min(depth, 5) + '">' +
      '<button class="tree-item ' + (state.selectedId === note.id ? "selected" : "") + '" data-note="' + safe(note.id) + '" title="' + safe(note.title) + '">' +
      '<span class="tree-type" aria-hidden="true">' + (note.type === "task" ? "✓" : "◈") + '</span><span class="truncate">' + safe(note.title) + '</span></button>' + child + '</div>';
  }).join("");
}
function navButton(view, title, icon) {
  return '<button class="nav-link ' + (state.view === view ? "active" : "") + '" data-view="' + view + '" ' + (state.view === view ? 'aria-current="page"' : "") + '><span class="nav-icon" aria-hidden="true">' + icon + '</span><span>' + title + '</span></button>';
}
function chrome(content) {
  const counts = stats(state.notes);
  return '<div class="shell">' +
    '<aside class="sidebar" aria-label="Workspace navigation">' +
      '<div class="brand"><span class="brand-symbol" aria-hidden="true">▤</span><span><strong>Notebook</strong><small>GOREECLOUD</small></span></div>' +
      '<button class="new-button" data-action="new"><span aria-hidden="true">+</span> New Note <kbd>Ctrl N</kbd></button>' +
      '<div class="nav-section-label">WORKSPACE</div><nav class="primary-nav" aria-label="Main navigation">' +
        navButton("home", "Home", icons.home) + navButton("notes", "Notes", icons.notes) +
        navButton("favorites", "Favorites", icons.favorites) + navButton("tasks", "My tasks", icons.tasks) +
        navButton("archive", "Archive", icons.archive) + navButton("trash", "Trash", icons.trash) +
      '</nav>' +
      '<div class="nav-section-label tree-label">NOTEBOOKS <button data-action="new" aria-label="Add note">+</button></div>' +
      '<div class="tree-scroll" aria-label="Nested notes">' + (renderTree() || '<p class="tree-empty">Notes you create appear here.</p>') + '</div>' +
      '<div class="sidebar-foot"><span class="privacy-dot" aria-hidden="true"></span><div><strong>Private workspace</strong><small>Stored on this device</small></div><button class="icon-button" data-action="settings" aria-label="Settings" title="Settings">⚙</button></div>' +
    '</aside><div class="page">' +
      '<header class="topbar"><button class="mobile-brand" data-view="home" aria-label="Notebook home">✦</button><div class="breadcrumb">My workspace <span aria-hidden="true">/</span> <b>' + safe(state.view === "home" ? "Overview" : selected()?.title || (state.view[0].toUpperCase() + state.view.slice(1))) + '</b></div>' +
        '<label class="search-box"><span aria-hidden="true">⌕</span><span class="sr-only">Search your notes</span><input id="globalSearch" type="search" placeholder="Search your notes, notebooks, and tags..." value="' + safe(state.query) + '" autocomplete="off"><kbd>Ctrl K</kbd></label>' +
        '<button class="top-action" data-action="new" aria-label="Create note">+ <span>New note</span></button><button class="icon-button theme-button" data-action="theme" aria-label="Toggle light and dark theme">' + (state.theme === "dark" ? "☼" : "☾") + '</button>' +
      '</header>' +
      (saveBlocked ? '<div class="save-warning" role="alert"><span>' + safe(saveError) + ' Export a backup before leaving this tab.</span><button data-action="export">Export local copy</button><button data-action="reload">Reload saved version</button></div>' : '') +
      content +
      '<div class="mobile-bottom" aria-label="Mobile navigation">' + navButton("home", "Home", "⌂") + navButton("notes", "Notes", "▤") + navButton("tasks", "Tasks", "✓") + navButton("favorites", "Saved", "★") + '<button class="nav-link" data-action="settings"><span class="nav-icon">⚙</span>Settings</button></div>' +
    '</div></div><div id="toast" role="status" aria-live="polite" hidden></div>' +
    '<input id="importFile" type="file" accept="application/json,application/gzip,.json,.json.gz,.gz" hidden>' +
    '<dialog id="settingsDialog" class="settings-dialog" aria-labelledby="settingsTitle"><form method="dialog" class="dialog-head"><h2 id="settingsTitle">Workspace settings</h2><button class="icon-button" aria-label="Close settings">✕</button></form>' +
      '<p class="muted">Your notes are saved in this browser’s IndexedDB. No GoreeCloud server or AI provider receives this data.</p>' +
      '<div class="settings-grid"><button data-action="export" class="setting-choice">⇩ <strong>Export backup</strong><small>Portable JSON including your entire note hierarchy</small></button>' +
      '<button data-action="import" class="setting-choice">⇧ <strong>Import backup</strong><small>Replace workspace after validation and confirmation</small></button>' +
      '<button data-action="recover-import" class="setting-choice">↶ <strong>Undo last import</strong><small>Restore your previous locally saved workspace, if available</small></button>' +
      '<button data-action="audit-links" class="setting-choice">⌁ <strong>Audit note links</strong><small>Find missing, ambiguous and rename-sensitive links without changing notes</small></button>' +
      '<button data-action="protect-storage" class="setting-choice">▣ <strong>Protect local storage</strong><small>Ask this browser to reduce automatic eviction of Notebook data</small></button></div>' +
      '<p class="muted" id="storageStatus" role="status" aria-live="polite">Browser storage status not yet checked.</p>' +
      '<div class="link-audit-results" id="linkAuditResults" role="status" aria-live="polite" hidden></div>' +
      '<p class="dialog-note">Browser data clearing, private browsing, or storage eviction can erase local notes. The local pre-import checkpoint is not a backup and may disappear if browser storage is cleared. Keep separate protected backups. Cloud sync, encryption and team sharing are not yet implemented.</p>' +
    '</dialog>';
}
function noteCard(note) {
  const summary = (note.body || "").replace(/[#*_\[\]>]/g, " ").slice(0, 140).trim();
  return '<button class="note-card" data-note="' + safe(note.id) + '"><span class="card-top"><span class="pill">' + (note.type === "task" ? "TASK" : safe(note.type.toUpperCase())) + '</span><span class="card-date">' + safe(date(note.updatedAt)) + '</span></span>' +
    '<strong>' + safe(note.title) + '</strong><span class="card-excerpt">' + safe(summary || "An open page for a fresh idea.") + '</span><span class="card-bottom">' + (note.favorite ? '★ <span>Favorite</span>' : '↗ <span>Open note</span>') + '</span></button>';
}
function home() {
  const counts = stats(state.notes), recent = searchNotes(state.notes, "").slice(0, 6);
  return '<main class="content overview"><div class="hero"><span class="eyebrow"><span class="hero-spark">✦</span> YOUR PERSONAL KNOWLEDGE SPACE</span><h1>Every thought deserves<br><em>a place to grow.</em></h1><p>Capture the little moments and connect the big ideas. Your knowledge, beautifully organized and kept in your control.</p><div class="hero-actions"><button class="gc-button primary" data-action="new">+ Create a note</button><button class="gc-button secondary" data-action="new-task">✓ Add a task</button></div><span class="hero-decoration" aria-hidden="true">✺</span></div>' +
    '<div class="metrics"><div class="metric"><span>YOUR NOTES</span><strong>' + counts.notes + '</strong><small>Ideas worth keeping</small></div><div class="metric"><span>OPEN TASKS</span><strong>' + counts.tasks + '</strong><small>Things in motion</small></div><div class="metric"><span>FAVORITES</span><strong>' + counts.favorites + '</strong><small>Close at hand</small></div><div class="metric"><span>TOPICS</span><strong>' + counts.tags + '</strong><small>Connected themes</small></div></div>' +
    '<div class="section-heading"><div><span class="overline">PICK UP WHERE YOU LEFT OFF</span><h2>Recent notes</h2></div><button class="inline-link" data-view="notes">View all notes →</button></div>' +
    (recent.length ? '<div class="note-grid">' + recent.map(noteCard).join("") + '</div>' : '<div class="empty-panel"><span class="empty-art">✎</span><h3>Start with a single thought</h3><p>Your notebook is ready. Create a note, then build your own connected knowledge space.</p><button class="gc-button primary" data-action="new">Create first note</button></div>') +
    '<div class="tips"><span class="tip-icon">⌘</span><div><strong>A little tip</strong><p>Try [[Note title]] in any note to link ideas together. You can also nest notes, tag topics, and export everything at any time.</p></div></div></main>';
}
function simpleMarkdown(source) {
  return String(source).split("\n").map(line => {
    let content = safe(line);
    content = content.replace(/\[\[([^\]]{1,180})\]\]/g, (_, reference) => {
      const note = /^id:[A-Za-z0-9_-]{4,128}$/.test(reference) ? resolveNoteLink(state.notes, reference) : null;
      return '<button class="preview-link" data-link="' + reference + '">↗ ' + (note ? safe(note.title) : reference) + '</button>';
    });
    content = content.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
    if (/^### /.test(line)) return "<h4>" + content.slice(4) + "</h4>";
    if (/^## /.test(line)) return "<h3>" + content.slice(3) + "</h3>";
    if (/^# /.test(line)) return "<h2>" + content.slice(2) + "</h2>";
    if (/^- \[x\] /i.test(line)) return '<p class="preview-check">☑ ' + content.slice(6) + "</p>";
    if (/^- \[ \] /.test(line)) return '<p class="preview-check">☐ ' + content.slice(6) + "</p>";
    if (/^- /.test(line)) return "<p>• " + content.slice(2) + "</p>";
    return content ? "<p>" + content + "</p>" : '<p class="blank-line"></p>';
  }).join("");
}
function editor(note) {
  if (!note) return '<div class="empty-editor"><div class="empty-art">✧</div><h2>A quiet space for your ideas</h2><p>Select a note or create something new.</p><button class="gc-button primary" data-action="new">+ New note</button></div>';
  const parentChoices = ['<option value="">Top level</option>'].concat(state.notes.filter(n => n.id !== note.id && !n.trashed && !descendantsOf(state.notes, note.id).has(n.id)).map(n => '<option value="' + safe(n.id) + '" ' + (n.id === note.parentId ? "selected" : "") + '>' + safe(n.title) + '</option>')).join("");
  const links = backlinks(state.notes, note);
  return '<div class="editor"><div class="editor-header"><div class="editor-label"><span class="editor-dot"></span> ' + safe(note.type === "task" ? "TASK" : note.type.toUpperCase()) + '<span class="editor-separator">·</span><span id="saveStatus">' + (saveBlocked ? (changeNumber !== persistedGeneration ? "Unsaved changes" : "Outdated tab") : "Saved on this device") + '</span></div><div class="editor-actions">' +
    '<button class="icon-button ' + (note.favorite ? "on" : "") + '" data-action="favorite" aria-label="' + (note.favorite ? "Remove favorite" : "Add favorite") + '" title="Favorite">★</button>' +
    '<button class="icon-button" data-action="copy-link" aria-label="Copy stable note link" title="Copy permanent link">⌁</button>' +
    '<button class="icon-button" data-action="child" aria-label="Create nested note" title="Create nested note">⊕</button>' +
    '<button class="icon-button" data-action="duplicate" aria-label="Duplicate note" title="Duplicate note">⧉</button>' +
    '<button class="icon-button" data-action="archive" aria-label="Archive note" title="Archive note">◫</button>' +
    '<button class="icon-button danger" data-action="trash" aria-label="Move note to trash" title="Move to trash">♻</button></div></div>' +
    '<textarea class="editor-title" id="noteTitle" rows="1" maxlength="180" aria-label="Note title" placeholder="Untitled note" ' + (saveBlocked ? 'disabled' : '') + '>' + safe(note.title) + '</textarea>' +
    '<div class="editor-meta"><label>FOLDER <select id="parentSelect" aria-label="Parent note">' + parentChoices + '</select></label>' +
    '<label>TAGS <input id="noteTags" aria-label="Comma-separated tags" value="' + safe(note.tags.join(", ")) + '" placeholder="Add tags, separated by commas" ' + (saveBlocked ? 'disabled' : '') + '></label></div>' +
    (note.type === "task" ? '<div class="task-bar"><label><input type="checkbox" id="taskDone" ' + (note.completed ? "checked" : "") + '> Completed</label><label>Due <input type="date" id="taskDue" value="' + safe(note.dueDate) + '"></label></div>' : "") +
    '<div class="editor-toolbar"><div class="tab-buttons" role="group" aria-label="Editor mode"><button data-action="edit" class="' + (!state.preview ? "active" : "") + '" aria-pressed="' + (!state.preview) + '">✎ Write</button><button data-action="preview" class="' + (state.preview ? "active" : "") + '" aria-pressed="' + state.preview + '">◉ Preview</button></div><span>Markdown · [[linked notes]]</span></div>' +
    (state.preview ? '<div class="markdown-preview" id="previewOutput">' + simpleMarkdown(note.body) + '</div>' : '<textarea id="noteBody" class="editor-body" aria-label="Note body" spellcheck="true" ' + (saveBlocked ? 'disabled' : '') + ' placeholder="Start writing here. Use # headings, **bold**, or [[Note title]] to connect ideas.">' + safe(note.body) + '</textarea>') +
    '<div class="editor-footer"><span>' + note.body.trim().split(/\s+/).filter(Boolean).length + ' words</span><span>Created ' + safe(date(note.createdAt)) + '</span></div>' +
    '<div class="backlinks"><strong>↗ Linked from ' + links.length + ' note' + (links.length === 1 ? "" : "s") + '</strong>' + (links.length ? links.map(n => '<button data-note="' + safe(n.id) + '">' + safe(n.title) + '</button>').join("") : '<small>Write [[ ' + safe(note.title) + ' ]] without spaces in another note to create a backlink.</small>') + '</div></div>';
}
function collection() {
  const visible = searchNotes(state.notes, state.query, state.view);
  const title = { notes: "All Notes", tasks: "My Tasks", favorites: "Favorites", archive: "Archive", trash: "Trash" }[state.view] || "Notes";
  return '<main class="collection"><section class="list-panel"><div class="list-heading"><span class="overline">YOUR LIBRARY</span><h1>' + title + '</h1><p>' + visible.length + ' item' + (visible.length === 1 ? "" : "s") + '</p></div>' +
    '<div class="list-tools"><button class="gc-button primary compact" data-action="new">+ Note</button><button class="gc-button secondary compact" data-action="new-task">✓ Task</button></div>' +
    '<div class="note-list">' + (visible.length ? visible.map(note => '<button class="note-list-item ' + (note.id === state.selectedId ? "selected" : "") + '" data-note="' + safe(note.id) + '"><span class="list-item-title">' + (note.favorite ? "★ " : "") + safe(note.title) + '</span><span class="list-item-sub">' + safe(note.tags.join(" · ") || (note.body.slice(0, 55).replace(/\n/g, " ") || "No content yet")) + '</span><small>' + safe(date(note.updatedAt)) + '</small></button>').join("") : '<div class="list-empty">Nothing here yet. Your ideas will appear as you add them.</div>') + '</div></section>' +
    '<section class="editor-panel">' + (state.view === "trash" || state.view === "archive" ? '<div class="empty-editor"><div class="empty-art">◫</div><h2>' + title + '</h2><p>' + (state.view === "trash" ? "Restore a note from the list to continue editing." : "Archived notes stay safe and searchable when restored.") + '</p>' + (selected() ? '<button class="gc-button primary" data-action="restore">' + (state.view === "trash" ? "Restore note" : "Unarchive note") + '</button>' : "") + '</div>' : editor(selected())) + '</section></main>';
}
function fitTitleEditor(element) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = element.scrollHeight + "px";
}
function render() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.gcMode = state.theme;
  const content = state.view === "home" ? home() : collection();
  root.innerHTML = chrome(content);
  fitTitleEditor(document.getElementById("noteTitle"));
}
let exporting = false;
async function exportFile() {
  if (exporting) return notify("A backup is already being prepared.");
  exporting = true;
  try {
    const backup = await createBackup(state.notes);
    const url = URL.createObjectURL(backup.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "goreecloud-notebook-" + new Date().toISOString().slice(0, 10) + backup.extension;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    if (!backup.restorable) {
      notify("Backup downloaded, but cannot be restored by this preview: " + backup.reason + " Keep a separate protected copy.", true);
    } else {
      notify(backup.extension === ".json.gz"
        ? "Compressed backup exported. Import this .json.gz file to restore notes."
        : "Backup exported. Keep it somewhere safe.");
    }
  } catch (error) {
    notify("Backup export failed: " + error.message, true);
  } finally {
    exporting = false;
  }
}
async function importFile(file) {
  if (saveBlocked) return notify("Export unsaved edits before importing or reloading.", true);
  if (!file) return;
  try {
    const backup = await importBackup(file);
    const impact = describeImportImpact(state.notes, backup.notes);
    const warning = [
      "Replace the locally saved workspace?",
      "",
      "Current notes: " + impact.existing,
      "Imported notes: " + impact.incoming,
      "Added: " + impact.added,
      "Modified (same ID): " + impact.changed,
      "Unchanged: " + impact.unchanged,
      "Removed from current workspace: " + impact.removed,
      "",
      "Archived and trashed notes are included in these counts.",
      "A local one-step undo checkpoint is saved if the import succeeds.",
      "Export an independent backup first. Cancel keeps your workspace unchanged."
    ].join("\n");
    if (!window.confirm(warning)) return;
    await flushSave();
    if (saveBlocked) return;
    // Persist atomically BEFORE replacing in-memory notes. A stale import cannot overwrite another tab.
    const revision = await replaceStateWithRecovery({
      version: SCHEMA_VERSION, notes: backup.notes, selectedId: null, theme: state.theme
    }, savedRevision);
    savedRevision = revision;
    state.notes = backup.notes;
    state.selectedId = null;
    state.view = "home";
    render();
    notify("Backup imported. The previous workspace can be restored from Settings.");
  } catch (error) {
    if (error?.code === "NOTEBOOK_STORAGE_CONFLICT") {
      saveBlocked = true;
      saveError = "Another tab saved newer data. Your current edits were not overwritten.";
      render();
    }
    notify("Import rejected: " + error.message, true);
  }
}
async function undoLastImport() {
  if (saveBlocked) return notify("Export unsaved changes before attempting recovery.", true);
  try {
    const old = await readRecoveryState();
    if (!old) return notify("No previous workspace checkpoint is available.", true);
    const valid = validateSnapshot(old);
    if (!window.confirm("Restore the previous workspace (" + valid.notes.length +
      " notes)? Your current saved workspace will become the new local recovery checkpoint.")) return;
    await flushSave();
    if (saveBlocked) return;
    const next = await replaceStateWithRecovery({
      version: SCHEMA_VERSION, notes: valid.notes, selectedId: null, theme: state.theme
    }, savedRevision);
    savedRevision = next;
    state.notes = valid.notes;
    state.selectedId = null;
    state.view = "home";
    render();
    notify("Previous workspace restored. Export a backup to keep it safe.");
  } catch (error) {
    if (error?.code === "NOTEBOOK_STORAGE_CONFLICT") {
      saveBlocked = true;
      saveError = "Another tab saved newer data. Your workspace was not replaced.";
      render();
    }
    notify("Recovery failed: " + error.message, true);
  }
}
root.addEventListener("click", event => {
  const link = event.target.closest("[data-link]");
  if (link) {
    const note = resolveNoteLink(state.notes, link.dataset.link);
    return note ? openNote(note.id) : notify("Linked note was not found or its title matches multiple notes. Use a permanent ID link for a specific note.", true);
  }
  const item = event.target.closest("[data-note]");
  if (item) {
    const id = item.dataset.note;
    if (state.view === "trash" || state.view === "archive") { state.selectedId = id; return render(); }
    return openNote(id);
  }
  const button = event.target.closest("[data-view],[data-action]");
  if (!button) return;
  if (button.dataset.view) return changeView(button.dataset.view);
  const action = button.dataset.action, note = selected();
  if (saveBlocked && ["new", "new-task", "child", "favorite", "archive", "trash", "restore", "duplicate", "theme"].includes(action)) return notify("Export unsaved changes and reload before editing.", true);
  switch (action) {
    case "new": create(); break;
    case "new-task": create("task"); break;
    case "child": if (note) create("note", note.id); break;
    case "favorite": if (note) patch({ favorite: !note.favorite }); break;
    case "copy-link":
      if (note) {
        const value = stableNoteLink(note);
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(value).then(() => notify("Permanent note link copied.")).catch(() => window.prompt("Copy note link:", value));
        } else {
          window.prompt("Copy note link:", value);
        }
      } break;
    case "archive": if (note) { patch({ archived: true }, false); state.selectedId = null; render(); } break;
    case "trash": if (note && window.confirm("Move this note to trash? Child notes remain available in the hierarchy when restored.")) { patch({ trashed: true }, false); state.selectedId = null; render(); } break;
    case "restore":
      if (note) { patch(state.view === "trash" ? { trashed: false } : { archived: false }, false); state.view = "notes"; render(); }
      break;
    case "duplicate":
      if (saveBlocked) return notify("Export unsaved edits before editing.", true);
      if (state.notes.length >= MAX_NOTES) return notify("Note limit reached; duplication is unavailable.", true);
      if (note) {
        const copy = makeNote({ id: uid(), title: "Copy of " + note.title, parentId: note.parentId, type: note.type });
        copy.body = note.body; copy.tags = [...note.tags];
        state.notes.unshift(copy); state.selectedId = copy.id; queueSave(); render();
      } break;
    case "preview": state.preview = true; render(); break;
    case "edit": state.preview = false; render(); document.getElementById("noteBody")?.focus(); break;
    case "theme": state.theme = state.theme === "dark" ? "light" : "dark"; queueSave(); render(); break;
    case "settings": document.getElementById("settingsDialog")?.showModal(); void refreshStorageStatus(); break;
    case "export": exportFile(); break;
    case "import": if (saveBlocked) return notify("Export unsaved changes first.", true); document.getElementById("importFile")?.click(); break;
    case "recover-import": void undoLastImport(); break;
    case "audit-links": {
      const report = auditNoteLinks(state.notes);
      const lines = [
        "Note links: " + report.links + " across " + report.sourceNotes + " notes",
        "Permanent ID links: " + report.stable,
        "Legacy title links: " + report.legacy + " (" + report.convertible + " have a unique target)",
        "Broken links: " + report.broken,
        "Ambiguous title links: " + report.ambiguous,
        "Audit is read-only. Nothing has been changed."
      ];
      if (report.examples.length) {
        lines.push("", "Examples (up to 12):");
        for (const example of report.examples) {
          lines.push(example.problem + " in “" + example.sourceTitle + "”: [[" + example.reference + "]]");
        }
      }
      const output = document.getElementById("linkAuditResults");
      if (output) { output.textContent = lines.join("\n"); output.hidden = false; }
      break;
    }
    case "protect-storage": void requestPersistentStorage(); break;
    case "reload": if (window.confirm("Unsaved edits in this tab will be lost unless you export them. Reload the last successfully saved version?")) window.location.reload(); break;
  }
});
root.addEventListener("input", event => {
  if (event.target.id === "globalSearch") {
    const at = event.target.selectionStart;
    state.query = event.target.value; if (state.view === "home") state.view = "notes";
    render(); const input = document.getElementById("globalSearch"); input?.focus(); input?.setSelectionRange(at, at); return;
  }
  const field = { noteTitle: "title", noteBody: "body", noteTags: "tags" }[event.target.id];
  if (field) {
    const value = field === "tags" ? event.target.value.split(",") : event.target.value;
    patch({ [field]: value }, false);
    if (field === "title") fitTitleEditor(event.target);
  }
});
root.addEventListener("change", event => {
  if (saveBlocked && ["taskDone", "taskDue", "parentSelect"].includes(event.target.id)) { notify("Export unsaved changes before editing again.", true); render(); return; }
  if (event.target.id === "importFile") { importFile(event.target.files?.[0]); event.target.value = ""; }
  if (event.target.id === "taskDone") patch({ completed: event.target.checked });
  if (event.target.id === "taskDue") patch({ dueDate: event.target.value });
  if (event.target.id === "parentSelect" && selected()) {
    try { state.notes = moveNote(state.notes, state.selectedId, event.target.value || null); queueSave(); render(); }
    catch (error) { notify(error.message, true); render(); }
  }
});
document.addEventListener("keydown", event => {
  if (event.target.id === "noteTitle" && event.key === "Enter") {
    event.preventDefault();
    document.getElementById("noteBody")?.focus();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") { event.preventDefault(); create(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.getElementById("globalSearch")?.focus(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); flushSave(); if (!saveBlocked) notify("Saving locally…"); }
});
async function boot() {
  try {
    const saved = await readState();
    if (saved) {
      const clean = validateSnapshot(saved);
      state.notes = clean.notes;
      savedRevision = Number.isSafeInteger(saved.revision) && saved.revision >= 0 ? saved.revision : 0;
      state.selectedId = state.notes.some(n => n.id === saved.selectedId && !n.trashed) ? saved.selectedId : null;
      state.theme = saved.theme === "dark" ? "dark" : "light";
    }
    render();
    workspaceReady = true;
    subscribeToWorkspaceRevisions(onOtherTabCommitted);
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
  } catch (error) {
    root.innerHTML = '<div class="fatal"><h1>Could not open your local notebook</h1><p>' + safe(error.message) + '</p><p>No existing data was overwritten. Check browser storage settings and reload.</p></div>';
  }
} 
// Warn only when a write is outstanding or has failed; user activation and browser
// support determine whether an actual leave-confirmation dialog appears.
window.addEventListener("beforeunload", event => {
  if (changeNumber !== persistedGeneration) {
    event.preventDefault();
    event.returnValue = "";
  }
});
// Browser backgrounding is a best-effort flush; the revision check still enforces safe writes.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void flushSave();
  else void onOtherTabCommitted(Number.MAX_SAFE_INTEGER);
});
// Also check on return to the window for browsers that omit BroadcastChannel,
// and when a tab missed messages while frozen or suspended.
window.addEventListener("focus", () => { void onOtherTabCommitted(Number.MAX_SAFE_INTEGER); });
boot();
