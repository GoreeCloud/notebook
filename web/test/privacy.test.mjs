import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {plaintextJsonExportWarning,importUnsavedDraftWarning} from "../src/privacy.ts";

test("JSON export warning explicitly discloses all sensitive plaintext content",()=>{
  for(const concept of ["ALL notebooks","Trash","revision history","UNENCRYPTED","destination","file access"]){
    assert.ok(plaintextJsonExportWarning.includes(concept),concept);
  }
  assert.match(importUnsavedDraftWarning,/unsaved note edits/);
  assert.match(importUnsavedDraftWarning,/discard your draft/);
});
test("browser requests export/import consent before any API action",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const exportStart=app.indexOf("const download=async()=>{try{");
  const consent=app.indexOf("if(!confirm(plaintextJsonExportWarning))return;",exportStart);
  const readNotes=app.indexOf("await api.export()",exportStart);
  assert.ok(exportStart>0 && consent>exportStart && readNotes>consent);
  const importStart=app.indexOf("const importFile=async (file:File)=>{");
  const dirtyGuard=app.indexOf("if(dirty&&!confirm(importUnsavedDraftWarning))return;",importStart);
  const preview=app.indexOf("await api.importArchive(",importStart);
  assert.ok(importStart>0 && dirtyGuard>importStart && preview>dirtyGuard);
});
