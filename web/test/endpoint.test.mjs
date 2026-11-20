import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNotebookEndpoint, isLocalNotebookEndpoint } from "../src/endpoint.ts";

test("allow loopback http and remote https, normalize trailing slash",()=>{
  assert.equal(normalizeNotebookEndpoint(" http://127.0.0.1:8000/ "),"http://127.0.0.1:8000");
  assert.equal(normalizeNotebookEndpoint("http://localhost:5173/"),"http://localhost:5173");
  assert.equal(normalizeNotebookEndpoint("http://[::1]:8000/"),"http://[::1]:8000");
  assert.equal(normalizeNotebookEndpoint("https://notebook.example.test/"),"https://notebook.example.test");
  assert.equal(isLocalNotebookEndpoint("http://localhost:8000"),true);
  assert.equal(isLocalNotebookEndpoint("https://notebook.example.test"),false);
});

test("fail closed before bearer transport to insecure or confused URLs",()=>{
  for(const url of [
    "http://notebook.example.test:8000",
    "http://192.168.1.2:8000",
    "http://10.0.0.5",
    "ftp://localhost:8000",
    "javascript:alert(1)",
    "https://user:secret@notes.example.test",
    "http://127.0.0.1:8000/?token=secret",
    "https://notes.example.test/#token",
    "https://notes.example.test/api/v1",
    "//notes.example.test",
    "not a url",
    ""
  ]){
    assert.throws(()=>normalizeNotebookEndpoint(url),Error,url);
  }
});
