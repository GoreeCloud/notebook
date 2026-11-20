import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../src/',import.meta.url);
const source=p=>readFileSync(new URL(p,root),'utf8');
const manifest=JSON.parse(source('vendor/gc-ui/provenance.json'));
test('GC UI token CSS and attribution match the pinned bytes',()=>{
  assert.equal(manifest.upstreamRepo,'https://github.com/GoreeCloud/gc-ui');
  assert.equal(manifest.upstreamSha,'42965f8682c22973b4247d58238e68aa63d86523');
  assert.deepEqual(Object.keys(manifest.sha256).sort(),['LICENSE','tokens.css']);
  for(const [p,sha] of Object.entries(manifest.sha256)){
    assert.equal(createHash('sha256').update(source('vendor/gc-ui/'+p)).digest('hex'),sha);
  }
  assert.match(source('vendor/gc-ui/LICENSE'),/MIT License/);
});
test('Notebook stays a notes-oriented consumer with shared semantic color roles',()=>{
  const entry=source('main.tsx');
  assert.ok(entry.indexOf('import "./vendor/gc-ui/tokens.css";')>=0);
  assert.ok(entry.indexOf('import "./styles.css";')>entry.indexOf('import "./vendor/gc-ui/tokens.css";'));
  const css=source('styles.css');
  for(const token of ['--gc-canvas','--gc-surface','--gc-text','--gc-focus-ring','--gc-brand','--gc-on-brand','--gc-brand-container','--gc-on-brand-container'])
    assert.ok(css.includes('var('+token+')'),token);
  for(const name of ['.sidebar{','.list-panel{','.editor-panel{','.note-list-item{','.body-editor{'])
    assert.ok(css.includes(name),name);
  assert.doesNotMatch(source('vendor/gc-ui/tokens.css'),/@import\s+(?:url\()?\s*["']?https?:\/\//i);
});
test('Partial adoption must not misrepresent screen-reader or founder signoff',()=>{
  const doc=readFileSync(new URL('../../docs/GC_UI_WEB_ADOPTION.md',import.meta.url),'utf8');
  assert.match(doc,/PARTIAL/);
  assert.match(doc,/not a complete/);
  assert.match(doc,/no new network/i);
});
