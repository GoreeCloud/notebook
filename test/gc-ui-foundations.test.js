import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const text = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const gitBlobHash = contents => {
  const bytes = Buffer.from(contents, "utf8");
  return createHash("sha1").update(Buffer.from("blob " + bytes.length + "\0")).update(bytes).digest("hex");
};

test("GC UI Foundations 1.0.1 vendored CSS is the exact tagged source", () => {
  const css = text("assets/gc-ui-foundations.v1.css");
  assert.equal(gitBlobHash(css), "c0e32a40f0bba280c9a4e9e01f31e1114d60f26c");
  assert.match(css, /--gc-v1-foundation-radius-md:/);
  assert.match(css, /--gc-v1-color-primary:/);
  assert.match(css, /:root\[data-gc-mode="dark"\]/);
  assert.match(css, /:root\[data-gc-mode="dark"\]\[data-gc-contrast="high"\]/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors: active/);
});

test("the pinned Apache license and attribution accompany the Foundations tokens", () => {
  const license = text("licenses/GC-UI-APACHE-2.0.txt");
  assert.equal(gitBlobHash(license), "ff9ad4530f5716304e042cbac72cecd7c40f0e0e");
  const notice = text("THIRD_PARTY_NOTICES.md");
  assert.match(notice, /Apache License 2\.0/);
  assert.match(notice, /foundations-v1\.0\.1/);
  assert.match(notice, /c0e32a40f0bba280c9a4e9e01f31e1114d60f26c/);
});

test("Notebook maps core semantic variables to GC UI versioned tokens", () => {
  const bridge = text("assets/styles.css");
  const pairs = {
    "--gc-brand": "--gc-v1-color-primary",
    "--gc-on-brand": "--gc-v1-color-on-primary",
    "--gc-canvas": "--gc-v1-color-canvas",
    "--gc-surface": "--gc-v1-color-surface",
    "--gc-text": "--gc-v1-color-on-surface",
    "--gc-outline": "--gc-v1-color-outline",
    "--gc-positive": "--gc-v1-color-success",
    "--gc-negative": "--gc-v1-color-danger",
    "--gc-radius-md": "--gc-v1-foundation-radius-md"
  };
  for (const [local, canonical] of Object.entries(pairs)) {
    assert.ok(bridge.includes(local + ":var(" + canonical + ")"), "Missing " + local + " canonical mapping");
  }
  assert.doesNotMatch(bridge, /--gc-v1-color-\w+\s*:/);
  assert.match(bridge, /outline:var\(--gc-v1-component-focus-width\) solid var\(--gc-v1-color-focus-ring\)/);
});

test("PWA loads pinned Foundations before Notebook CSS and syncs dark mode", () => {
  const html = text("index.html");
  const first = html.indexOf("./assets/gc-ui-foundations.v1.css");
  const second = html.indexOf("./assets/styles.css");
  assert.ok(first > 0 && second > first, "Foundations must load before Notebook bridge");
  assert.match(html, /data-gc-mode="dark"/);
  assert.match(text("src/app.js"), /document\.documentElement\.dataset\.gcMode = state\.theme/);
  assert.match(text("sw.js"), /\.\/assets\/gc-ui-foundations\.v1\.css/);
});
