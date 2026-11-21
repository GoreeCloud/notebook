import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("ranked search uses compact API and keeps selected previews nonwritable",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const api=readFileSync(new URL("../src/api.ts",import.meta.url),"utf8");
  assert.ok(api.includes("export type RankedNoteSummaryPage"));
  assert.ok(api.includes('rankedSearchSummary:(q:string,limit=200,notebookId="")'));
  assert.ok(api.includes('"/search?summary=true&q="'));
  assert.ok(app.includes("api.rankedSearchSummary(query.trim(),200,activeBook)"));
  assert.ok(app.includes("const previews=result.results.map(toPreviewNote)"));
  assert.ok(app.includes("setSearchResults(previews)"));
  assert.ok(app.includes("const selectedNote=chosen?.preview_only?undefined:chosen;"));
  assert.ok(app.includes("api.getNote(chosen.id,Boolean(chosen.deleted_at))"));
});
