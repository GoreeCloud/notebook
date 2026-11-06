import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA_VERSION, makeNote, moveNote, updateNote, childrenOf, descendantsOf, searchNotes, backlinks, stableNoteLink, resolveNoteLink, stats, validateSnapshot, exportSnapshot, escapeHtml } from "../src/model.js";
const note = (id, title, parentId = null) => makeNote({ id, title, parentId });
test("creates safe defaults and IDs", () => {
  const n = note("root001", "Welcome");
  assert.equal(n.title, "Welcome");
  assert.equal(n.parentId, null);
  assert.ok(n.createdAt);
  assert.throws(() => makeNote({ id: "../unsafe" }));
});
test("tracks nested hierarchy and prevents cycles", () => {
  const notes = [note("root001", "Root"), note("child01", "Child", "root001"), note("third01", "Third", "child01")];
  assert.equal(childrenOf(notes, "root001")[0].id, "child01");
  assert.deepEqual([...descendantsOf(notes, "root001")].sort(), ["child01", "third01"]);
  assert.throws(() => moveNote(notes, "root001", "third01"), /cycle/);
  assert.equal(moveNote(notes, "third01", null)[2].parentId, null);
  assert.throws(() => moveNote(notes, "root001", "missing"), /not found/);
});
test("normalizes metadata and rejects invalid task dates", () => {
  const first = note("root001", "Root");
  const changed = updateNote([first], "root001", { tags: ["work", "work", " ideas "], favorite: true, body: "**Hello**", evil: 1 })[0];
  assert.deepEqual(changed.tags, ["work", "ideas"]);
  assert.equal(changed.favorite, true);
  assert.equal(changed.evil, undefined);
  assert.throws(() => updateNote([first], "root001", { dueDate: "tomorrow" }), /date/);
});
test("searches titles, bodies and tags without exposing trash", () => {
  const a = note("root001", "Planning");
  const b = { ...note("child01", "Meeting"), tags: ["Research"], body: "A note on the moon." };
  const c = { ...note("third01", "Gone"), trashed: true };
  assert.deepEqual(searchNotes([a, b, c], "research").map(n => n.id), ["child01"]);
  assert.deepEqual(searchNotes([a, b, c], "moon").map(n => n.id), ["child01"]);
  assert.deepEqual(searchNotes([a, b, c], "", "trash").map(n => n.id), ["third01"]);
});
test("counts open tasks and favorites", () => {
  const notes = [{ ...makeNote({ id: "task001", type: "task" }), favorite: true }, { ...makeNote({ id: "task002", type: "task" }), completed: true }];
  assert.deepEqual(stats(notes), { notes: 2, tasks: 1, favorites: 1, tags: 0 });
});
test("finds wiki backlinks by title", () => {
  const main = note("root001", "Architecture");
  const linked = { ...note("child01", "Next steps"), body: "See [[Architecture]] for details." };
  assert.deepEqual(backlinks([main, linked], main).map(n => n.id), ["child01"]);
});
test("exports and validates portable snapshots", () => {
  const original = [note("root001", "Root"), note("child01", "Child", "root001")];
  const parsed = validateSnapshot(JSON.parse(exportSnapshot(original)));
  assert.equal(parsed.version, SCHEMA_VERSION);
  assert.deepEqual(parsed.notes.map(n => n.parentId), [null, "root001"]);
});
test("rejects unsupported, duplicate, broken or cyclic backups", () => {
  const base = { version: 1, notes: [note("root001", "Root")] };
  assert.throws(() => validateSnapshot({ version: 999, notes: [] }), /Unsupported/);
  assert.throws(() => validateSnapshot({ ...base, notes: [...base.notes, base.notes[0]] }), /duplicate/);
  assert.throws(() => validateSnapshot({ ...base, notes: [{ ...base.notes[0], parentId: "missing" }] }), /Broken/);
  const a = note("root001", "Root", "child01");
  const b = note("child01", "Child", "root001");
  assert.throws(() => validateSnapshot({ version: 1, notes: [a, b] }), /cyclic/);
});
test("escapes HTML-sensitive content", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("stable note links and backlinks survive target renaming", () => {
  const target = note("root001", "Original title");
  const source = { ...note("other01", "Source"), body: "See [[id:root001]]." };
  const renamed = updateNote([target, source], target.id, { title: "Renamed title" });
  assert.equal(stableNoteLink(renamed[0]), "[[id:root001]]");
  assert.equal(resolveNoteLink(renamed, "id:root001")?.title, "Renamed title");
  assert.equal(resolveNoteLink(renamed, "Renamed title")?.id, "root001");
  assert.deepEqual(backlinks(renamed, renamed[0]).map(n => n.id), ["other01"]);
  assert.equal(resolveNoteLink(renamed, "Original title"), null);
  assert.equal(resolveNoteLink(renamed, "id:missing"), null);
});
