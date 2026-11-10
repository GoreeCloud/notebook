import test from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_TEMPLATES, createNoteFromTemplate } from "../src/templates.js";
import { validateSnapshot, SCHEMA_VERSION, MAX_BODY_LENGTH } from "../src/model.js";

test("built-in templates are complete, small and distinctly identified", () => {
  assert.deepEqual(BUILTIN_TEMPLATES.map(t => t.id),
    ["project-plan", "meeting", "journal", "reading"]);
  assert.equal(new Set(BUILTIN_TEMPLATES.map(t => t.id)).size, BUILTIN_TEMPLATES.length);
  for (const item of BUILTIN_TEMPLATES) {
    assert.ok(Object.isFrozen(item) && Object.isFrozen(item.tags));
    assert.ok(item.title.length > 3 && item.description.length > 10);
    assert.ok(item.body.length > 30 && item.body.length < MAX_BODY_LENGTH);
    assert.doesNotMatch(item.body, /<script|<iframe/i);
  }
});

test("every chosen template creates a fresh schema-valid local note with immutable metadata", () => {
  for (let i = 0; i < BUILTIN_TEMPLATES.length; i++) {
    const original = BUILTIN_TEMPLATES[i];
    const n = createNoteFromTemplate(original.id, "template" + i + "abc");
    const output = validateSnapshot({ version: SCHEMA_VERSION, notes: [n] });
    assert.equal(output.notes.length, 1);
    assert.equal(n.title, original.title);
    assert.equal(n.body, original.body);
    assert.equal(n.parentId, null);
    assert.equal(n.type, original.type);
    assert.deepEqual(n.tags, original.tags);
    assert.notEqual(n.tags, original.tags);
    assert.ok(n.createdAt && n.updatedAt);
    n.tags.push("personal");
    n.body = "Changed only in the new note";
    assert.ok(!original.tags.includes("personal"));
    assert.notEqual(original.body, n.body);
  }
});

test("selecting a template never reuses a prior note's identity or data", () => {
  const first = createNoteFromTemplate("meeting", "unique001");
  const second = createNoteFromTemplate("meeting", "unique002");
  assert.notEqual(first.id, second.id);
  first.title = "Private edited title";
  first.body = "Private edited content";
  assert.notEqual(first.title, second.title);
  assert.notEqual(first.body, second.body);
});

test("templates reject unknown identifiers and invalid fresh note IDs", () => {
  assert.throws(() => createNoteFromTemplate("untrusted", "valid001"), /Unknown Notebook template/);
  assert.throws(() => createNoteFromTemplate("project-plan", "../unsafe"), /Invalid note identifier/);
});
