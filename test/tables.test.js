import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdownTable } from "../src/tables.js";
import { formatMarkdownSelection as format } from "../src/formatting.js";

test("renders a simple three-column Markdown table with accessible headers", () => {
  const lines = [
    "Intro",
    "| Phase | Status | Timeline |",
    "| --- | :--- | ---: |",
    "| Planning | In progress | Next month |",
    "After"
  ];
  const before = JSON.stringify(lines);
  const result = parseMarkdownTable(lines, 1);
  assert.equal(result.endIndex, 3);
  assert.match(result.html, /<table class="preview-table">/);
  assert.match(result.html, /<th scope="col">Phase<\/th>/);
  assert.match(result.html, /<td>In progress<\/td>/);
  assert.match(result.html, /aria-label="Note table"/);
  assert.equal(JSON.stringify(lines), before);
});

test("escapes unsafe table contents and refuses malformed tables", () => {
  const unsafe = [
    "| Header | Value |",
    "| --- | --- |",
    "| <img src=x onerror=alert(1)> | <script>alert(1)</script> |"
  ];
  const table = parseMarkdownTable(unsafe, 0);
  assert.ok(table);
  assert.ok(!table.html.includes("<img") && !table.html.includes("<script"));
  assert.match(table.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(table.html, /&lt;script&gt;/);
  assert.equal(parseMarkdownTable(["| A | B |", "| -- | --- |"], 0), null);
  assert.equal(parseMarkdownTable(["| A | B |", "| --- | --- |", "| only one |"], 0).endIndex, 1);
  assert.equal(parseMarkdownTable(["| A | B |"], 0), null);
});

test("table rendering is bounded to 64 rows and eight columns", () => {
  const many = ["| A | B |", "| --- | --- |",
    ...Array.from({ length: 100 }, (_, i) => "| row " + i + " | yes |")];
  const table = parseMarkdownTable(many, 0);
  assert.equal(table.endIndex, 65);
  assert.equal((table.html.match(/<td>/g) || []).length, 128);
  assert.equal(parseMarkdownTable(["| a | b | c | d | e | f | g | h | i |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"], 0), null);
  assert.throws(() => parseMarkdownTable("bad source", 0), /Invalid Markdown table source/);
  assert.throws(() => parseMarkdownTable([], -1), /Invalid Markdown table source/);
});

test("table command inserts valid Markdown without destroying selected text", () => {
  const blank = format("", 0, 0, "table");
  assert.match(blank.value, /^\| Phase \| Status \| Timeline \|\n\| --- \| --- \| --- \|/);
  assert.equal(blank.value.slice(blank.start, blank.end), "Phase");
  const existing = format("Hello world", 0, 5, "table");
  assert.ok(existing.value.startsWith("Hello\n\n| Phase"));
  assert.ok(existing.value.endsWith("\n\n world"));
  assert.ok(existing.value.includes("Hello") && existing.value.includes("world"));
});
