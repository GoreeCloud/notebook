import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("web preview-only rows cannot enter the writable Markdown editor",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const api=readFileSync(new URL("../src/api.ts",import.meta.url),"utf8");
  assert.ok(app.includes("function toPreviewNote(summary:NoteSummary):Note"));
  assert.ok(app.includes("preview_only:true"));
  assert.ok(app.includes("api.getNote(chosen.id,Boolean(chosen.deleted_at))"));
  assert.ok(app.includes("const selectedNote=chosen?.preview_only?undefined:chosen;"));
  assert.ok(app.includes("chosen?.preview_only?<div className=\"no-selection\""));
  assert.ok(app.includes("if(!chosen||chosen.preview_only){setDraft"));
  assert.ok(app.includes("const dirty=Boolean(chosen&&!chosen.preview_only"));
  assert.ok(app.includes("Retry loading"));
  assert.ok(api.includes("?include_deleted=\"+includeDeleted"));
});
