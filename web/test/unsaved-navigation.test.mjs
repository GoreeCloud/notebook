import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {unsavedNavigationWarning} from "../src/privacy.ts";

test("web guards navigation while the current note has unsaved edits",()=>{
  assert.match(unsavedNavigationWarning,/unsaved note edits/);
  assert.match(unsavedNavigationWarning,/discard your draft/);
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(app.includes('const confirmDraftDiscard=()=>!dirty||confirm(unsavedNavigationWarning);'));
  for(const action of ["const addNote=async", "const addNotebook=async",
    "const moveToTrash=async", "const restoreVersion=async"]){
    const start=app.indexOf(action);
    assert.ok(start>=0, action);
    assert.ok(app.slice(start,start+280).includes("confirmDraftDiscard()"),action);
  }
  for(const action of ["setActiveBook(b.id)","setActiveBook(\"\")",
    "setTrash(true)","setConnected(false)"]){
    const end=app.indexOf(action,app.indexOf("return <div className=\"app-shell\">"));
    assert.ok(end>=0,action);
    assert.ok(app.slice(end-100,end).includes("confirmDraftDiscard()"),action);
  }
  assert.ok(app.includes('if(note.id!==selected&&!confirmDraftDiscard())return;'));
});
