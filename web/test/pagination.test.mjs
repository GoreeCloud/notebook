import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("web uses bounded API pages without breaking legacy list behavior",()=>{
  const api=readFileSync(new URL("../src/api.ts",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(api.includes('notes:(query="",deleted=false)=>request<Note[]>'));
  assert.ok(api.includes('notesPage:(query="",deleted=false,limit=500,offset=0)'));
  assert.ok(api.includes('"/notes/page?q="'));
  assert.ok(app.includes('api.notesPage("",true,500,0)'));
  assert.ok(app.includes('api.notesPage("",true,500,noteNextOffset)'));
  assert.ok(!app.includes('api.notesPage("",true,500,notes.length)'));
  assert.ok(app.includes('page.results.filter(item=>!seen.has(item.id))'));
  assert.ok(app.includes('setNoteHasMore(page.has_more)'));
  assert.ok(app.includes('aria-label="Load more stored notes"'));
  assert.ok(app.includes('disabled={loadingMoreNotes}'));
});
