// Self-contained Chrome DevTools Protocol test runner; no npm dependencies.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdtempSync, statSync, createReadStream, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = mkdtempSync(join(tmpdir(), "notebook-smoke-"));
const pause = ms => new Promise(done => setTimeout(done, ms));
const types = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".webmanifest":"application/manifest+json"};
const server = createServer((req, res) => {
  try {
    const requested = new URL(req.url, "http://127.0.0.1");
    const path = resolve(root, "." + (requested.pathname === "/" ? "/index.html" : decodeURIComponent(requested.pathname)));
    if (!path.startsWith(root + sep) || !statSync(path).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(path).pipe(res);
  } catch { res.writeHead(404).end(); }
});
let chrome, socket, count = 0;
const pending = new Map();
const exceptions = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++count;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function waitFor(check, limit = 30000) {
  const start = Date.now();
  while (Date.now() - start < limit) {
    const result = await check().catch(() => null);
    if (result) return result;
    await pause(150);
  }
  throw Error("Browser test timed out. " + exceptions.slice(-3).join(" | "));
}
try {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const candidates = [
    process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium",
    "/usr/bin/chromium-browser", "/opt/google/chrome/chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ];
  const binary = candidates.find(path => path && existsSync(path));
  if (!binary) throw Error("Chromium/Chrome not found; set CHROME_BIN to the executable path.");
  chrome = spawn(binary, [
    "--headless=new", ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []), "--disable-dev-shm-usage",
    "--no-first-run", "--disable-background-networking",
    "--remote-debugging-port=0", "--remote-allow-origins=http://localhost",
    "--user-data-dir=" + profile, "about:blank"
  ], { stdio:"ignore" });
  const port = await waitFor(async () => {
    const path = join(profile, "DevToolsActivePort");
    return existsSync(path) ? Number(readFileSync(path, "utf8").split("\n")[0]) : null;
  });
  const target = await waitFor(async () => {
    const response = await fetch("http://127.0.0.1:" + port + "/json/list");
    const tabs = await response.json();
    return tabs.find(tab => tab.type === "page" && tab.webSocketDebuggerUrl);
  });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, {once:true});
    socket.addEventListener("error", reject, {once:true});
  });
  socket.addEventListener("message", event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const waiter = pending.get(data.id);
      pending.delete(data.id);
      data.error ? waiter.reject(Error(data.error.message)) : waiter.resolve(data.result);
    } else if (data.method === "Runtime.exceptionThrown") {
      exceptions.push(data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text || "Browser exception");
    }
  });
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Page.navigate", { url: "http://127.0.0.1:" + server.address().port + "/test/browser-smoke.html" });
  const result = await waitFor(async () => {
    const evaluation = await command("Runtime.evaluate", {
      expression: "({status:document.documentElement.dataset.testResult||'', details:document.getElementById('output')?.textContent||''})",
      returnByValue:true
    });
    const value = evaluation.result?.value;
    if (value?.status === "PASS" || value?.status === "FAIL") return value;
    return null;
  }, 45000);
  if (result.status !== "PASS") throw Error(result.details);
  console.log(result.details);
  await command("Network.enable");
  await command("Network.emulateNetworkConditions", {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  const offlineUrl = "http://127.0.0.1:" + server.address().port + "/index.html";
  await command("Page.navigate", { url: offlineUrl });
  await waitFor(async () => {
    const evaluation = await command("Runtime.evaluate", {
      expression: "({path:location.pathname, opened:!!document.querySelector('.topbar'), offline:!!navigator.serviceWorker.controller})",
      returnByValue: true
    });
    const status = evaluation.result?.value;
    return status?.path === "/index.html" && status.opened && status.offline;
  }, 12000);
  console.log("PASS: PWA opened its cached shell while browser networking was disabled.");
  // Save screenshots made entirely from synthetic test records, never real user notes.
  if (process.env.NOTEBOOK_SCREENSHOT_DIR) {
    const output = resolve(process.env.NOTEBOOK_SCREENSHOT_DIR);
    mkdirSync(output, { recursive: true });
    const evaluate = async expression => {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.text || "Browser evaluation failed");
      return result.result?.value;
    };
    const tap = async selector => {
      const success = await evaluate("Boolean(document.querySelector(" + JSON.stringify(selector) + ")?.click() ?? document.querySelector(" + JSON.stringify(selector) + "))");
      if (!success) throw Error("UI control missing: " + selector);
    };
    const viewport = async (width, height, mobile) => {
      await command("Emulation.setDeviceMetricsOverride", { width, height, mobile, deviceScaleFactor: 1 });
      await pause(200);
      const check = await evaluate("({viewport:window.innerWidth,scroll:document.documentElement.scrollWidth})");
      if (!check || check.scroll > check.viewport + 2) throw Error("Horizontal layout overflow: " + JSON.stringify(check));
    };
    const capture = async name => {
      await pause(150);
      const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
      writeFileSync(join(output, name + ".png"), Buffer.from(screenshot.data, "base64"));
      console.log("Saved review screenshot: " + name);
    };
    await command("Network.emulateNetworkConditions", { offline:false, latency:0, downloadThroughput:0, uploadThroughput:0 });
    await viewport(1440, 900, false);
    await command("Page.reload", { ignoreCache: true });
    await waitFor(async () => evaluate("!!document.querySelector('.content.overview')"));
    await capture("home-dark-desktop");
    await tap('.sidebar [data-view="notes"]');
    await tap(".note-list-item");
    await capture("editor-dark-desktop");
    await tap(".theme-button");
    await capture("editor-light-desktop");
    await tap('.sidebar [data-view="home"]');
    await capture("home-light-desktop");
    await viewport(390, 844, true);
    await capture("home-light-mobile");
    await tap('.mobile-bottom [data-view="notes"]');
    await tap(".note-list-item");
    const title = await evaluate("(()=>{const e=document.getElementById('noteTitle');return e?{tag:e.tagName,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}:null})()");
    if (!title || title.tag !== "TEXTAREA" || title.scrollWidth > title.clientWidth + 2 || title.scrollHeight > title.clientHeight + 2) {
      throw Error("Mobile note title is clipped: " + JSON.stringify(title));
    }
    console.log("PASS: Responsive note heading wraps without overflow at 390px.");
    await capture("editor-light-mobile");
    await viewport(320, 640, true);
    const narrow = await evaluate("(()=>{const e=document.getElementById('noteTitle');return e?{width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}:null})()");
    if (!narrow || narrow.scrollWidth > narrow.width + 2 || narrow.scrollHeight > narrow.height + 2) {
      throw Error("Small mobile note title is clipped: " + JSON.stringify(narrow));
    }
    await capture("editor-light-small-mobile");
    await viewport(768, 1024, false);
    await capture("editor-light-tablet");
    console.log("PASS: Responsive layouts have no horizontal overflow at 320px, 390px and 768px.");
  }
} catch (error) {
  console.error("Browser smoke failed:", error.message);
  for (const detail of exceptions.slice(-3)) console.error(detail);
  process.exitCode = 1;
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    const stopped = new Promise(resolve => chrome.once("exit", resolve));
    chrome.kill();
    await Promise.race([stopped, pause(2000)]);
  }
  await new Promise(resolve => server.close(resolve));
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 });
  } catch (error) {
    // Runner-created profile contains only synthetic test notes; warn without hiding test results.
    console.warn("Temporary Chromium profile cleanup requires attention:", error.code || error.message);
  }
}
