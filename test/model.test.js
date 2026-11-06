import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA_VERSION, makeNote, moveNote, updateNote, childrenOf, descendantsOf, searchNotes, backlinks, stableNoteLink, resolveNoteLink, auditNoteLinks, stats, validateSnapshot, describeImportImpact, exportSnapshot, escapeHtml, supportedBackupSize, MAX_IMPORT_BYTES } from "../src/model.js";
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

test("note headings keep one-line semantics even when pasted with line breaks", () => {
  const created = makeNote({ id: "newlines01", title: "First\nSecond\tPart" });
  assert.equal(created.title, "First Second Part");
  const edited = updateNote([created], created.id, { title: "Updated\r\nTitle" })[0];
  assert.equal(edited.title, "Updated Title");
});

test("backup size guard matches the maximum accepted import size", () => {
  assert.equal(MAX_IMPORT_BYTES, 22_000_000);
  assert.equal(supportedBackupSize(0), true);
  assert.equal(supportedBackupSize(MAX_IMPORT_BYTES), true);
  assert.equal(supportedBackupSize(MAX_IMPORT_BYTES + 1), false);
  assert.equal(supportedBackupSize(-1), false);
  assert.equal(supportedBackupSize(Number.NaN), false);
});

test("import impact reports added, modified, retained and removed notes without mutations", () => {
  const root = makeNote({ id: "root001", title: "Working note" });
  const unchanged = makeNote({ id: "kept001", title: "Archive", type: "journal" });
  unchanged.archived = true;
  const removed = makeNote({ id: "gone001", title: "Obsolete" });
  removed.trashed = true;
  const previous = [root, unchanged, removed];
  const incoming = [
    { ...root, title: "Updated", updatedAt: "2099-01-01T00:00:00.000Z" },
    { ...unchanged, updatedAt: "2099-01-01T00:00:00.000Z" },
    makeNote({ id: "added01", title: "New" })
  ];
  const before = JSON.stringify({ previous, incoming });
  assert.deepEqual(describeImportImpact(previous, incoming), {
    existing: 3, incoming: 3, added: 1, changed: 1, unchanged: 1, removed: 1
  });
  assert.equal(JSON.stringify({ previous, incoming }), before);
});

test("import impact rejects invalid incoming hierarchy and duplicate IDs", () => {
  const current = [makeNote({ id: "root001" })];
  assert.throws(() => describeImportImpact(current, [
    makeNote({ id: "dup0001" }), makeNote({ id: "dup0001" })
  ]), /duplicate/);
  assert.throws(() => describeImportImpact(current, [
    makeNote({ id: "child001", parentId: "missing" })
  ]), /hierarchy/);
});

test("link audit distinguishes permanent, unique title, broken and ambiguous links", () => {
  const first = note("alpha01", "Alpha");
  const duplicate = note("alpha02", "aLPHa");
  const beta = note("beta000", "Beta");
  const source = { ...note("source01", "Source"), archived: true,
    body: "[[Alpha]] [[Beta]] [[Unknown]] [[id:beta000]] [[id:missing01]]" };
  const trashed = { ...note("trashed01", "Trash"), trashed: true, body: "[[Unknown]]" };
  const notes = [first, duplicate, beta, source, trashed];
  const original = JSON.stringify(notes);
  assert.equal(resolveNoteLink(notes, "Alpha"), null,
    "Ambiguous legacy link must not silently open one of two targets");
  assert.equal(resolveNoteLink(notes, "id:alpha02")?.id, "alpha02");
  const audit = auditNoteLinks(notes);
  assert.deepEqual({
    links: audit.links, stable: audit.stable, legacy: audit.legacy,
    broken: audit.broken, ambiguous: audit.ambiguous, convertible: audit.convertible,
    sourceNotes: audit.sourceNotes
  }, { links: 5, stable: 2, legacy: 3, broken: 2, ambiguous: 1, convertible: 1, sourceNotes: 1 });
  assert.deepEqual(audit.examples.map(e => e.problem), [
    "Ambiguous title target", "Missing title target", "Broken ID link"
  ]);
  assert.equal(JSON.stringify(notes), original, "Auditing must not mutate any note");
});

test("link audit limits examples and ignores deleted source and target notes", () => {
  const live = { ...note("source01", "Active"), body: "[[id:gone001]] [[No title]] [[No title]]" };
  const trashed = { ...note("gone001", "No title"), trashed: true, body: "[[nope]]" };
  const report = auditNoteLinks([live, trashed], 1);
  assert.equal(report.broken, 3);
  assert.equal(report.examples.length, 1);
  assert.equal(report.sourceNotes, 1);
  assert.deepEqual(auditNoteLinks([], 12), {
    links: 0, stable: 0, legacy: 0, broken: 0, ambiguous: 0, convertible: 0, sourceNotes: 0, examples: []
  });
});

test("ambiguous title backlinks never attach to an arbitrary duplicate note", () => {
  const original = note("first001", "Same title");
  const duplicate = note("second01", "same TITLE");
  const byTitle = { ...note("source01", "References"), body: "[[Same title]]" };
  const byId = { ...note("source02", "Permanent reference"), body: "[[id:first001]]" };
  const notes = [original, duplicate, byTitle, byId];
  assert.deepEqual(backlinks(notes, original).map(n => n.id), ["source02"]);
  assert.deepEqual(backlinks(notes, duplicate).map(n => n.id), []);
  assert.deepEqual(backlinks(notes.filter(n => n.id !== duplicate.id), original).map(n => n.id),
    ["source01", "source02"]);
});
