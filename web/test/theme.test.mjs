import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {themeOptions,accentOptions,resolveTheme,preference} from "../src/theme.ts";

test("user theme mode follows system only when selected",()=>{
  assert.deepEqual([...themeOptions],["system","light","dark"]);
  assert.equal(resolveTheme("system",true),"dark");
  assert.equal(resolveTheme("system",false),"light");
  assert.equal(resolveTheme("light",true),"light");
  assert.equal(resolveTheme("dark",false),"dark");
  assert.equal(preference("dark",themeOptions,"system"),"dark");
  assert.equal(preference("injected-mode",themeOptions,"system"),"system");
  assert.equal(preference(null,accentOptions,"iris"),"iris");
  assert.equal(preference("moss",accentOptions,"iris"),"moss");
});

test("all accent families exist in the pinned GoreeCloud UI CSS, no invented colors",()=>{
  const tokens=readFileSync(new URL("../src/vendor/gc-ui/tokens.css",import.meta.url),"utf8");
  const custom=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.deepEqual([...accentOptions],["iris","lagoon","ember","moss"]);
  assert.match(tokens,/data-gc-theme="dark"/);
  for(const accent of accentOptions){
    assert.ok(tokens.includes('data-gc-accent="'+accent+'"')||accent==="iris",accent);
  }
  assert.doesNotMatch(custom,/#[a-fA-F0-9]{3,8}\b/,"Notebook CSS should consume verified color variables");
  assert.ok(custom.includes("var(--gc-brand)"));
  assert.ok(custom.includes("var(--gc-surface)"));
  assert.ok(custom.includes("var(--gc-text)"));
  assert.ok(custom.includes(".theme-controls select:focus-visible"));
  assert.ok(app.includes("root.dataset.gcTheme"));
  assert.ok(app.includes("root.dataset.gcAccent"));
  assert.ok(app.includes("gc-notebook-theme"));
  assert.ok(app.includes("gc-notebook-accent"));
  assert.ok(!app.includes('localStorage.setItem("GC_NOTEBOOK_TOKEN"'));
});
