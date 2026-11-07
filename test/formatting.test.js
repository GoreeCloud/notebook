import test from "node:test";
import assert from "node:assert/strict";
import { formatMarkdownSelection as format } from "../src/formatting.js";
import { MAX_BODY_LENGTH } from "../src/model.js";

test("wraps selected text in bold, italic and inline code without losing its selection", () => {
  assert.deepEqual(format("Hello world", 6, 11, "bold"), {
    value: "Hello **world**", start: 8, end: 13
  });
  assert.deepEqual(format("abc", 0, 3, "italic"), {
    value: "*abc*", start: 1, end: 4
  });
  assert.deepEqual(format("abc", 1, 2, "code"), {
    value: "a`b`c", start: 2, end: 3
  });
});

test("offers selected placeholders when no text is highlighted", () => {
  assert.deepEqual(format("A ", 2, 2, "bold"), {
    value: "A **bold text**", start: 4, end: 13
  });
  assert.deepEqual(format("", 0, 0, "code"), {
    value: "`code`", start: 1, end: 5
  });
});

test("adds heading and task prefixes to the current line, even at position zero", () => {
  assert.deepEqual(format("Hello\nWorld", 0, 0, "heading"), {
    value: "## Hello\nWorld", start: 3, end: 3
  });
  assert.deepEqual(format("Hello\nWorld", 6, 6, "checklist"), {
    value: "Hello\n- [ ] World", start: 12, end: 12
  });
  assert.deepEqual(format("Hello", 0, 0, "quote"), {
    value: "> Hello", start: 2, end: 2
  });
});

test("formats multiline list selections without adding extra trailing list items", () => {
  const output = format("one\ntwo\nthree", 0, 8, "bullet");
  assert.equal(output.value, "- one\n- two\nthree");
  assert.equal(output.start, 2);
  assert.equal(output.end, 11);
  assert.equal(format("## One", 2, 2, "heading").value, "## One");
  assert.equal(format("- one", 3, 3, "bullet").value, "- one");
});

test("rejects malformed inputs, unknown commands and formatting that exceeds note bounds", () => {
  assert.throws(() => format("abc", 2, 1, "bold"), /Invalid text selection/);
  assert.throws(() => format("abc", -1, 0, "bold"), /Invalid text selection/);
  assert.throws(() => format("abc", 0, 7, "bold"), /Invalid text selection/);
  assert.throws(() => format("abc", 0, 0, "javascript"), /Unknown formatting command/);
  assert.throws(() => format("x".repeat(MAX_BODY_LENGTH), 0, 0, "heading"), /size limit/);
});
