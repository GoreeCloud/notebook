import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectEvernoteFile, inspectEvernoteSelection, canImportEvernote } from "./evernote_preflight.ts";

test("invalid file names are rejected", async () => {
 const result = await inspectEvernoteFile({ name: "wrong.xml", size: 100, slice() { throw new Error("Should not read"); } });
 assert.equal(result.code, "extension");
});

const sample = (name, body) => ({
    name,
    size: Buffer.byteLength(body),
    slice(start, end) { return { text: async () => body.slice(start, end) }; }
});

test("accepts a normal ENEX header without uploading any content", async () => {
    const file = sample("notebook.ENEX", '\uFEFF<?xml version="1.0"?>\n<!-- export -->\n<en-export export-date="20261010"><note /></en-export>');
    const result = await inspectEvernoteFile(file);
    assert.equal(result.code, "ready");
    assert.equal(result.ready, true);
    assert.equal(result.source, file);
});

test("rejects files with an unsupported XML declaration or misleading root", async () => {
    assert.equal((await inspectEvernoteFile(sample("notes.enex", '<!DOCTYPE en-export [<!ENTITY x "abc">]><en-export/>'))).code, "doctype");
    assert.equal((await inspectEvernoteFile(sample("notes.enex", "<not-notes/>"))).code, "header");
    assert.equal((await inspectEvernoteFile(sample("notes.enex", "<!-- <en-export> --><not-notes/>"))).code, "header");
    assert.equal((await inspectEvernoteFile(sample("notes.enex", ""))).code, "empty");
});

test("only reads the first 16 KiB of large sources", async () => {
    let range;
    const file = {
        name: "large.enex", size: 4_000_000_000,
        slice(start, end) { range = [start, end]; return { text: async () => "<en-export/>" }; }
    };
    assert.equal((await inspectEvernoteFile(file)).ready, true);
    assert.deepEqual(range, [0, 16 * 1024]);
});

test("review requires consent and original selection", async () => {
 const first = sample("one.enex", "<en-export/>");
 const checks = await inspectEvernoteSelection([first]);
 assert.equal(canImportEvernote([first], checks, false, false), false);
 assert.equal(canImportEvernote([first], checks, true, false), true);
 assert.equal(canImportEvernote([sample("one.enex", "<en-export/>")], checks, true, false), false);
});

test("literal XML declarations inside note content are not treated as prolog", async () => {
    const fixture = sample("example.enex", '<en-export><note><content><![CDATA[<en-note><pre>&lt;!DOCTYPE sample&gt;</pre></en-note>]]></content></note></en-export>');
    assert.equal((await inspectEvernoteFile(fixture)).code, "ready");
});

test("any blocked file prevents a mixed selection from starting upload", async () => {
    const files = [sample("first.enex", "<en-export/>"), sample("second.enex", "not xml")];
    const results = await inspectEvernoteSelection(files);
    assert.deepEqual(results.map(result => result.ready), [true, false]);
    assert.equal(canImportEvernote(files, results, true, false), false);
});

test("unreadable source fails closed", async () => {
    const file = { name: "blocked.enex", size: 12, slice() { throw new Error("read denied"); } };
    const result = await inspectEvernoteFile(file);
    assert.equal(result.code, "unreadable");
    assert.equal(result.ready, false);
});
