// tests/all-previews.test.ts
import assert from "node:assert/strict";
import fs2 from "node:fs";
import path2 from "node:path";
import { test } from "node:test";

// tests/lib.ts
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
var here = path.dirname(fileURLToPath(import.meta.url));
var root = path.resolve(here, "..", "design-system");
function tokensCss() {
  const tokens = JSON.parse(fs.readFileSync(path.join(root, "tokens.json"), "utf8"));
  const theme = tokens.color.themes[0].id;
  const vars = [];
  const resolve = (value) => {
    const raw = typeof value === "string" ? value : value[theme];
    const alias = /^\{(.+)\}$/.exec(raw);
    return alias ? "var(--" + alias[1] + ")" : raw;
  };
  for (const t of tokens.color.tokens) vars.push("--" + t.name + ": " + resolve(t.value) + ";");
  for (const t of tokens.spacing.tokens) vars.push("--" + t.name + ": " + t.value + ";");
  for (const t of tokens.radius.tokens) vars.push("--" + t.name + ": " + t.value + ";");
  for (const [key, stack] of Object.entries(tokens.type.families)) vars.push("--font-" + key + ": " + stack + ";");
  return ":root { " + vars.join(" ") + " }\nbody { background: var(--background); color: var(--foreground); }";
}
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};
var baseUrl;
function serve() {
  baseUrl ??= new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const file = path.join(root, decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.unref();
      const address = server.address();
      resolve("http://127.0.0.1:" + (typeof address === "object" && address ? address.port : 0));
    });
  });
  return baseUrl;
}
var withBundle = (html) => html.replace("</head>", '<script src="/components/bundle.js"></script></head>');
async function openPreview(browser, name, viewport = { width: 1e3, height: 800 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.route("**/components/*/preview.html", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: withBundle(await response.text()) });
  });
  await page.goto(await serve() + "/components/" + name + "/preview.html");
  await page.addStyleTag({ content: tokensCss() });
  await page.waitForTimeout(100);
  return { page, errors };
}
async function withBrowser(body) {
  const browser = await chromium.launch();
  try {
    await body(browser);
  } finally {
    await browser.close();
  }
}

// tests/all-previews.test.ts
var components = path2.join(root, "components");
var names = fs2.readdirSync(components, { withFileTypes: true }).filter((e) => e.isDirectory() && fs2.existsSync(path2.join(components, e.name, "preview.html"))).map((e) => e.name).sort();
var STATIC = /* @__PURE__ */ new Set(["Cover"]);
test("every component folder is covered by this check", () => {
  assert.ok(names.length >= 36, "found " + names.length + " previews");
});
for (const name of names.filter((n) => !STATIC.has(n))) {
  test(name + ": the preview carries no script, the bundle supplies every element", () => {
    const html = fs2.readFileSync(path2.join(components, name, "preview.html"), "utf8");
    assert.doesNotMatch(html, /<script/i, "script tag");
  });
  test(name + ": at least one live custom element is defined and upgraded", async () => {
    await withBrowser(async (browser) => {
      const { page, errors } = await openPreview(browser, name);
      const report = await page.evaluate(() => {
        const tags = Array.from(new Set(Array.from(document.querySelectorAll("*")).map((el) => el.localName).filter((tag) => tag.startsWith("ue-"))));
        return tags.map((tag) => ({ tag, defined: Boolean(customElements.get(tag)), upgraded: document.querySelectorAll(tag + ":not(:defined)").length === 0 }));
      });
      assert.ok(report.length > 0, "a ue-* element in the page");
      for (const entry of report) assert.deepEqual(entry, { tag: entry.tag, defined: true, upgraded: true });
      assert.deepEqual(errors, []);
      await page.close();
    });
  });
}
test("components/bundle.js exists, is a classic script, and defines every ue-* element the previews use", async () => {
  const bundle = path2.join(components, "bundle.js");
  assert.ok(fs2.existsSync(bundle), "components/bundle.js exists");
  const source = fs2.readFileSync(bundle, "utf8");
  assert.match(source.split("\n")[0], /^\/\* @ds-bundle: \{"format":4,"namespace":"UEStarship"/);
  assert.doesNotMatch(source, /\bimport\b|<\/script|<!--/, "no import, no closing script tag, no HTML comment");
  const used = /* @__PURE__ */ new Set();
  for (const name of names) {
    const html = fs2.readFileSync(path2.join(components, name, "preview.html"), "utf8");
    for (const m of html.slice(html.indexOf("<body")).matchAll(/<(ue-[a-z0-9-]+)/g)) used.add(m[1]);
    assert.doesNotMatch(html, /src="[^"]*bundle\.js"/, name + " must not load bundle.js itself");
  }
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Cover");
    await page.addScriptTag({ content: source });
    const missing = await page.evaluate((tags) => tags.filter((tag) => !customElements.get(tag)), Array.from(used));
    assert.deepEqual(missing, []);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYWxsLXByZXZpZXdzLnRlc3QudHMiLCAibGliLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0L3N0cmljdCc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgdGVzdCB9IGZyb20gJ25vZGU6dGVzdCc7XG5pbXBvcnQgeyBvcGVuUHJldmlldywgcm9vdCwgd2l0aEJyb3dzZXIgfSBmcm9tICcuL2xpYi50cyc7XG5cbmNvbnN0IGNvbXBvbmVudHMgPSBwYXRoLmpvaW4ocm9vdCwgJ2NvbXBvbmVudHMnKTtcbmNvbnN0IG5hbWVzID0gZnMucmVhZGRpclN5bmMoY29tcG9uZW50cywgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pLmZpbHRlcigoZSkgPT4gZS5pc0RpcmVjdG9yeSgpICYmIGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKGNvbXBvbmVudHMsIGUubmFtZSwgJ3ByZXZpZXcuaHRtbCcpKSkubWFwKChlKSA9PiBlLm5hbWUpLnNvcnQoKTtcbmNvbnN0IFNUQVRJQyA9IG5ldyBTZXQoWydDb3ZlciddKTtcblxudGVzdCgnZXZlcnkgY29tcG9uZW50IGZvbGRlciBpcyBjb3ZlcmVkIGJ5IHRoaXMgY2hlY2snLCAoKSA9PiB7XG5cdGFzc2VydC5vayhuYW1lcy5sZW5ndGggPj0gMzYsICdmb3VuZCAnICsgbmFtZXMubGVuZ3RoICsgJyBwcmV2aWV3cycpO1xufSk7XG5cbmZvciAoY29uc3QgbmFtZSBvZiBuYW1lcy5maWx0ZXIoKG4pID0+ICFTVEFUSUMuaGFzKG4pKSkge1xuXHR0ZXN0KG5hbWUgKyAnOiB0aGUgcHJldmlldyBjYXJyaWVzIG5vIHNjcmlwdCwgdGhlIGJ1bmRsZSBzdXBwbGllcyBldmVyeSBlbGVtZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGh0bWwgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKGNvbXBvbmVudHMsIG5hbWUsICdwcmV2aWV3Lmh0bWwnKSwgJ3V0ZjgnKTtcblx0XHRhc3NlcnQuZG9lc05vdE1hdGNoKGh0bWwsIC88c2NyaXB0L2ksICdzY3JpcHQgdGFnJyk7XG5cdH0pO1xuXG5cdHRlc3QobmFtZSArICc6IGF0IGxlYXN0IG9uZSBsaXZlIGN1c3RvbSBlbGVtZW50IGlzIGRlZmluZWQgYW5kIHVwZ3JhZGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0XHRjb25zdCB7IHBhZ2UsIGVycm9ycyB9ID0gYXdhaXQgb3BlblByZXZpZXcoYnJvd3NlciwgbmFtZSk7XG5cdFx0XHRjb25zdCByZXBvcnQgPSBhd2FpdCBwYWdlLmV2YWx1YXRlKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGFncyA9IEFycmF5LmZyb20obmV3IFNldChBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyonKSkubWFwKChlbCkgPT4gZWwubG9jYWxOYW1lKS5maWx0ZXIoKHRhZykgPT4gdGFnLnN0YXJ0c1dpdGgoJ3VlLScpKSkpO1xuXHRcdFx0XHRyZXR1cm4gdGFncy5tYXAoKHRhZykgPT4gKHsgdGFnLCBkZWZpbmVkOiBCb29sZWFuKGN1c3RvbUVsZW1lbnRzLmdldCh0YWcpKSwgdXBncmFkZWQ6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwodGFnICsgJzpub3QoOmRlZmluZWQpJykubGVuZ3RoID09PSAwIH0pKTtcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0Lm9rKHJlcG9ydC5sZW5ndGggPiAwLCAnYSB1ZS0qIGVsZW1lbnQgaW4gdGhlIHBhZ2UnKTtcblx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgcmVwb3J0KSBhc3NlcnQuZGVlcEVxdWFsKGVudHJ5LCB7IHRhZzogZW50cnkudGFnLCBkZWZpbmVkOiB0cnVlLCB1cGdyYWRlZDogdHJ1ZSB9KTtcblx0XHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xufVxuXG4vLyBUaGUgZGVzaWduIHN5c3RlbSBwYWdlIG1hcmtzIGV2ZXJ5IHByZXZpZXcgc3RhdGljIHdpdGggXCJjb21wb25lbnRzL2J1bmRsZS5qcyBpcyBtaXNzaW5nXCIgd2hlbiBubyBidW5kbGUgZXhpc3RzLiBUaGUgcGFnZSBwcmVsb2FkcyBpdCBpbnRvIGVhY2ggcHJldmlldy5cbnRlc3QoJ2NvbXBvbmVudHMvYnVuZGxlLmpzIGV4aXN0cywgaXMgYSBjbGFzc2ljIHNjcmlwdCwgYW5kIGRlZmluZXMgZXZlcnkgdWUtKiBlbGVtZW50IHRoZSBwcmV2aWV3cyB1c2UnLCBhc3luYyAoKSA9PiB7XG5cdGNvbnN0IGJ1bmRsZSA9IHBhdGguam9pbihjb21wb25lbnRzLCAnYnVuZGxlLmpzJyk7XG5cdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKGJ1bmRsZSksICdjb21wb25lbnRzL2J1bmRsZS5qcyBleGlzdHMnKTtcblx0Y29uc3Qgc291cmNlID0gZnMucmVhZEZpbGVTeW5jKGJ1bmRsZSwgJ3V0ZjgnKTtcblx0YXNzZXJ0Lm1hdGNoKHNvdXJjZS5zcGxpdCgnXFxuJylbMF0sIC9eXFwvXFwqIEBkcy1idW5kbGU6IFxce1wiZm9ybWF0XCI6NCxcIm5hbWVzcGFjZVwiOlwiVUVTdGFyc2hpcFwiLyk7XG5cdGFzc2VydC5kb2VzTm90TWF0Y2goc291cmNlLCAvXFxiaW1wb3J0XFxifDxcXC9zY3JpcHR8PCEtLS8sICdubyBpbXBvcnQsIG5vIGNsb3Npbmcgc2NyaXB0IHRhZywgbm8gSFRNTCBjb21tZW50Jyk7XG5cdGNvbnN0IHVzZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0Zm9yIChjb25zdCBuYW1lIG9mIG5hbWVzKSB7XG5cdFx0Y29uc3QgaHRtbCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oY29tcG9uZW50cywgbmFtZSwgJ3ByZXZpZXcuaHRtbCcpLCAndXRmOCcpO1xuXHRcdGZvciAoY29uc3QgbSBvZiBodG1sLnNsaWNlKGh0bWwuaW5kZXhPZignPGJvZHknKSkubWF0Y2hBbGwoLzwodWUtW2EtejAtOS1dKykvZykpIHVzZWQuYWRkKG1bMV0pO1xuXHRcdGFzc2VydC5kb2VzTm90TWF0Y2goaHRtbCwgL3NyYz1cIlteXCJdKmJ1bmRsZVxcLmpzXCIvLCBuYW1lICsgJyBtdXN0IG5vdCBsb2FkIGJ1bmRsZS5qcyBpdHNlbGYnKTtcblx0fVxuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnQ292ZXInKTtcblx0XHRhd2FpdCBwYWdlLmFkZFNjcmlwdFRhZyh7IGNvbnRlbnQ6IHNvdXJjZSB9KTtcblx0XHRjb25zdCBtaXNzaW5nID0gYXdhaXQgcGFnZS5ldmFsdWF0ZSgodGFncykgPT4gdGFncy5maWx0ZXIoKHRhZykgPT4gIWN1c3RvbUVsZW1lbnRzLmdldCh0YWcpKSwgQXJyYXkuZnJvbSh1c2VkKSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChtaXNzaW5nLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG4iLCAiLy8vIDxyZWZlcmVuY2UgbGliPVwiZG9tXCIgLz5cbi8vIFNoYXJlZCBoZWxwZXJzIGZvciB0aGUgcHJldmlldyBpbnRlcmFjdGlvbiB0ZXN0cy4gVGhlIERPTSBsaWIgdHlwZXMgdGhlIGNhbGxiYWNrcyB0aGF0IHJ1biBpbiB0aGUgcGFnZS5cbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCBodHRwIGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IGNocm9taXVtLCB0eXBlIEJyb3dzZXIsIHR5cGUgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuXG5jb25zdCBoZXJlID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG5leHBvcnQgY29uc3Qgcm9vdCA9IHBhdGgucmVzb2x2ZShoZXJlLCAnLi4nLCAnZGVzaWduLXN5c3RlbScpO1xuXG5pbnRlcmZhY2UgVG9rZW5WYWx1ZSB7IFt0aGVtZTogc3RyaW5nXTogc3RyaW5nIH1cbmludGVyZmFjZSBUb2tlbnMge1xuXHRjb2xvcjogeyB0aGVtZXM6IEFycmF5PHsgaWQ6IHN0cmluZyB9PjsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB8IFRva2VuVmFsdWUgfT4gfTtcblx0c3BhY2luZzogeyB0b2tlbnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0+IH07XG5cdHJhZGl1czogeyB0b2tlbnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0+IH07XG5cdHR5cGU6IHsgZmFtaWxpZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfTtcbn1cblxuLy8gQnVpbGRzIHRoZSB0b2tlbnMuY3NzIHRoYXQgdGhlIHByZXZpZXcgZnJhbWUgcHJlbG9hZHMsIGZyb20gdG9rZW5zLmpzb24gKGZpcnN0IHRoZW1lKS5cbmV4cG9ydCBmdW5jdGlvbiB0b2tlbnNDc3MoKTogc3RyaW5nIHtcblx0Y29uc3QgdG9rZW5zID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJvb3QsICd0b2tlbnMuanNvbicpLCAndXRmOCcpKSBhcyBUb2tlbnM7XG5cdGNvbnN0IHRoZW1lID0gdG9rZW5zLmNvbG9yLnRoZW1lc1swXS5pZDtcblx0Y29uc3QgdmFyczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgcmVzb2x2ZSA9ICh2YWx1ZTogc3RyaW5nIHwgVG9rZW5WYWx1ZSk6IHN0cmluZyA9PiB7XG5cdFx0Y29uc3QgcmF3ID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IHZhbHVlIDogdmFsdWVbdGhlbWVdO1xuXHRcdGNvbnN0IGFsaWFzID0gL15cXHsoLispXFx9JC8uZXhlYyhyYXcpO1xuXHRcdHJldHVybiBhbGlhcyA/ICd2YXIoLS0nICsgYWxpYXNbMV0gKyAnKScgOiByYXc7XG5cdH07XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMuY29sb3IudG9rZW5zKSB2YXJzLnB1c2goJy0tJyArIHQubmFtZSArICc6ICcgKyByZXNvbHZlKHQudmFsdWUpICsgJzsnKTtcblx0Zm9yIChjb25zdCB0IG9mIHRva2Vucy5zcGFjaW5nLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgdC52YWx1ZSArICc7Jyk7XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMucmFkaXVzLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgdC52YWx1ZSArICc7Jyk7XG5cdGZvciAoY29uc3QgW2tleSwgc3RhY2tdIG9mIE9iamVjdC5lbnRyaWVzKHRva2Vucy50eXBlLmZhbWlsaWVzKSkgdmFycy5wdXNoKCctLWZvbnQtJyArIGtleSArICc6ICcgKyBzdGFjayArICc7Jyk7XG5cdHJldHVybiAnOnJvb3QgeyAnICsgdmFycy5qb2luKCcgJykgKyAnIH1cXG5ib2R5IHsgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZCk7IGNvbG9yOiB2YXIoLS1mb3JlZ3JvdW5kKTsgfSc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlldyB7XG5cdHBhZ2U6IFBhZ2U7XG5cdGVycm9yczogc3RyaW5nW107XG59XG5cbmNvbnN0IE1JTUU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdCcuaHRtbCc6ICd0ZXh0L2h0bWw7IGNoYXJzZXQ9dXRmLTgnLFxuXHQnLmpzJzogJ3RleHQvamF2YXNjcmlwdDsgY2hhcnNldD11dGYtOCcsXG5cdCcuY3NzJzogJ3RleHQvY3NzOyBjaGFyc2V0PXV0Zi04Jyxcblx0Jy5qc29uJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHQnLnBuZyc6ICdpbWFnZS9wbmcnLFxuXHQnLnN2Zyc6ICdpbWFnZS9zdmcreG1sJyxcbn07XG5cbmxldCBiYXNlVXJsOiBQcm9taXNlPHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cbi8vIFNlcnZlcyBkZXNpZ24tc3lzdGVtIG92ZXIgaHR0cCwgYmVjYXVzZSBDaHJvbWl1bSBibG9ja3MgbW9kdWxlIHNjcmlwdHMgb24gZmlsZTovLy4gT25lIHNlcnZlciBwZXIgcHJvY2Vzcy5cbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZSgpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRiYXNlVXJsID8/PSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Y29uc3Qgc2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIoKHJlcSwgcmVzKSA9PiB7XG5cdFx0XHRjb25zdCBmaWxlID0gcGF0aC5qb2luKHJvb3QsIGRlY29kZVVSSUNvbXBvbmVudChuZXcgVVJMKHJlcS51cmwgPz8gJy8nLCAnaHR0cDovL3gnKS5wYXRobmFtZSkpO1xuXHRcdFx0aWYgKCFmaWxlLnN0YXJ0c1dpdGgocm9vdCkgfHwgIWZzLmV4aXN0c1N5bmMoZmlsZSkgfHwgZnMuc3RhdFN5bmMoZmlsZSkuaXNEaXJlY3RvcnkoKSkge1xuXHRcdFx0XHRyZXMud3JpdGVIZWFkKDQwNCkuZW5kKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlcy53cml0ZUhlYWQoMjAwLCB7ICdjb250ZW50LXR5cGUnOiBNSU1FW3BhdGguZXh0bmFtZShmaWxlKV0gPz8gJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScgfSk7XG5cdFx0XHRmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGUpLnBpcGUocmVzKTtcblx0XHR9KTtcblx0XHRzZXJ2ZXIub24oJ2Vycm9yJywgcmVqZWN0KTtcblx0XHRzZXJ2ZXIubGlzdGVuKDAsICcxMjcuMC4wLjEnLCAoKSA9PiB7XG5cdFx0XHRzZXJ2ZXIudW5yZWYoKTtcblx0XHRcdGNvbnN0IGFkZHJlc3MgPSBzZXJ2ZXIuYWRkcmVzcygpO1xuXHRcdFx0cmVzb2x2ZSgnaHR0cDovLzEyNy4wLjAuMTonICsgKHR5cGVvZiBhZGRyZXNzID09PSAnb2JqZWN0JyAmJiBhZGRyZXNzID8gYWRkcmVzcy5wb3J0IDogMCkpO1xuXHRcdH0pO1xuXHR9KTtcblx0cmV0dXJuIGJhc2VVcmw7XG59XG5cbi8vIFRoZSBkZXNpZ24gc3lzdGVtIHBhZ2UgcHJlbG9hZHMgY29tcG9uZW50cy9idW5kbGUuanMgYXMgYSBjbGFzc2ljIHNjcmlwdCBhaGVhZCBvZiB0aGUgcHJldmlldyBtYXJrdXAuIFRlc3RzIGRvIHRoZSBzYW1lLlxuZXhwb3J0IGNvbnN0IHdpdGhCdW5kbGUgPSAoaHRtbDogc3RyaW5nKTogc3RyaW5nID0+IGh0bWwucmVwbGFjZSgnPC9oZWFkPicsICc8c2NyaXB0IHNyYz1cIi9jb21wb25lbnRzL2J1bmRsZS5qc1wiPjwvc2NyaXB0PjwvaGVhZD4nKTtcblxuLy8gT3BlbnMgYSBjb21wb25lbnQgcHJldmlldyB3aXRoIHRoZSB0b2tlbnMgaW5qZWN0ZWQuIENvbnNvbGUgYW5kIHBhZ2UgZXJyb3JzIGNvbGxlY3QgaW4gYGVycm9yc2AuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlblByZXZpZXcoYnJvd3NlcjogQnJvd3NlciwgbmFtZTogc3RyaW5nLCB2aWV3cG9ydCA9IHsgd2lkdGg6IDEwMDAsIGhlaWdodDogODAwIH0pOiBQcm9taXNlPFByZXZpZXc+IHtcblx0Y29uc3QgcGFnZSA9IGF3YWl0IGJyb3dzZXIubmV3UGFnZSh7IHZpZXdwb3J0IH0pO1xuXHRjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cdHBhZ2Uub24oJ3BhZ2VlcnJvcicsIChlKSA9PiBlcnJvcnMucHVzaChTdHJpbmcoZSkpKTtcblx0cGFnZS5vbignY29uc29sZScsIChtKSA9PiB7XG5cdFx0aWYgKG0udHlwZSgpID09PSAnZXJyb3InICYmICEvZm9udHNcXC5nfEVSUl98RmFpbGVkIHRvIGxvYWQgcmVzb3VyY2UvLnRlc3QobS50ZXh0KCkpKSBlcnJvcnMucHVzaChtLnRleHQoKSk7XG5cdH0pO1xuXHRhd2FpdCBwYWdlLnJvdXRlKCcqKi9jb21wb25lbnRzLyovcHJldmlldy5odG1sJywgYXN5bmMgKHJvdXRlKSA9PiB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCByb3V0ZS5mZXRjaCgpO1xuXHRcdGF3YWl0IHJvdXRlLmZ1bGZpbGwoeyByZXNwb25zZSwgYm9keTogd2l0aEJ1bmRsZShhd2FpdCByZXNwb25zZS50ZXh0KCkpIH0pO1xuXHR9KTtcblx0YXdhaXQgcGFnZS5nb3RvKChhd2FpdCBzZXJ2ZSgpKSArICcvY29tcG9uZW50cy8nICsgbmFtZSArICcvcHJldmlldy5odG1sJyk7XG5cdGF3YWl0IHBhZ2UuYWRkU3R5bGVUYWcoeyBjb250ZW50OiB0b2tlbnNDc3MoKSB9KTtcblx0YXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxMDApO1xuXHRyZXR1cm4geyBwYWdlLCBlcnJvcnMgfTtcbn1cblxuLy8gUnVucyBhIHRlc3QgYm9keSB3aXRoIGEgZnJlc2ggYnJvd3NlciBhbmQgYWx3YXlzIGNsb3NlcyBpdC5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoQnJvd3Nlcihib2R5OiAoYnJvd3NlcjogQnJvd3NlcikgPT4gUHJvbWlzZTx2b2lkPik6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBicm93c2VyID0gYXdhaXQgY2hyb21pdW0ubGF1bmNoKCk7XG5cdHRyeSB7XG5cdFx0YXdhaXQgYm9keShicm93c2VyKTtcblx0fSBmaW5hbGx5IHtcblx0XHRhd2FpdCBicm93c2VyLmNsb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGJhY2tncm91bmQgPSAocGFnZTogUGFnZSwgc2VsZWN0b3I6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiBwYWdlLiRldmFsKHNlbGVjdG9yLCAoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmJhY2tncm91bmRDb2xvcik7XG4i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
