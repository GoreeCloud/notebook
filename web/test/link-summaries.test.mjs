import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("browser link graph uses compact previews and hydrated targets",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const api=readFileSync(new URL("../src/api.ts",import.meta.url),"utf8");
  assert.ok(api.includes("export type NoteLinkSummaryGraph"));
  assert.ok(api.includes('noteLinksSummary:(id:string,limit=50,offset=0)'));
  assert.ok(api.includes('"/links?summary=true&limit="'));
  assert.ok(app.includes("api.noteLinksSummary(chosen.id)"));
  assert.ok(app.includes("const openLinkedNote=(target:NoteSummary)=>"));
  assert.ok(app.includes("const preview=toPreviewNote(target)"));
  assert.ok(app.includes("if(existing&&!existing.preview_only)return items"));
  assert.ok(app.includes("if(dirty&&!confirm(\"Discard unsaved edits before following this note link?\"))return;"));
  assert.ok(app.includes("api.getNote(chosen.id,Boolean(chosen.deleted_at))"));
});
