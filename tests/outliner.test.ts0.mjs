// tests/outliner.test.ts
import assert2 from "node:assert/strict";
import { test } from "node:test";

// tests/preview-kit.ts
import assert from "node:assert/strict";
import fs2 from "node:fs";
import path2 from "node:path";

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

// tests/preview-kit.ts
function rgb(token) {
  const file = JSON.parse(fs2.readFileSync(path2.join(root, "tokens.json"), "utf8"));
  const theme = file.color.themes[0].id;
  let name = token;
  for (let hops = 0; hops < 8; hops++) {
    const entry = file.color.tokens.find((t) => t.name === name);
    assert.ok(entry, "token " + name);
    const raw = typeof entry.value === "string" ? entry.value : entry.value[theme];
    const alias = /^\{(.+)\}$/.exec(raw);
    if (alias) {
      name = alias[1];
      continue;
    }
    const hex = /^#([0-9a-f]{6})$/i.exec(raw);
    assert.ok(hex, "six digit hex for " + name);
    const n = parseInt(hex[1], 16);
    return "rgb(" + (n >> 16) + ", " + (n >> 8 & 255) + ", " + (n & 255) + ")";
  }
  throw new Error("alias loop for " + token);
}
async function inPreview(name, body) {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, name);
    await body(page);
    assert.equal(errors.length, 0, "page errors: " + errors.join(" | "));
    await page.close();
  });
}
var bgOf = (target) => target.evaluate((el) => getComputedStyle(el).backgroundColor);
var colorOf = (target) => target.evaluate((el) => getComputedStyle(el).color);
var classes = async (target) => (await target.getAttribute("class") ?? "").split(/\s+/);
var widthOf = (target) => target.evaluate((el) => el.getBoundingClientRect().width);
var settle = (page) => page.waitForTimeout(80);
var parkPointer = (page) => page.mouse.move(2, 2);
var shown = (target) => target.isVisible();
var centre = (b) => {
  assert.ok(b, "bounding box");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
var clickBlank = (page) => page.mouse.click(2, 2);
var keys = (page, ...keys2) => keys2.reduce((chain, key) => chain.then(() => page.keyboard.press(key)), Promise.resolve());
var movePointer = (page, x, y, steps = 1) => page.mouse.move(x, y, { steps });
var holdPointer = (page) => page.mouse.down();
var releasePointer = (page) => page.mouse.up();
var spin = (page, dx, dy) => page.mouse.wheel(dx, dy);
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function rowIn(page, scope, rowClass, textClass, label) {
  return page.locator(scope + " " + rowClass).filter({ has: page.locator(textClass, { hasText: new RegExp("^" + escapeRegExp(label) + "$") }) });
}
var visibleLabels = (page, scope, rowClass, textClass) => page.$$eval(scope + " " + rowClass + ":not([hidden]) " + textClass, (els) => els.map((el) => el.textContent ?? ""));

// tests/outliner.test.ts
var treeRow = (page, label) => rowIn(page, "ue-tree-row", ".tr-row", ".tr-text", label);
var treeLabels = (page) => visibleLabels(page, "ue-tree-row", ".tr-row", ".tr-text");
var treeSelected = (page) => page.$$eval("ue-tree-row .tr-row.is-selected .tr-text", (els) => els.map((el) => el.textContent ?? ""));
test("TreeRow: click selects, active while focused and inactive after focus leaves", async () => {
  await inPreview("TreeRow", async (page) => {
    const chair = treeRow(page, "Chair");
    assert2.equal(await chair.getAttribute("aria-selected"), "false");
    await chair.click();
    assert2.ok((await classes(chair)).includes("is-selected"));
    assert2.equal(await chair.getAttribute("aria-selected"), "true");
    assert2.equal(await bgOf(chair), rgb("select"));
    assert2.equal(await colorOf(chair), rgb("foreground-hover"));
    await clickBlank(page);
    await settle(page);
    assert2.equal(await bgOf(chair), rgb("select-inactive"));
    assert2.ok((await classes(chair)).includes("is-selected"), "selection stays while the tree is unfocused");
    await chair.click();
    assert2.equal(await bgOf(chair), rgb("select"), "focus returns, active again");
  });
});
test("TreeRow: hover fills an unselected row and leaves a selected row alone", async () => {
  await inPreview("TreeRow", async (page) => {
    const skylight = treeRow(page, "SkyLight");
    await parkPointer(page);
    assert2.equal(await bgOf(skylight), rgb("recessed"));
    await skylight.hover();
    assert2.equal(await bgOf(skylight), rgb("select-hover"));
    await skylight.click();
    assert2.equal(await bgOf(skylight), rgb("select"));
    await skylight.hover();
    assert2.equal(await bgOf(skylight), rgb("select"), "selected row keeps its fill on hover");
  });
});
test("TreeRow: ctrl-click toggles, shift-click selects a range", async () => {
  await inPreview("TreeRow", async (page) => {
    await treeRow(page, "Chair").click();
    await treeRow(page, "Table").click({ modifiers: ["Control"] });
    assert2.deepEqual(await treeSelected(page), ["Chair", "Table"]);
    await treeRow(page, "Chair").click({ modifiers: ["Control"] });
    assert2.deepEqual(await treeSelected(page), ["Table"]);
    await treeRow(page, "Light Source").click();
    await treeRow(page, "PointLight").click({ modifiers: ["Shift"] });
    assert2.deepEqual(await treeSelected(page), ["Light Source", "SkyLight", "PointLight"]);
    await treeRow(page, "Chair").click();
    assert2.deepEqual(await treeSelected(page), ["Chair"], "a plain click replaces the selection");
  });
});
test("TreeRow: the caret collapses and expands, and indents 12px per level", async () => {
  await inPreview("TreeRow", async (page) => {
    const meshes = treeRow(page, "StaticMeshes");
    const indent = (label) => widthOf(treeRow(page, label).locator(".tr-indent"));
    assert2.equal(await indent("Lights"), 6);
    assert2.equal(await indent("Chair"), 18);
    assert2.ok(!(await treeLabels(page)).includes("Sofa"));
    await treeRow(page, "Furniture").locator(".tr-arrow").click();
    assert2.ok((await treeLabels(page)).includes("Sofa"));
    assert2.equal(await indent("Sofa"), 30);
    await meshes.locator(".tr-arrow").click();
    assert2.equal(await meshes.getAttribute("aria-expanded"), "false");
    const labels = await treeLabels(page);
    for (const hidden of ["Chair", "Table", "Furniture", "Sofa", "Bookshelf"]) assert2.ok(!labels.includes(hidden), hidden + " hidden");
    assert2.ok(labels.includes("Audio"));
    await meshes.locator(".tr-arrow").click();
    assert2.ok((await treeLabels(page)).includes("Chair"));
    assert2.equal(await meshes.getAttribute("aria-expanded"), "true");
  });
});
test("TreeRow: double-click expands, the folder icon opens and closes with it", async () => {
  await inPreview("TreeRow", async (page) => {
    const furniture = treeRow(page, "Furniture");
    assert2.equal(await furniture.locator(".tr-icon use").getAttribute("href"), "#tr-folder");
    await furniture.locator(".tr-text").dblclick();
    assert2.ok((await treeLabels(page)).includes("Sofa"));
    assert2.equal(await furniture.locator(".tr-icon use").getAttribute("href"), "#tr-folder-open");
    assert2.equal(await furniture.locator(".tr-arrow use").getAttribute("href"), "#tr-caret-down");
  });
});
test("TreeRow: a parent of the selection takes the parent tint, collapsed or not", async () => {
  await inPreview("TreeRow", async (page) => {
    await treeRow(page, "Furniture").locator(".tr-arrow").click();
    await treeRow(page, "Sofa").click();
    await parkPointer(page);
    const meshes = treeRow(page, "StaticMeshes");
    assert2.equal(await bgOf(meshes), rgb("select-parent"));
    assert2.equal(await bgOf(treeRow(page, "Furniture")), rgb("select-parent"));
    assert2.equal(await bgOf(treeRow(page, "Lights")), rgb("recessed"));
    await meshes.locator(".tr-arrow").click();
    await parkPointer(page);
    assert2.ok(!(await treeLabels(page)).includes("Sofa"));
    assert2.equal(await bgOf(meshes), rgb("select-parent"), "collapsed parent keeps the tint");
    await meshes.hover();
    assert2.equal(await bgOf(meshes), rgb("select-hover"), "a hovered parent uses the hover fill");
  });
});
test("TreeRow: keyboard moves, collapses, expands and jumps", async () => {
  await inPreview("TreeRow", async (page) => {
    await treeRow(page, "Lights").click();
    await keys(page, "ArrowDown");
    assert2.deepEqual(await treeSelected(page), ["Light Source"]);
    await keys(page, "ArrowLeft");
    assert2.deepEqual(await treeSelected(page), ["Lights"], "Left on a leaf selects the parent");
    await keys(page, "ArrowLeft");
    assert2.equal(await treeRow(page, "Lights").getAttribute("aria-expanded"), "false");
    assert2.ok(!(await treeLabels(page)).includes("Light Source"));
    await keys(page, "ArrowDown");
    assert2.deepEqual(await treeSelected(page), ["StaticMeshes"], "Down skips the hidden children");
    await keys(page, "ArrowUp", "ArrowRight");
    assert2.equal(await treeRow(page, "Lights").getAttribute("aria-expanded"), "true");
    await keys(page, "ArrowRight");
    assert2.deepEqual(await treeSelected(page), ["Light Source"], "Right on an open parent selects the first child");
    await keys(page, "End");
    assert2.deepEqual(await treeSelected(page), ["Starter_Background"]);
    await keys(page, "Home");
    assert2.deepEqual(await treeSelected(page), ["Lights"]);
    await keys(page, "Shift+ArrowDown", "Shift+ArrowDown");
    assert2.deepEqual(await treeSelected(page), ["Lights", "Light Source", "SkyLight"]);
    await keys(page, "ArrowDown");
    assert2.deepEqual(await treeSelected(page), ["PointLight"]);
    await keys(page, "Control+Space");
    assert2.deepEqual(await treeSelected(page), [], "Ctrl+Space toggles the focused row off");
    await keys(page, "Space");
    assert2.deepEqual(await treeSelected(page), ["PointLight"]);
    await keys(page, "Enter");
    assert2.deepEqual(await treeSelected(page), ["PointLight"]);
  });
});
test("TreeRow: rows alternate even and odd by visible position", async () => {
  await inPreview("TreeRow", async (page) => {
    await treeRow(page, "Lights").locator(".tr-arrow").click();
    const odd = await page.$$eval("ue-tree-row .tr-row:not([hidden])", (els) => els.map((el) => el.classList.contains("is-odd")));
    assert2.deepEqual(odd, odd.map((_, i) => i % 2 === 1));
    await parkPointer(page);
    assert2.equal(await bgOf(page.locator("ue-tree-row .tr-row:not([hidden])").nth(1)), rgb("background"));
  });
});
test("TreeRow: pinned specimens stay pinned", async () => {
  await inPreview("TreeRow", async (page) => {
    const first = page.locator(".tr-page > .tr-row").first();
    const specimen = page.locator(".tr-page > .tr-row.is-selected:not(.is-inactive)");
    await first.click();
    await first.hover();
    assert2.equal(await bgOf(first), rgb("recessed"));
    assert2.equal(await bgOf(specimen), rgb("select"));
    await clickBlank(page);
    assert2.equal(await bgOf(specimen), rgb("select"), "a pinned active row never turns inactive");
    assert2.equal(await bgOf(page.locator(".tr-page > .tr-row.is-selected.is-inactive")), rgb("select-inactive"));
    assert2.equal(await bgOf(page.locator(".tr-page > .tr-row.is-parent")), rgb("select-parent"));
    assert2.equal(await page.locator("ue-tree-row .tr-row.is-selected").count(), 0, "nothing in the live tree got selected");
  });
});
var labelHead = (page) => page.locator('ue-header-row .hr-cell[data-column="label"]');
var typeHead = (page) => page.locator('ue-header-row .hr-cell[data-column="type"]');
var arrowHref = (cell) => cell.locator(".hr-sort use").getAttribute("href");
var arrowShown = (cell) => cell.locator(".hr-sort").evaluate((el) => getComputedStyle(el).display !== "none");
test("HeaderRow: clicking a sortable header cycles ascending and descending, and the arrow flips", async () => {
  await inPreview("HeaderRow", async (page) => {
    const head = labelHead(page);
    assert2.equal(await head.getAttribute("aria-sort"), "ascending");
    assert2.equal(await arrowHref(head), "#hr-up");
    assert2.equal(await arrowShown(typeHead(page)), false);
    await head.click();
    assert2.equal(await head.getAttribute("aria-sort"), "descending");
    assert2.equal(await arrowHref(head), "#hr-down");
    await head.click();
    assert2.equal(await head.getAttribute("aria-sort"), "ascending");
    assert2.equal(await arrowHref(head), "#hr-up");
  });
});
test("HeaderRow: sorting another column moves the primary arrow, shift adds a secondary one", async () => {
  await inPreview("HeaderRow", async (page) => {
    const head = labelHead(page);
    const type = typeHead(page);
    await type.click();
    assert2.equal(await type.getAttribute("aria-sort"), "ascending");
    assert2.equal(await arrowShown(type), true);
    assert2.equal(await head.getAttribute("aria-sort"), "none");
    assert2.equal(await arrowShown(head), false);
    await head.click({ modifiers: ["Shift"] });
    assert2.equal(await head.getAttribute("aria-sort"), "ascending");
    assert2.equal(await arrowHref(head), "#hr-up2", "secondary arrow");
    assert2.equal(await arrowHref(type), "#hr-up", "primary stays");
    await head.click({ modifiers: ["Shift"] });
    assert2.equal(await arrowHref(head), "#hr-down2");
  });
});
test("HeaderRow: Enter and Space on a focused header sort it", async () => {
  await inPreview("HeaderRow", async (page) => {
    const type = typeHead(page);
    await type.focus();
    await keys(page, "Enter");
    assert2.equal(await type.getAttribute("aria-sort"), "ascending");
    await keys(page, "Space");
    assert2.equal(await type.getAttribute("aria-sort"), "descending");
    assert2.equal(await arrowHref(type), "#hr-down");
  });
});
test("HeaderRow: a sortable cell takes the Dropdown fill on hover, a fixed cell does not", async () => {
  await inPreview("HeaderRow", async (page) => {
    const type = typeHead(page);
    await parkPointer(page);
    assert2.equal(await bgOf(type), rgb("header"));
    await type.hover();
    assert2.equal(await bgOf(type), rgb("dropdown"));
    const gutter = page.locator("ue-header-row .hr-cell.is-gutter");
    await gutter.hover();
    assert2.equal(await bgOf(gutter), rgb("header"));
  });
});
async function dragGrip(page, dx) {
  const from = centre(await page.locator("ue-header-row .hr-grip").boundingBox());
  await movePointer(page, from.x, from.y);
  await holdPointer(page);
  await movePointer(page, from.x + dx / 2, from.y, 4);
  await movePointer(page, from.x + dx, from.y, 4);
  await releasePointer(page);
}
test("HeaderRow: dragging the splitter resizes the two columns and keeps their sum", async () => {
  await inPreview("HeaderRow", async (page) => {
    const head = labelHead(page);
    const type = typeHead(page);
    const before = [await widthOf(head), await widthOf(type)];
    await dragGrip(page, -60);
    const after = [await widthOf(head), await widthOf(type)];
    assert2.ok(Math.abs(after[0] - (before[0] - 60)) < 1.5, "label shrank by 60: " + before[0] + " to " + after[0]);
    assert2.ok(Math.abs(after[1] - (before[1] + 60)) < 1.5, "type grew by 60");
    assert2.ok(Math.abs(after[0] + after[1] - (before[0] + before[1])) < 1);
    assert2.equal(await head.getAttribute("aria-sort"), "ascending", "a drag does not sort");
  });
});
test("HeaderRow: a column never gets narrower than 20px", async () => {
  await inPreview("HeaderRow", async (page) => {
    const head = labelHead(page);
    const type = typeHead(page);
    const total = await widthOf(head) + await widthOf(type);
    await dragGrip(page, -300);
    assert2.ok(Math.abs(await widthOf(head) - 20) < 0.5, "label stops at 20");
    assert2.ok(Math.abs(await widthOf(type) - (total - 20)) < 0.5);
    await page.locator("ue-header-row .hr-grip").focus();
    await keys(page, ...Array(60).fill("ArrowRight"));
    assert2.ok(Math.abs(await widthOf(type) - 20) < 0.5, "type stops at 20");
  });
});
test("HeaderRow: the splitter resizes from the keyboard", async () => {
  await inPreview("HeaderRow", async (page) => {
    const head = labelHead(page);
    const before = await widthOf(head);
    await page.locator("ue-header-row .hr-grip").focus();
    await keys(page, "ArrowRight");
    assert2.ok(Math.abs(await widthOf(head) - (before + 8)) < 1);
    await keys(page, "ArrowLeft", "ArrowLeft");
    assert2.ok(Math.abs(await widthOf(head) - (before - 8)) < 1);
  });
});
test("HeaderRow: pinned specimens keep their forced state", async () => {
  await inPreview("HeaderRow", async (page) => {
    assert2.equal(await bgOf(page.locator(".hr-page > .hr-row .hr-cell.is-hover")), rgb("dropdown"));
    const cell = page.locator(".hr-page > .hr-row").nth(1).locator(".hr-cell.is-text").nth(1);
    await cell.hover();
    assert2.equal(await bgOf(cell), rgb("header"), "a pinned cell has no sort and no hover");
    await cell.click();
    assert2.equal(await cell.getAttribute("aria-sort"), null);
  });
});
var MIN_THUMB = 35;
var PAD = 2;
var outlinerRow = (page, label) => rowIn(page, "ue-scene-outliner", ".so-row", ".so-text", label);
var outlinerLabels = (page) => visibleLabels(page, "ue-scene-outliner", ".so-row", ".so-text");
var status = (page) => page.locator("ue-scene-outliner .so-status").innerText();
var selectedLabels = (page) => page.$$eval("ue-scene-outliner .so-row.is-selected .so-text", (els) => els.map((el) => el.textContent ?? ""));
test("SceneOutliner: starts with Chair selected and inactive, parents tinted, footer from the real count", async () => {
  await inPreview("SceneOutliner", async (page) => {
    assert2.deepEqual(await selectedLabels(page), ["Chair"]);
    assert2.equal(await status(page), "15 actors (1 selected)");
    assert2.equal(await bgOf(outlinerRow(page, "Chair")), rgb("select-inactive"));
    await parkPointer(page);
    for (const parent of ["Furniture", "StaticMeshes", "Minimal_Default"]) assert2.equal(await bgOf(outlinerRow(page, parent)), rgb("select-parent"), parent);
    assert2.equal(await bgOf(outlinerRow(page, "Lights")), rgb("recessed"));
    assert2.equal(await bgOf(outlinerRow(page, "Audio")), rgb("background"));
  });
});
test("SceneOutliner: click selects active, focus loss turns it inactive, folders do not count as actors", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const wind = outlinerRow(page, "Ambient_Wind");
    await wind.click();
    assert2.deepEqual(await selectedLabels(page), ["Ambient_Wind"]);
    assert2.equal(await bgOf(wind), rgb("select"));
    assert2.equal(await status(page), "15 actors (1 selected)");
    await clickBlank(page);
    await settle(page);
    assert2.equal(await bgOf(wind), rgb("select-inactive"));
    await outlinerRow(page, "Audio").click();
    assert2.equal(await status(page), "15 actors");
    assert2.equal(await bgOf(outlinerRow(page, "Audio")), rgb("select"));
  });
});
test("SceneOutliner: ctrl toggles, shift selects a range, the footer follows", async () => {
  await inPreview("SceneOutliner", async (page) => {
    await outlinerRow(page, "Ambient_Wind").click();
    await outlinerRow(page, "Player Start").click({ modifiers: ["Control"] });
    assert2.deepEqual(await selectedLabels(page), ["Ambient_Wind", "Player Start"]);
    assert2.equal(await status(page), "15 actors (2 selected)");
    await outlinerRow(page, "Light Source").click();
    await outlinerRow(page, "SkyLight").click({ modifiers: ["Shift"] });
    assert2.deepEqual(await selectedLabels(page), ["Light Source", "PointLight", "SkyLight"]);
    assert2.equal(await status(page), "15 actors (3 selected)");
    await outlinerRow(page, "PointLight").click({ modifiers: ["Control"] });
    assert2.equal(await status(page), "15 actors (2 selected)");
  });
});
test("SceneOutliner: the caret collapses a folder and indents 12px per level", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const indent = (label) => widthOf(outlinerRow(page, label).locator(".so-indent"));
    assert2.equal(await indent("Minimal_Default"), 6);
    assert2.equal(await indent("Lights"), 18);
    assert2.equal(await indent("Light Source"), 30);
    assert2.equal(await indent("Chair"), 42);
    const before = (await outlinerLabels(page)).length;
    await outlinerRow(page, "Lights").locator(".so-arrow").click();
    const after = await outlinerLabels(page);
    assert2.equal(after.length, before - 4);
    assert2.ok(!after.includes("Light Source"));
    assert2.equal(await outlinerRow(page, "Lights").getAttribute("aria-expanded"), "false");
    await outlinerRow(page, "Lights").locator(".so-arrow").click();
    assert2.equal((await outlinerLabels(page)).length, before);
  });
});
test("SceneOutliner: a collapsed folder that holds the selection keeps the parent tint", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const meshes = outlinerRow(page, "StaticMeshes");
    await meshes.locator(".so-arrow").click();
    await parkPointer(page);
    assert2.ok(!(await outlinerLabels(page)).includes("Chair"));
    assert2.equal(await bgOf(meshes), rgb("select-parent"));
    assert2.deepEqual(await selectedLabels(page), ["Chair"], "the hidden selection survives");
    assert2.equal(await status(page), "15 actors (1 selected)");
  });
});
test("SceneOutliner: keyboard navigation", async () => {
  await inPreview("SceneOutliner", async (page) => {
    await outlinerRow(page, "Audio").click();
    await keys(page, "ArrowDown");
    assert2.deepEqual(await selectedLabels(page), ["Ambient_Wind"]);
    await keys(page, "ArrowLeft");
    assert2.deepEqual(await selectedLabels(page), ["Audio"]);
    await keys(page, "ArrowLeft");
    assert2.equal(await outlinerRow(page, "Audio").getAttribute("aria-expanded"), "false");
    assert2.ok(!(await outlinerLabels(page)).includes("Ambient_Wind"));
    await keys(page, "ArrowRight", "ArrowRight");
    assert2.deepEqual(await selectedLabels(page), ["Ambient_Wind"]);
    await keys(page, "End");
    assert2.deepEqual(await selectedLabels(page), ["Lamp_Floor"]);
    await keys(page, "Home");
    assert2.deepEqual(await selectedLabels(page), ["Minimal_Default"]);
    await keys(page, "ArrowDown", "Shift+ArrowDown");
    assert2.deepEqual(await selectedLabels(page), ["Audio", "Ambient_Wind"]);
    assert2.equal(await status(page), "15 actors (1 selected)");
    await keys(page, "Enter");
    assert2.deepEqual(await selectedLabels(page), ["Ambient_Wind"]);
  });
});
test("SceneOutliner: the eye shows on a hovered row and toggles open and closed", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const eyeOf = (label) => outlinerRow(page, label).locator(".so-eye");
    const visibility = (label) => eyeOf(label).evaluate((el) => getComputedStyle(el).visibility);
    await parkPointer(page);
    assert2.equal(await visibility("Player Start"), "hidden");
    await outlinerRow(page, "Player Start").hover();
    assert2.equal(await visibility("Player Start"), "visible");
    assert2.equal(await visibility("Light Source"), "hidden");
    await eyeOf("Player Start").click();
    assert2.deepEqual(await selectedLabels(page), ["Chair"], "the eye does not select");
    assert2.equal(await eyeOf("Player Start").locator("use").getAttribute("href"), "#so-eye-off");
    await parkPointer(page);
    assert2.equal(await visibility("Player Start"), "visible", "a hidden item keeps its closed eye");
    await eyeOf("Player Start").click();
    assert2.equal(await eyeOf("Player Start").locator("use").getAttribute("href"), "#so-eye");
    await outlinerRow(page, "Lights").locator(".so-gutter").click();
    await parkPointer(page);
    for (const child of ["Light Source", "PointLight", "SkyLight", "SpotLight"]) assert2.equal(await visibility(child), "visible", child + " hidden with its folder");
    assert2.equal(await visibility("Chair"), "visible", "a selected row shows its eye");
    assert2.equal(await visibility("Player Start"), "hidden");
  });
});
test("SceneOutliner: the search box filters, keeps ancestors, opens them and restores on clear", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const input = page.locator("ue-scene-outliner .so-input");
    const wipe = page.locator("ue-scene-outliner .so-clear");
    assert2.equal(await shown(wipe), false);
    await outlinerRow(page, "Lights").locator(".so-arrow").click();
    await input.fill("skylight");
    assert2.deepEqual(await outlinerLabels(page), ["Minimal_Default", "Lights", "SkyLight"]);
    assert2.equal(await outlinerRow(page, "Lights").getAttribute("aria-expanded"), "true", "the ancestor opens");
    assert2.equal(await status(page), "Showing 1 of 15 actors (1 selected)");
    assert2.equal(await colorOf(page.locator("ue-scene-outliner .so-status")), rgb("accent-green"));
    assert2.equal(await shown(wipe), true);
    await wipe.click();
    assert2.equal(await input.inputValue(), "");
    assert2.equal((await outlinerLabels(page)).length, 19, "Lights is collapsed again: 23 rows minus 4");
    assert2.equal(await outlinerRow(page, "Lights").getAttribute("aria-expanded"), "false");
    assert2.equal(await status(page), "15 actors (1 selected)");
    await input.fill("SKY");
    assert2.deepEqual(await outlinerLabels(page), ["Minimal_Default", "Lights", "SkyLight", "Sky and Fog", "BP_Sky_Sphere"]);
    assert2.equal(await status(page), "Showing 2 of 15 actors (1 selected)");
  });
});
test("SceneOutliner: a filter with no match reads red, Escape clears it", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const input = page.locator("ue-scene-outliner .so-input");
    const line = page.locator("ue-scene-outliner .so-status");
    await input.fill("zzz");
    assert2.deepEqual(await outlinerLabels(page), []);
    assert2.equal(await status(page), "No matching actors (15 total)");
    assert2.equal(await colorOf(line), rgb("accent-red"));
    await keys(page, "Escape");
    assert2.equal(await input.inputValue(), "");
    assert2.equal((await outlinerLabels(page)).length, 23);
    assert2.equal(await colorOf(line), rgb("foreground"));
    assert2.equal(await page.locator("ue-scene-outliner .so-search").evaluate((el) => getComputedStyle(el).borderTopColor), rgb("primary"), "focused outline is Primary");
  });
});
test("SceneOutliner: sorting by Item Label or Type reorders rows within each parent", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const head = page.locator('ue-scene-outliner .so-hcell[data-column="label"]');
    const type = page.locator('ue-scene-outliner .so-hcell[data-column="type"]');
    const initial = await outlinerLabels(page);
    assert2.deepEqual(initial.slice(0, 4), ["Minimal_Default", "Audio", "Ambient_Wind", "Starter_Background"]);
    await head.click();
    assert2.equal(await head.getAttribute("aria-sort"), "descending");
    assert2.equal(await head.locator("use").getAttribute("href"), "#so-down");
    const desc = await outlinerLabels(page);
    assert2.deepEqual(desc.slice(0, 9), ["Minimal_Default", "StaticMeshes", "Lamp_Floor", "Bookshelf", "Furniture", "Table", "Sofa", "Chair", "Sky and Fog"]);
    assert2.deepEqual([...desc].sort(), [...initial].sort(), "same rows");
    await head.click();
    assert2.deepEqual(await outlinerLabels(page), initial, "ascending restores the first order");
    await type.click();
    assert2.equal(await type.getAttribute("aria-sort"), "ascending");
    assert2.equal(await head.getAttribute("aria-sort"), "none");
    assert2.equal(await head.locator(".so-sort").evaluate((el) => getComputedStyle(el).display), "none");
    const byType = await outlinerLabels(page);
    const lightsAt = byType.indexOf("Lights");
    assert2.deepEqual(byType.slice(lightsAt + 1, lightsAt + 5), ["Light Source", "PointLight", "SkyLight", "SpotLight"], "DirectionalLight, PointLight, SkyLight, SpotLight");
    await type.click();
    const byTypeDesc = await outlinerLabels(page);
    const lightsDesc = byTypeDesc.indexOf("Lights");
    assert2.deepEqual(byTypeDesc.slice(lightsDesc + 1, lightsDesc + 5), ["SpotLight", "SkyLight", "PointLight", "Light Source"]);
    assert2.deepEqual(await selectedLabels(page), ["Chair"], "sorting keeps the selection");
  });
});
test("SceneOutliner: stripes follow the visible order after a sort", async () => {
  await inPreview("SceneOutliner", async (page) => {
    await page.locator('ue-scene-outliner .so-hcell[data-column="type"]').click();
    const odd = await page.$$eval("ue-scene-outliner .so-row:not([hidden])", (els) => els.map((el) => el.classList.contains("is-odd")));
    assert2.deepEqual(odd, odd.map((_, i) => i % 2 === 1));
  });
});
test("SceneOutliner: the header cell takes the Dropdown fill on hover", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const type = page.locator('ue-scene-outliner .so-hcell[data-column="type"]');
    await parkPointer(page);
    assert2.equal(await bgOf(type), rgb("header"));
    await type.hover();
    assert2.equal(await bgOf(type), rgb("dropdown"));
  });
});
var geometry = (page) => page.evaluate(() => {
  const view = document.querySelector("ue-scene-outliner .so-rows");
  const thumb = document.querySelector("ue-scene-outliner .so-thumb");
  const bar = thumb?.parentElement;
  if (!view || !thumb || !bar) throw new Error("outliner parts");
  const t = thumb.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  return { scrollTop: view.scrollTop, scrollHeight: view.scrollHeight, clientHeight: view.clientHeight, top: t.top - b.top, height: t.height };
});
function expectedThumb(g) {
  const biased = g.clientHeight - 2 * PAD - MIN_THUMB;
  return { top: PAD + biased * (g.scrollTop / g.scrollHeight), height: MIN_THUMB + biased * (g.clientHeight / g.scrollHeight) };
}
test("SceneOutliner: the scrollbar thumb follows the rows, wheel, drag and track click scroll them", async () => {
  await inPreview("SceneOutliner", async (page) => {
    let g = await geometry(page);
    assert2.ok(g.scrollHeight > g.clientHeight, "real overflow");
    assert2.equal(g.scrollTop, 0);
    assert2.ok(Math.abs(g.top - PAD) < 0.5);
    assert2.ok(Math.abs(g.height - expectedThumb(g).height) < 0.5, "thumb length 35 + (track - 35) x fraction");
    await movePointer(page, 100, 200);
    await spin(page, 0, 60);
    await page.waitForFunction(() => (document.querySelector("ue-scene-outliner .so-rows")?.scrollTop ?? 0) > 0);
    await settle(page);
    g = await geometry(page);
    assert2.ok(g.scrollTop > 0, "wheel scrolls");
    assert2.ok(Math.abs(g.top - expectedThumb(g).top) < 0.5, "thumb follows");
    const bar = page.locator("ue-scene-outliner .so-sb");
    const thumb = page.locator("ue-scene-outliner .so-thumb");
    const barBox = await bar.boundingBox();
    assert2.ok(barBox);
    const grab = centre(await thumb.boundingBox());
    const start = g.scrollTop;
    await movePointer(page, grab.x, grab.y);
    assert2.equal(await bgOf(thumb), rgb("hover-2"), "hovered thumb");
    await holdPointer(page);
    await movePointer(page, grab.x, grab.y + 10, 3);
    await movePointer(page, grab.x, grab.y + 30, 3);
    assert2.ok((await classes(bar)).includes("is-drag"));
    assert2.equal(await bgOf(thumb), rgb("hover-2"), "dragged thumb");
    await releasePointer(page);
    await settle(page);
    g = await geometry(page);
    const biased = g.clientHeight - 2 * PAD - MIN_THUMB;
    assert2.ok(Math.abs(g.scrollTop - Math.min(g.scrollHeight - g.clientHeight, start + 30 * g.scrollHeight / biased)) < 4, "drag scrolls: " + start + " to " + g.scrollTop);
    assert2.ok(!(await classes(bar)).includes("is-drag"));
    await page.mouse.click(barBox.x + barBox.width / 2, barBox.y + 8);
    await settle(page);
    g = await geometry(page);
    assert2.equal(g.scrollTop, 0, "clicking the top of the track scrolls to the top");
    await page.mouse.click(barBox.x + barBox.width / 2, barBox.y + barBox.height - 3);
    await settle(page);
    g = await geometry(page);
    assert2.equal(g.scrollTop, g.scrollHeight - g.clientHeight, "clicking the bottom scrolls to the end");
    assert2.ok(Math.abs(g.top + g.height - (g.clientHeight - PAD)) < 0.5, "thumb ends at the track end");
  });
});
test("SceneOutliner: the bar and the header spacer go away while the rows fit", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const bar = page.locator("ue-scene-outliner .so-sb");
    const spacer = page.locator("ue-scene-outliner .so-hspacer");
    assert2.equal(await shown(bar), true);
    assert2.equal(await shown(spacer), true);
    const withBar = await widthOf(outlinerRow(page, "Audio"));
    await page.locator("ue-scene-outliner .so-input").fill("chair");
    await settle(page);
    assert2.equal(await shown(bar), false);
    assert2.equal(await shown(spacer), false);
    assert2.ok((await classes(page.locator("ue-scene-outliner .so-hcells"))).includes("is-no-bar"));
    assert2.ok(await widthOf(outlinerRow(page, "Chair")) >= withBar + 15.5, "rows take the freed 16px");
    await page.locator("ue-scene-outliner .so-input").fill("");
    await settle(page);
    assert2.equal(await shown(bar), true);
    assert2.equal(await shown(spacer), true);
  });
});
test("SceneOutliner: the pinned specimen stays pinned", async () => {
  await inPreview("SceneOutliner", async (page) => {
    const specimen = page.locator(".so-col").nth(1);
    assert2.equal(await bgOf(specimen.locator(".so-row.is-selected.is-inactive")), rgb("select-inactive"));
    const row = specimen.locator(".so-row").nth(2);
    await parkPointer(page);
    const before = await bgOf(row);
    await row.hover();
    assert2.equal(await bgOf(row), before, "a pinned row has no hover");
    await row.click();
    assert2.equal(await specimen.locator(".so-row.is-selected").count(), 1);
    assert2.equal(await specimen.locator(".so-eye").count(), 2);
  });
});
function barState(page, index, vertical) {
  return page.evaluate(([i, v]) => {
    const host = document.querySelectorAll("ue-scrollbar .sb-scroll")[i];
    const view = host.querySelector(".sb-view");
    const bar = host.querySelector(".sb");
    const thumb = host.querySelector(".sb-thumb");
    if (!view || !bar || !thumb) throw new Error("box parts");
    const b = bar.getBoundingClientRect();
    const t = thumb.getBoundingClientRect();
    return v ? { scroll: view.scrollTop, content: view.scrollHeight, view: view.clientHeight, start: t.top - b.top, size: t.height, slot: b.height } : { scroll: view.scrollLeft, content: view.scrollWidth, view: view.clientWidth, start: t.left - b.left, size: t.width, slot: b.width };
  }, [index, vertical]);
}
function expectedBar(s) {
  const biased = s.slot - 2 * PAD - MIN_THUMB;
  return { start: PAD + biased * (s.scroll / s.content), size: MIN_THUMB + biased * (s.view / s.content) };
}
var live = (page, index) => page.locator("ue-scrollbar .sb-scroll").nth(index);
async function dragBy(page, thumb, dx, dy) {
  const from = centre(await thumb.boundingBox());
  await movePointer(page, from.x, from.y);
  await holdPointer(page);
  await movePointer(page, from.x + dx / 2, from.y + dy / 2, 3);
  await movePointer(page, from.x + dx, from.y + dy, 3);
  await releasePointer(page);
  await settle(page);
}
test("Scrollbar: the vertical thumb length and position follow the content", async () => {
  await inPreview("Scrollbar", async (page) => {
    let s = await barState(page, 0, true);
    assert2.ok(s.content > s.view);
    assert2.ok(Math.abs(s.size - expectedBar(s).size) < 0.5, "length: " + s.size);
    assert2.ok(Math.abs(s.start - PAD) < 0.5);
    await live(page, 0).locator(".sb-view").evaluate((el) => {
      el.scrollTop = 120;
    });
    await settle(page);
    s = await barState(page, 0, true);
    assert2.equal(s.scroll, 120);
    assert2.ok(Math.abs(s.start - expectedBar(s).start) < 0.5, "position " + s.start);
    await live(page, 0).locator(".sb-view").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await settle(page);
    s = await barState(page, 0, true);
    assert2.ok(Math.abs(s.start + s.size - (s.slot - PAD)) < 0.5, "thumb ends 2px from the slot end");
  });
});
test("Scrollbar: dragging the thumb scrolls the view", async () => {
  await inPreview("Scrollbar", async (page) => {
    const first = live(page, 0);
    await dragBy(page, first.locator(".sb-thumb"), 0, 30);
    const s = await barState(page, 0, true);
    const biased = s.slot - 2 * PAD - MIN_THUMB;
    assert2.ok(Math.abs(s.scroll - 30 * s.content / biased) < 4, "scrolled " + s.scroll);
    assert2.ok(!(await classes(first.locator(".sb"))).includes("is-drag"));
    await dragBy(page, first.locator(".sb-thumb"), 0, -500);
    assert2.equal((await barState(page, 0, true)).scroll, 0, "dragging past the top stops at the top");
    await dragBy(page, first.locator(".sb-thumb"), 0, 500);
    const end = await barState(page, 0, true);
    assert2.equal(end.scroll, end.content - end.view);
  });
});
test("Scrollbar: the thumb is Hover at rest, Hover2 on bar hover and while dragged", async () => {
  await inPreview("Scrollbar", async (page) => {
    const first = live(page, 0);
    const thumb = first.locator(".sb-thumb");
    await parkPointer(page);
    assert2.equal(await bgOf(thumb), rgb("hover"));
    await first.locator(".sb").hover({ position: { x: 8, y: 140 } });
    assert2.equal(await bgOf(thumb), rgb("hover-2"), "the whole bar is the hover target");
    await parkPointer(page);
    const grab = centre(await thumb.boundingBox());
    await movePointer(page, grab.x, grab.y);
    await holdPointer(page);
    await movePointer(page, grab.x + 200, grab.y + 40, 4);
    assert2.ok((await classes(first.locator(".sb"))).includes("is-drag"));
    assert2.equal(await bgOf(thumb), rgb("hover-2"), "dragged, pointer outside the bar");
    await releasePointer(page);
    await parkPointer(page);
    assert2.equal(await bgOf(thumb), rgb("hover"));
    assert2.equal(await thumb.evaluate((el) => getComputedStyle(el).width), "8px");
    assert2.equal(await thumb.evaluate((el) => getComputedStyle(el).borderTopLeftRadius), "4px");
  });
});
test("Scrollbar: the wheel scrolls over the view and over the bar", async () => {
  await inPreview("Scrollbar", async (page) => {
    const over = centre(await live(page, 0).locator(".sb-view").boundingBox());
    const onBar = centre(await live(page, 0).locator(".sb").boundingBox());
    await movePointer(page, over.x, over.y);
    await spin(page, 0, 50);
    await page.waitForFunction(() => (document.querySelector("ue-scrollbar .sb-view")?.scrollTop ?? 0) > 0);
    await settle(page);
    let s = await barState(page, 0, true);
    assert2.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
    const afterView = s.scroll;
    await movePointer(page, onBar.x, onBar.y);
    await spin(page, 0, 50);
    await page.waitForFunction((before) => (document.querySelector("ue-scrollbar .sb-view")?.scrollTop ?? 0) > before, afterView);
    s = await barState(page, 0, true);
    assert2.ok(s.scroll > afterView, "the bar forwards the wheel");
  });
});
test("Scrollbar: clicking the track centres the thumb on the pointer", async () => {
  await inPreview("Scrollbar", async (page) => {
    const bar = await live(page, 0).locator(".sb").boundingBox();
    assert2.ok(bar);
    await page.mouse.click(bar.x + 8, bar.y + 100);
    await settle(page);
    const s = await barState(page, 0, true);
    assert2.ok(Math.abs(s.start + s.size / 2 - 100) < 6, "thumb centre " + (s.start + s.size / 2));
    assert2.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
  });
});
test("Scrollbar: a very long content keeps the 35px minimum thumb", async () => {
  await inPreview("Scrollbar", async (page) => {
    const s = await barState(page, 1, true);
    assert2.ok(s.size >= MIN_THUMB && s.size < MIN_THUMB + 2, "thumb " + s.size);
    assert2.ok(Math.abs(s.size - expectedBar(s).size) < 0.5);
    await dragBy(page, live(page, 1).locator(".sb-thumb"), 0, 60);
    const moved = await barState(page, 1, true);
    assert2.ok(moved.scroll > 1e3, "a small drag scrolls far: " + moved.scroll);
  });
});
test("Scrollbar: the 12px ScrollBox slot places the thumb 2px from the edge", async () => {
  await inPreview("Scrollbar", async (page) => {
    const boxed = live(page, 2);
    assert2.equal(await widthOf(boxed.locator(".sb")), 12);
    assert2.equal(await boxed.locator(".sb-thumb").evaluate((el) => getComputedStyle(el).left), "2px");
    const s = await barState(page, 2, true);
    assert2.ok(Math.abs(s.size - expectedBar(s).size) < 0.5);
    assert2.equal(await widthOf(live(page, 0).locator(".sb")), 16);
    assert2.equal(await live(page, 0).locator(".sb-thumb").evaluate((el) => getComputedStyle(el).left), "4px");
  });
});
test("Scrollbar: the horizontal bar follows scrollLeft, drags and takes the wheel", async () => {
  await inPreview("Scrollbar", async (page) => {
    const sideways = live(page, 3);
    let s = await barState(page, 3, false);
    assert2.ok(s.content > s.view);
    assert2.ok(Math.abs(s.size - expectedBar(s).size) < 0.5);
    assert2.equal(await sideways.locator(".sb-thumb").evaluate((el) => getComputedStyle(el).top), "4px");
    assert2.equal(await sideways.locator(".sb-thumb").evaluate((el) => getComputedStyle(el).height), "8px");
    await sideways.locator(".sb-view").evaluate((el) => {
      el.scrollLeft = 100;
    });
    await settle(page);
    s = await barState(page, 3, false);
    assert2.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
    await dragBy(page, sideways.locator(".sb-thumb"), -500, 0);
    assert2.equal((await barState(page, 3, false)).scroll, 0);
    await dragBy(page, sideways.locator(".sb-thumb"), 20, 0);
    const dragged = await barState(page, 3, false);
    const biased = dragged.slot - 2 * PAD - MIN_THUMB;
    assert2.ok(Math.abs(dragged.scroll - 20 * dragged.content / biased) < 4, "scrolled " + dragged.scroll);
    const over = centre(await sideways.locator(".sb-view").boundingBox());
    await movePointer(page, over.x, over.y);
    await spin(page, 60, 0);
    await page.waitForFunction((before) => (document.querySelectorAll("ue-scrollbar .sb-view")[3]?.scrollLeft ?? 0) > before, dragged.scroll);
    assert2.ok((await barState(page, 3, false)).scroll > dragged.scroll, "sideways wheel scrolls");
  });
});
test("Scrollbar: a focused view scrolls from the keyboard and the thumb follows", async () => {
  await inPreview("Scrollbar", async (page) => {
    await live(page, 0).locator(".sb-view").focus();
    await keys(page, "PageDown");
    await settle(page);
    let s = await barState(page, 0, true);
    assert2.ok(s.scroll > 0);
    assert2.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
    await keys(page, "End");
    await page.waitForFunction(() => {
      const view = document.querySelector("ue-scrollbar .sb-view");
      return view !== null && view.scrollTop >= view.scrollHeight - view.clientHeight - 1;
    });
    await settle(page);
    s = await barState(page, 0, true);
    assert2.ok(Math.abs(s.scroll - (s.content - s.view)) < 1);
    assert2.ok(Math.abs(s.start + s.size - (s.slot - PAD)) < 0.5, "thumb at the end");
    await keys(page, "Home");
    await page.waitForFunction(() => (document.querySelector("ue-scrollbar .sb-view")?.scrollTop ?? 1) === 0);
    await settle(page);
    assert2.ok(Math.abs((await barState(page, 0, true)).start - PAD) < 0.5);
  });
});
test("Scrollbar: pinned specimens do not react to the pointer", async () => {
  await inPreview("Scrollbar", async (page) => {
    const specimen = page.locator(".sb-page > .sb-group").nth(1).locator(".sb").first();
    const thumb = specimen.locator(".sb-thumb");
    assert2.equal(await bgOf(thumb), rgb("hover"));
    await specimen.hover();
    assert2.equal(await bgOf(thumb), rgb("hover"), "a pinned normal specimen stays normal under the pointer");
    assert2.equal(await bgOf(page.locator(".sb.is-hover .sb-thumb").first()), rgb("hover-2"));
    assert2.equal(await bgOf(page.locator(".sb.is-drag .sb-thumb").first()), rgb("hover-2"));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsib3V0bGluZXIudGVzdC50cyIsICJwcmV2aWV3LWtpdC50cyIsICJsaWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBCZWhhdmlvdXIgdGVzdHMgZm9yIHRoZSBPdXRsaW5lciBncm91cDogVHJlZVJvdywgSGVhZGVyUm93LCBTY2VuZU91dGxpbmVyIGFuZCBTY3JvbGxiYXIgcHJldmlld3MuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0L3N0cmljdCc7XG5pbXBvcnQgeyB0ZXN0IH0gZnJvbSAnbm9kZTp0ZXN0JztcbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgYmdPZiwgY2VudHJlLCBjbGFzc2VzLCBjbGlja0JsYW5rLCBjb2xvck9mLCBob2xkUG9pbnRlciwgaW5QcmV2aWV3LCBrZXlzLCBtb3ZlUG9pbnRlciwgcGFya1BvaW50ZXIsIHJlbGVhc2VQb2ludGVyLCByZ2IsIHJvd0luLCBzZXR0bGUsIHNob3duLCBzcGluLCB2aXNpYmxlTGFiZWxzLCB3aWR0aE9mIH0gZnJvbSAnLi9wcmV2aWV3LWtpdC50cyc7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gVHJlZVJvd1xuXG5jb25zdCB0cmVlUm93ID0gKHBhZ2U6IFBhZ2UsIGxhYmVsOiBzdHJpbmcpOiBMb2NhdG9yID0+IHJvd0luKHBhZ2UsICd1ZS10cmVlLXJvdycsICcudHItcm93JywgJy50ci10ZXh0JywgbGFiZWwpO1xuY29uc3QgdHJlZUxhYmVscyA9IChwYWdlOiBQYWdlKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4gdmlzaWJsZUxhYmVscyhwYWdlLCAndWUtdHJlZS1yb3cnLCAnLnRyLXJvdycsICcudHItdGV4dCcpO1xuY29uc3QgdHJlZVNlbGVjdGVkID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZ1tdPiA9PiBwYWdlLiQkZXZhbCgndWUtdHJlZS1yb3cgLnRyLXJvdy5pcy1zZWxlY3RlZCAudHItdGV4dCcsIChlbHMpID0+IGVscy5tYXAoKGVsKSA9PiBlbC50ZXh0Q29udGVudCA/PyAnJykpO1xuXG50ZXN0KCdUcmVlUm93OiBjbGljayBzZWxlY3RzLCBhY3RpdmUgd2hpbGUgZm9jdXNlZCBhbmQgaW5hY3RpdmUgYWZ0ZXIgZm9jdXMgbGVhdmVzJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1RyZWVSb3cnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGNoYWlyID0gdHJlZVJvdyhwYWdlLCAnQ2hhaXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgY2hhaXIuZ2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJyksICdmYWxzZScpO1xuXHRcdGF3YWl0IGNoYWlyLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBjbGFzc2VzKGNoYWlyKSkuaW5jbHVkZXMoJ2lzLXNlbGVjdGVkJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBjaGFpci5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihjaGFpciksIHJnYignc2VsZWN0JykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBjb2xvck9mKGNoYWlyKSwgcmdiKCdmb3JlZ3JvdW5kLWhvdmVyJykpO1xuXHRcdGF3YWl0IGNsaWNrQmxhbmsocGFnZSk7XG5cdFx0YXdhaXQgc2V0dGxlKHBhZ2UpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKGNoYWlyKSwgcmdiKCdzZWxlY3QtaW5hY3RpdmUnKSk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBjbGFzc2VzKGNoYWlyKSkuaW5jbHVkZXMoJ2lzLXNlbGVjdGVkJyksICdzZWxlY3Rpb24gc3RheXMgd2hpbGUgdGhlIHRyZWUgaXMgdW5mb2N1c2VkJyk7XG5cdFx0YXdhaXQgY2hhaXIuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihjaGFpciksIHJnYignc2VsZWN0JyksICdmb2N1cyByZXR1cm5zLCBhY3RpdmUgYWdhaW4nKTtcblx0fSk7XG59KTtcblxudGVzdCgnVHJlZVJvdzogaG92ZXIgZmlsbHMgYW4gdW5zZWxlY3RlZCByb3cgYW5kIGxlYXZlcyBhIHNlbGVjdGVkIHJvdyBhbG9uZScsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdUcmVlUm93JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBza3lsaWdodCA9IHRyZWVSb3cocGFnZSwgJ1NreUxpZ2h0Jyk7XG5cdFx0YXdhaXQgcGFya1BvaW50ZXIocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2Yoc2t5bGlnaHQpLCByZ2IoJ3JlY2Vzc2VkJykpO1xuXHRcdGF3YWl0IHNreWxpZ2h0LmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2Yoc2t5bGlnaHQpLCByZ2IoJ3NlbGVjdC1ob3ZlcicpKTtcblx0XHRhd2FpdCBza3lsaWdodC5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHNreWxpZ2h0KSwgcmdiKCdzZWxlY3QnKSk7XG5cdFx0YXdhaXQgc2t5bGlnaHQuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihza3lsaWdodCksIHJnYignc2VsZWN0JyksICdzZWxlY3RlZCByb3cga2VlcHMgaXRzIGZpbGwgb24gaG92ZXInKTtcblx0fSk7XG59KTtcblxudGVzdCgnVHJlZVJvdzogY3RybC1jbGljayB0b2dnbGVzLCBzaGlmdC1jbGljayBzZWxlY3RzIGEgcmFuZ2UnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnVHJlZVJvdycsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0YXdhaXQgdHJlZVJvdyhwYWdlLCAnQ2hhaXInKS5jbGljaygpO1xuXHRcdGF3YWl0IHRyZWVSb3cocGFnZSwgJ1RhYmxlJykuY2xpY2soeyBtb2RpZmllcnM6IFsnQ29udHJvbCddIH0pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdHJlZVNlbGVjdGVkKHBhZ2UpLCBbJ0NoYWlyJywgJ1RhYmxlJ10pO1xuXHRcdGF3YWl0IHRyZWVSb3cocGFnZSwgJ0NoYWlyJykuY2xpY2soeyBtb2RpZmllcnM6IFsnQ29udHJvbCddIH0pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdHJlZVNlbGVjdGVkKHBhZ2UpLCBbJ1RhYmxlJ10pO1xuXHRcdGF3YWl0IHRyZWVSb3cocGFnZSwgJ0xpZ2h0IFNvdXJjZScpLmNsaWNrKCk7XG5cdFx0YXdhaXQgdHJlZVJvdyhwYWdlLCAnUG9pbnRMaWdodCcpLmNsaWNrKHsgbW9kaWZpZXJzOiBbJ1NoaWZ0J10gfSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0cmVlU2VsZWN0ZWQocGFnZSksIFsnTGlnaHQgU291cmNlJywgJ1NreUxpZ2h0JywgJ1BvaW50TGlnaHQnXSk7XG5cdFx0YXdhaXQgdHJlZVJvdyhwYWdlLCAnQ2hhaXInKS5jbGljaygpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdHJlZVNlbGVjdGVkKHBhZ2UpLCBbJ0NoYWlyJ10sICdhIHBsYWluIGNsaWNrIHJlcGxhY2VzIHRoZSBzZWxlY3Rpb24nKTtcblx0fSk7XG59KTtcblxudGVzdCgnVHJlZVJvdzogdGhlIGNhcmV0IGNvbGxhcHNlcyBhbmQgZXhwYW5kcywgYW5kIGluZGVudHMgMTJweCBwZXIgbGV2ZWwnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnVHJlZVJvdycsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgbWVzaGVzID0gdHJlZVJvdyhwYWdlLCAnU3RhdGljTWVzaGVzJyk7XG5cdFx0Y29uc3QgaW5kZW50ID0gKGxhYmVsOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4gPT4gd2lkdGhPZih0cmVlUm93KHBhZ2UsIGxhYmVsKS5sb2NhdG9yKCcudHItaW5kZW50JykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBpbmRlbnQoJ0xpZ2h0cycpLCA2KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5kZW50KCdDaGFpcicpLCAxOCk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgdHJlZUxhYmVscyhwYWdlKSkuaW5jbHVkZXMoJ1NvZmEnKSk7XG5cdFx0YXdhaXQgdHJlZVJvdyhwYWdlLCAnRnVybml0dXJlJykubG9jYXRvcignLnRyLWFycm93JykuY2xpY2soKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IHRyZWVMYWJlbHMocGFnZSkpLmluY2x1ZGVzKCdTb2ZhJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBpbmRlbnQoJ1NvZmEnKSwgMzApO1xuXHRcdGF3YWl0IG1lc2hlcy5sb2NhdG9yKCcudHItYXJyb3cnKS5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBtZXNoZXMuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICdmYWxzZScpO1xuXHRcdGNvbnN0IGxhYmVscyA9IGF3YWl0IHRyZWVMYWJlbHMocGFnZSk7XG5cdFx0Zm9yIChjb25zdCBoaWRkZW4gb2YgWydDaGFpcicsICdUYWJsZScsICdGdXJuaXR1cmUnLCAnU29mYScsICdCb29rc2hlbGYnXSkgYXNzZXJ0Lm9rKCFsYWJlbHMuaW5jbHVkZXMoaGlkZGVuKSwgaGlkZGVuICsgJyBoaWRkZW4nKTtcblx0XHRhc3NlcnQub2sobGFiZWxzLmluY2x1ZGVzKCdBdWRpbycpKTtcblx0XHRhd2FpdCBtZXNoZXMubG9jYXRvcignLnRyLWFycm93JykuY2xpY2soKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IHRyZWVMYWJlbHMocGFnZSkpLmluY2x1ZGVzKCdDaGFpcicpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVzaGVzLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAndHJ1ZScpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdUcmVlUm93OiBkb3VibGUtY2xpY2sgZXhwYW5kcywgdGhlIGZvbGRlciBpY29uIG9wZW5zIGFuZCBjbG9zZXMgd2l0aCBpdCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdUcmVlUm93JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBmdXJuaXR1cmUgPSB0cmVlUm93KHBhZ2UsICdGdXJuaXR1cmUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZnVybml0dXJlLmxvY2F0b3IoJy50ci1pY29uIHVzZScpLmdldEF0dHJpYnV0ZSgnaHJlZicpLCAnI3RyLWZvbGRlcicpO1xuXHRcdGF3YWl0IGZ1cm5pdHVyZS5sb2NhdG9yKCcudHItdGV4dCcpLmRibGNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCB0cmVlTGFiZWxzKHBhZ2UpKS5pbmNsdWRlcygnU29mYScpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZnVybml0dXJlLmxvY2F0b3IoJy50ci1pY29uIHVzZScpLmdldEF0dHJpYnV0ZSgnaHJlZicpLCAnI3RyLWZvbGRlci1vcGVuJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZ1cm5pdHVyZS5sb2NhdG9yKCcudHItYXJyb3cgdXNlJykuZ2V0QXR0cmlidXRlKCdocmVmJyksICcjdHItY2FyZXQtZG93bicpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdUcmVlUm93OiBhIHBhcmVudCBvZiB0aGUgc2VsZWN0aW9uIHRha2VzIHRoZSBwYXJlbnQgdGludCwgY29sbGFwc2VkIG9yIG5vdCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdUcmVlUm93JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRhd2FpdCB0cmVlUm93KHBhZ2UsICdGdXJuaXR1cmUnKS5sb2NhdG9yKCcudHItYXJyb3cnKS5jbGljaygpO1xuXHRcdGF3YWl0IHRyZWVSb3cocGFnZSwgJ1NvZmEnKS5jbGljaygpO1xuXHRcdGF3YWl0IHBhcmtQb2ludGVyKHBhZ2UpO1xuXHRcdGNvbnN0IG1lc2hlcyA9IHRyZWVSb3cocGFnZSwgJ1N0YXRpY01lc2hlcycpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKG1lc2hlcyksIHJnYignc2VsZWN0LXBhcmVudCcpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0cmVlUm93KHBhZ2UsICdGdXJuaXR1cmUnKSksIHJnYignc2VsZWN0LXBhcmVudCcpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0cmVlUm93KHBhZ2UsICdMaWdodHMnKSksIHJnYigncmVjZXNzZWQnKSk7XG5cdFx0YXdhaXQgbWVzaGVzLmxvY2F0b3IoJy50ci1hcnJvdycpLmNsaWNrKCk7XG5cdFx0YXdhaXQgcGFya1BvaW50ZXIocGFnZSk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgdHJlZUxhYmVscyhwYWdlKSkuaW5jbHVkZXMoJ1NvZmEnKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YobWVzaGVzKSwgcmdiKCdzZWxlY3QtcGFyZW50JyksICdjb2xsYXBzZWQgcGFyZW50IGtlZXBzIHRoZSB0aW50Jyk7XG5cdFx0YXdhaXQgbWVzaGVzLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YobWVzaGVzKSwgcmdiKCdzZWxlY3QtaG92ZXInKSwgJ2EgaG92ZXJlZCBwYXJlbnQgdXNlcyB0aGUgaG92ZXIgZmlsbCcpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdUcmVlUm93OiBrZXlib2FyZCBtb3ZlcywgY29sbGFwc2VzLCBleHBhbmRzIGFuZCBqdW1wcycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdUcmVlUm93JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRhd2FpdCB0cmVlUm93KHBhZ2UsICdMaWdodHMnKS5jbGljaygpO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0Fycm93RG93bicpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdHJlZVNlbGVjdGVkKHBhZ2UpLCBbJ0xpZ2h0IFNvdXJjZSddKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdBcnJvd0xlZnQnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHRyZWVTZWxlY3RlZChwYWdlKSwgWydMaWdodHMnXSwgJ0xlZnQgb24gYSBsZWFmIHNlbGVjdHMgdGhlIHBhcmVudCcpO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0Fycm93TGVmdCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0cmVlUm93KHBhZ2UsICdMaWdodHMnKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSwgJ2ZhbHNlJyk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgdHJlZUxhYmVscyhwYWdlKSkuaW5jbHVkZXMoJ0xpZ2h0IFNvdXJjZScpKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHRyZWVTZWxlY3RlZChwYWdlKSwgWydTdGF0aWNNZXNoZXMnXSwgJ0Rvd24gc2tpcHMgdGhlIGhpZGRlbiBjaGlsZHJlbicpO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0Fycm93VXAnLCAnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0cmVlUm93KHBhZ2UsICdMaWdodHMnKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSwgJ3RydWUnKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdBcnJvd1JpZ2h0Jyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0cmVlU2VsZWN0ZWQocGFnZSksIFsnTGlnaHQgU291cmNlJ10sICdSaWdodCBvbiBhbiBvcGVuIHBhcmVudCBzZWxlY3RzIHRoZSBmaXJzdCBjaGlsZCcpO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0VuZCcpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdHJlZVNlbGVjdGVkKHBhZ2UpLCBbJ1N0YXJ0ZXJfQmFja2dyb3VuZCddKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdIb21lJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0cmVlU2VsZWN0ZWQocGFnZSksIFsnTGlnaHRzJ10pO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ1NoaWZ0K0Fycm93RG93bicsICdTaGlmdCtBcnJvd0Rvd24nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHRyZWVTZWxlY3RlZChwYWdlKSwgWydMaWdodHMnLCAnTGlnaHQgU291cmNlJywgJ1NreUxpZ2h0J10pO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0Fycm93RG93bicpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdHJlZVNlbGVjdGVkKHBhZ2UpLCBbJ1BvaW50TGlnaHQnXSk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnQ29udHJvbCtTcGFjZScpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdHJlZVNlbGVjdGVkKHBhZ2UpLCBbXSwgJ0N0cmwrU3BhY2UgdG9nZ2xlcyB0aGUgZm9jdXNlZCByb3cgb2ZmJyk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnU3BhY2UnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHRyZWVTZWxlY3RlZChwYWdlKSwgWydQb2ludExpZ2h0J10pO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0VudGVyJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0cmVlU2VsZWN0ZWQocGFnZSksIFsnUG9pbnRMaWdodCddKTtcblx0fSk7XG59KTtcblxudGVzdCgnVHJlZVJvdzogcm93cyBhbHRlcm5hdGUgZXZlbiBhbmQgb2RkIGJ5IHZpc2libGUgcG9zaXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnVHJlZVJvdycsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0YXdhaXQgdHJlZVJvdyhwYWdlLCAnTGlnaHRzJykubG9jYXRvcignLnRyLWFycm93JykuY2xpY2soKTtcblx0XHRjb25zdCBvZGQgPSBhd2FpdCBwYWdlLiQkZXZhbCgndWUtdHJlZS1yb3cgLnRyLXJvdzpub3QoW2hpZGRlbl0pJywgKGVscykgPT4gZWxzLm1hcCgoZWwpID0+IGVsLmNsYXNzTGlzdC5jb250YWlucygnaXMtb2RkJykpKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKG9kZCwgb2RkLm1hcCgoXywgaSkgPT4gaSAlIDIgPT09IDEpKTtcblx0XHRhd2FpdCBwYXJrUG9pbnRlcihwYWdlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihwYWdlLmxvY2F0b3IoJ3VlLXRyZWUtcm93IC50ci1yb3c6bm90KFtoaWRkZW5dKScpLm50aCgxKSksIHJnYignYmFja2dyb3VuZCcpKTtcblx0fSk7XG59KTtcblxudGVzdCgnVHJlZVJvdzogcGlubmVkIHNwZWNpbWVucyBzdGF5IHBpbm5lZCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdUcmVlUm93JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBmaXJzdCA9IHBhZ2UubG9jYXRvcignLnRyLXBhZ2UgPiAudHItcm93JykuZmlyc3QoKTtcblx0XHRjb25zdCBzcGVjaW1lbiA9IHBhZ2UubG9jYXRvcignLnRyLXBhZ2UgPiAudHItcm93LmlzLXNlbGVjdGVkOm5vdCguaXMtaW5hY3RpdmUpJyk7XG5cdFx0YXdhaXQgZmlyc3QuY2xpY2soKTtcblx0XHRhd2FpdCBmaXJzdC5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKGZpcnN0KSwgcmdiKCdyZWNlc3NlZCcpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihzcGVjaW1lbiksIHJnYignc2VsZWN0JykpO1xuXHRcdGF3YWl0IGNsaWNrQmxhbmsocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2Yoc3BlY2ltZW4pLCByZ2IoJ3NlbGVjdCcpLCAnYSBwaW5uZWQgYWN0aXZlIHJvdyBuZXZlciB0dXJucyBpbmFjdGl2ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHBhZ2UubG9jYXRvcignLnRyLXBhZ2UgPiAudHItcm93LmlzLXNlbGVjdGVkLmlzLWluYWN0aXZlJykpLCByZ2IoJ3NlbGVjdC1pbmFjdGl2ZScpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihwYWdlLmxvY2F0b3IoJy50ci1wYWdlID4gLnRyLXJvdy5pcy1wYXJlbnQnKSksIHJnYignc2VsZWN0LXBhcmVudCcpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKCd1ZS10cmVlLXJvdyAudHItcm93LmlzLXNlbGVjdGVkJykuY291bnQoKSwgMCwgJ25vdGhpbmcgaW4gdGhlIGxpdmUgdHJlZSBnb3Qgc2VsZWN0ZWQnKTtcblx0fSk7XG59KTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gSGVhZGVyUm93XG5cbmNvbnN0IGxhYmVsSGVhZCA9IChwYWdlOiBQYWdlKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoJ3VlLWhlYWRlci1yb3cgLmhyLWNlbGxbZGF0YS1jb2x1bW49XCJsYWJlbFwiXScpO1xuY29uc3QgdHlwZUhlYWQgPSAocGFnZTogUGFnZSk6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKCd1ZS1oZWFkZXItcm93IC5oci1jZWxsW2RhdGEtY29sdW1uPVwidHlwZVwiXScpO1xuY29uc3QgYXJyb3dIcmVmID0gKGNlbGw6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+ID0+IGNlbGwubG9jYXRvcignLmhyLXNvcnQgdXNlJykuZ2V0QXR0cmlidXRlKCdocmVmJyk7XG5jb25zdCBhcnJvd1Nob3duID0gKGNlbGw6IExvY2F0b3IpOiBQcm9taXNlPGJvb2xlYW4+ID0+IGNlbGwubG9jYXRvcignLmhyLXNvcnQnKS5ldmFsdWF0ZSgoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmRpc3BsYXkgIT09ICdub25lJyk7XG5cbnRlc3QoJ0hlYWRlclJvdzogY2xpY2tpbmcgYSBzb3J0YWJsZSBoZWFkZXIgY3ljbGVzIGFzY2VuZGluZyBhbmQgZGVzY2VuZGluZywgYW5kIHRoZSBhcnJvdyBmbGlwcycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdIZWFkZXJSb3cnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGhlYWQgPSBsYWJlbEhlYWQocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhlYWQuZ2V0QXR0cmlidXRlKCdhcmlhLXNvcnQnKSwgJ2FzY2VuZGluZycpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBhcnJvd0hyZWYoaGVhZCksICcjaHItdXAnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYXJyb3dTaG93bih0eXBlSGVhZChwYWdlKSksIGZhbHNlKTtcblx0XHRhd2FpdCBoZWFkLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhlYWQuZ2V0QXR0cmlidXRlKCdhcmlhLXNvcnQnKSwgJ2Rlc2NlbmRpbmcnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYXJyb3dIcmVmKGhlYWQpLCAnI2hyLWRvd24nKTtcblx0XHRhd2FpdCBoZWFkLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhlYWQuZ2V0QXR0cmlidXRlKCdhcmlhLXNvcnQnKSwgJ2FzY2VuZGluZycpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBhcnJvd0hyZWYoaGVhZCksICcjaHItdXAnKTtcblx0fSk7XG59KTtcblxudGVzdCgnSGVhZGVyUm93OiBzb3J0aW5nIGFub3RoZXIgY29sdW1uIG1vdmVzIHRoZSBwcmltYXJ5IGFycm93LCBzaGlmdCBhZGRzIGEgc2Vjb25kYXJ5IG9uZScsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdIZWFkZXJSb3cnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGhlYWQgPSBsYWJlbEhlYWQocGFnZSk7XG5cdFx0Y29uc3QgdHlwZSA9IHR5cGVIZWFkKHBhZ2UpO1xuXHRcdGF3YWl0IHR5cGUuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHlwZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc29ydCcpLCAnYXNjZW5kaW5nJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGFycm93U2hvd24odHlwZSksIHRydWUpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBoZWFkLmdldEF0dHJpYnV0ZSgnYXJpYS1zb3J0JyksICdub25lJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGFycm93U2hvd24oaGVhZCksIGZhbHNlKTtcblx0XHRhd2FpdCBoZWFkLmNsaWNrKHsgbW9kaWZpZXJzOiBbJ1NoaWZ0J10gfSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhlYWQuZ2V0QXR0cmlidXRlKCdhcmlhLXNvcnQnKSwgJ2FzY2VuZGluZycpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBhcnJvd0hyZWYoaGVhZCksICcjaHItdXAyJywgJ3NlY29uZGFyeSBhcnJvdycpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBhcnJvd0hyZWYodHlwZSksICcjaHItdXAnLCAncHJpbWFyeSBzdGF5cycpO1xuXHRcdGF3YWl0IGhlYWQuY2xpY2soeyBtb2RpZmllcnM6IFsnU2hpZnQnXSB9KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYXJyb3dIcmVmKGhlYWQpLCAnI2hyLWRvd24yJyk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ0hlYWRlclJvdzogRW50ZXIgYW5kIFNwYWNlIG9uIGEgZm9jdXNlZCBoZWFkZXIgc29ydCBpdCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdIZWFkZXJSb3cnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IHR5cGUgPSB0eXBlSGVhZChwYWdlKTtcblx0XHRhd2FpdCB0eXBlLmZvY3VzKCk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnRW50ZXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHlwZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc29ydCcpLCAnYXNjZW5kaW5nJyk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnU3BhY2UnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHlwZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc29ydCcpLCAnZGVzY2VuZGluZycpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBhcnJvd0hyZWYodHlwZSksICcjaHItZG93bicpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdIZWFkZXJSb3c6IGEgc29ydGFibGUgY2VsbCB0YWtlcyB0aGUgRHJvcGRvd24gZmlsbCBvbiBob3ZlciwgYSBmaXhlZCBjZWxsIGRvZXMgbm90JywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ0hlYWRlclJvdycsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgdHlwZSA9IHR5cGVIZWFkKHBhZ2UpO1xuXHRcdGF3YWl0IHBhcmtQb2ludGVyKHBhZ2UpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHR5cGUpLCByZ2IoJ2hlYWRlcicpKTtcblx0XHRhd2FpdCB0eXBlLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YodHlwZSksIHJnYignZHJvcGRvd24nKSk7XG5cdFx0Y29uc3QgZ3V0dGVyID0gcGFnZS5sb2NhdG9yKCd1ZS1oZWFkZXItcm93IC5oci1jZWxsLmlzLWd1dHRlcicpO1xuXHRcdGF3YWl0IGd1dHRlci5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKGd1dHRlciksIHJnYignaGVhZGVyJykpO1xuXHR9KTtcbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBkcmFnR3JpcChwYWdlOiBQYWdlLCBkeDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGZyb20gPSBjZW50cmUoYXdhaXQgcGFnZS5sb2NhdG9yKCd1ZS1oZWFkZXItcm93IC5oci1ncmlwJykuYm91bmRpbmdCb3goKSk7XG5cdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIGZyb20ueCwgZnJvbS55KTtcblx0YXdhaXQgaG9sZFBvaW50ZXIocGFnZSk7XG5cdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIGZyb20ueCArIGR4IC8gMiwgZnJvbS55LCA0KTtcblx0YXdhaXQgbW92ZVBvaW50ZXIocGFnZSwgZnJvbS54ICsgZHgsIGZyb20ueSwgNCk7XG5cdGF3YWl0IHJlbGVhc2VQb2ludGVyKHBhZ2UpO1xufVxuXG50ZXN0KCdIZWFkZXJSb3c6IGRyYWdnaW5nIHRoZSBzcGxpdHRlciByZXNpemVzIHRoZSB0d28gY29sdW1ucyBhbmQga2VlcHMgdGhlaXIgc3VtJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ0hlYWRlclJvdycsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgaGVhZCA9IGxhYmVsSGVhZChwYWdlKTtcblx0XHRjb25zdCB0eXBlID0gdHlwZUhlYWQocGFnZSk7XG5cdFx0Y29uc3QgYmVmb3JlID0gW2F3YWl0IHdpZHRoT2YoaGVhZCksIGF3YWl0IHdpZHRoT2YodHlwZSldO1xuXHRcdGF3YWl0IGRyYWdHcmlwKHBhZ2UsIC02MCk7XG5cdFx0Y29uc3QgYWZ0ZXIgPSBbYXdhaXQgd2lkdGhPZihoZWFkKSwgYXdhaXQgd2lkdGhPZih0eXBlKV07XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGFmdGVyWzBdIC0gKGJlZm9yZVswXSAtIDYwKSkgPCAxLjUsICdsYWJlbCBzaHJhbmsgYnkgNjA6ICcgKyBiZWZvcmVbMF0gKyAnIHRvICcgKyBhZnRlclswXSk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGFmdGVyWzFdIC0gKGJlZm9yZVsxXSArIDYwKSkgPCAxLjUsICd0eXBlIGdyZXcgYnkgNjAnKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoYWZ0ZXJbMF0gKyBhZnRlclsxXSAtIChiZWZvcmVbMF0gKyBiZWZvcmVbMV0pKSA8IDEpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBoZWFkLmdldEF0dHJpYnV0ZSgnYXJpYS1zb3J0JyksICdhc2NlbmRpbmcnLCAnYSBkcmFnIGRvZXMgbm90IHNvcnQnKTtcblx0fSk7XG59KTtcblxudGVzdCgnSGVhZGVyUm93OiBhIGNvbHVtbiBuZXZlciBnZXRzIG5hcnJvd2VyIHRoYW4gMjBweCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdIZWFkZXJSb3cnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGhlYWQgPSBsYWJlbEhlYWQocGFnZSk7XG5cdFx0Y29uc3QgdHlwZSA9IHR5cGVIZWFkKHBhZ2UpO1xuXHRcdGNvbnN0IHRvdGFsID0gKGF3YWl0IHdpZHRoT2YoaGVhZCkpICsgKGF3YWl0IHdpZHRoT2YodHlwZSkpO1xuXHRcdGF3YWl0IGRyYWdHcmlwKHBhZ2UsIC0zMDApO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicygoYXdhaXQgd2lkdGhPZihoZWFkKSkgLSAyMCkgPCAwLjUsICdsYWJlbCBzdG9wcyBhdCAyMCcpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicygoYXdhaXQgd2lkdGhPZih0eXBlKSkgLSAodG90YWwgLSAyMCkpIDwgMC41KTtcblx0XHRhd2FpdCBwYWdlLmxvY2F0b3IoJ3VlLWhlYWRlci1yb3cgLmhyLWdyaXAnKS5mb2N1cygpO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgLi4uQXJyYXk8c3RyaW5nPig2MCkuZmlsbCgnQXJyb3dSaWdodCcpKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoKGF3YWl0IHdpZHRoT2YodHlwZSkpIC0gMjApIDwgMC41LCAndHlwZSBzdG9wcyBhdCAyMCcpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdIZWFkZXJSb3c6IHRoZSBzcGxpdHRlciByZXNpemVzIGZyb20gdGhlIGtleWJvYXJkJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ0hlYWRlclJvdycsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgaGVhZCA9IGxhYmVsSGVhZChwYWdlKTtcblx0XHRjb25zdCBiZWZvcmUgPSBhd2FpdCB3aWR0aE9mKGhlYWQpO1xuXHRcdGF3YWl0IHBhZ2UubG9jYXRvcigndWUtaGVhZGVyLXJvdyAuaHItZ3JpcCcpLmZvY3VzKCk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicygoYXdhaXQgd2lkdGhPZihoZWFkKSkgLSAoYmVmb3JlICsgOCkpIDwgMSk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnQXJyb3dMZWZ0JywgJ0Fycm93TGVmdCcpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicygoYXdhaXQgd2lkdGhPZihoZWFkKSkgLSAoYmVmb3JlIC0gOCkpIDwgMSk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ0hlYWRlclJvdzogcGlubmVkIHNwZWNpbWVucyBrZWVwIHRoZWlyIGZvcmNlZCBzdGF0ZScsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdIZWFkZXJSb3cnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHBhZ2UubG9jYXRvcignLmhyLXBhZ2UgPiAuaHItcm93IC5oci1jZWxsLmlzLWhvdmVyJykpLCByZ2IoJ2Ryb3Bkb3duJykpO1xuXHRcdGNvbnN0IGNlbGwgPSBwYWdlLmxvY2F0b3IoJy5oci1wYWdlID4gLmhyLXJvdycpLm50aCgxKS5sb2NhdG9yKCcuaHItY2VsbC5pcy10ZXh0JykubnRoKDEpO1xuXHRcdGF3YWl0IGNlbGwuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihjZWxsKSwgcmdiKCdoZWFkZXInKSwgJ2EgcGlubmVkIGNlbGwgaGFzIG5vIHNvcnQgYW5kIG5vIGhvdmVyJyk7XG5cdFx0YXdhaXQgY2VsbC5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBjZWxsLmdldEF0dHJpYnV0ZSgnYXJpYS1zb3J0JyksIG51bGwpO1xuXHR9KTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gU2NlbmVPdXRsaW5lclxuXG5jb25zdCBNSU5fVEhVTUIgPSAzNTtcbmNvbnN0IFBBRCA9IDI7XG5jb25zdCBvdXRsaW5lclJvdyA9IChwYWdlOiBQYWdlLCBsYWJlbDogc3RyaW5nKTogTG9jYXRvciA9PiByb3dJbihwYWdlLCAndWUtc2NlbmUtb3V0bGluZXInLCAnLnNvLXJvdycsICcuc28tdGV4dCcsIGxhYmVsKTtcbmNvbnN0IG91dGxpbmVyTGFiZWxzID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZ1tdPiA9PiB2aXNpYmxlTGFiZWxzKHBhZ2UsICd1ZS1zY2VuZS1vdXRsaW5lcicsICcuc28tcm93JywgJy5zby10ZXh0Jyk7XG5jb25zdCBzdGF0dXMgPSAocGFnZTogUGFnZSk6IFByb21pc2U8c3RyaW5nPiA9PiBwYWdlLmxvY2F0b3IoJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1zdGF0dXMnKS5pbm5lclRleHQoKTtcbmNvbnN0IHNlbGVjdGVkTGFiZWxzID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZ1tdPiA9PiBwYWdlLiQkZXZhbCgndWUtc2NlbmUtb3V0bGluZXIgLnNvLXJvdy5pcy1zZWxlY3RlZCAuc28tdGV4dCcsIChlbHMpID0+IGVscy5tYXAoKGVsKSA9PiBlbC50ZXh0Q29udGVudCA/PyAnJykpO1xuXG50ZXN0KCdTY2VuZU91dGxpbmVyOiBzdGFydHMgd2l0aCBDaGFpciBzZWxlY3RlZCBhbmQgaW5hY3RpdmUsIHBhcmVudHMgdGludGVkLCBmb290ZXIgZnJvbSB0aGUgcmVhbCBjb3VudCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTY2VuZU91dGxpbmVyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNlbGVjdGVkTGFiZWxzKHBhZ2UpLCBbJ0NoYWlyJ10pO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBzdGF0dXMocGFnZSksICcxNSBhY3RvcnMgKDEgc2VsZWN0ZWQpJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2Yob3V0bGluZXJSb3cocGFnZSwgJ0NoYWlyJykpLCByZ2IoJ3NlbGVjdC1pbmFjdGl2ZScpKTtcblx0XHRhd2FpdCBwYXJrUG9pbnRlcihwYWdlKTtcblx0XHRmb3IgKGNvbnN0IHBhcmVudCBvZiBbJ0Z1cm5pdHVyZScsICdTdGF0aWNNZXNoZXMnLCAnTWluaW1hbF9EZWZhdWx0J10pIGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKG91dGxpbmVyUm93KHBhZ2UsIHBhcmVudCkpLCByZ2IoJ3NlbGVjdC1wYXJlbnQnKSwgcGFyZW50KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihvdXRsaW5lclJvdyhwYWdlLCAnTGlnaHRzJykpLCByZ2IoJ3JlY2Vzc2VkJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKG91dGxpbmVyUm93KHBhZ2UsICdBdWRpbycpKSwgcmdiKCdiYWNrZ3JvdW5kJykpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY2VuZU91dGxpbmVyOiBjbGljayBzZWxlY3RzIGFjdGl2ZSwgZm9jdXMgbG9zcyB0dXJucyBpdCBpbmFjdGl2ZSwgZm9sZGVycyBkbyBub3QgY291bnQgYXMgYWN0b3JzJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1NjZW5lT3V0bGluZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IHdpbmQgPSBvdXRsaW5lclJvdyhwYWdlLCAnQW1iaWVudF9XaW5kJyk7XG5cdFx0YXdhaXQgd2luZC5jbGljaygpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2VsZWN0ZWRMYWJlbHMocGFnZSksIFsnQW1iaWVudF9XaW5kJ10pO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHdpbmQpLCByZ2IoJ3NlbGVjdCcpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhdHVzKHBhZ2UpLCAnMTUgYWN0b3JzICgxIHNlbGVjdGVkKScpO1xuXHRcdGF3YWl0IGNsaWNrQmxhbmsocGFnZSk7XG5cdFx0YXdhaXQgc2V0dGxlKHBhZ2UpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHdpbmQpLCByZ2IoJ3NlbGVjdC1pbmFjdGl2ZScpKTtcblx0XHRhd2FpdCBvdXRsaW5lclJvdyhwYWdlLCAnQXVkaW8nKS5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBzdGF0dXMocGFnZSksICcxNSBhY3RvcnMnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihvdXRsaW5lclJvdyhwYWdlLCAnQXVkaW8nKSksIHJnYignc2VsZWN0JykpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY2VuZU91dGxpbmVyOiBjdHJsIHRvZ2dsZXMsIHNoaWZ0IHNlbGVjdHMgYSByYW5nZSwgdGhlIGZvb3RlciBmb2xsb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1NjZW5lT3V0bGluZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGF3YWl0IG91dGxpbmVyUm93KHBhZ2UsICdBbWJpZW50X1dpbmQnKS5jbGljaygpO1xuXHRcdGF3YWl0IG91dGxpbmVyUm93KHBhZ2UsICdQbGF5ZXIgU3RhcnQnKS5jbGljayh7IG1vZGlmaWVyczogWydDb250cm9sJ10gfSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBzZWxlY3RlZExhYmVscyhwYWdlKSwgWydBbWJpZW50X1dpbmQnLCAnUGxheWVyIFN0YXJ0J10pO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBzdGF0dXMocGFnZSksICcxNSBhY3RvcnMgKDIgc2VsZWN0ZWQpJyk7XG5cdFx0YXdhaXQgb3V0bGluZXJSb3cocGFnZSwgJ0xpZ2h0IFNvdXJjZScpLmNsaWNrKCk7XG5cdFx0YXdhaXQgb3V0bGluZXJSb3cocGFnZSwgJ1NreUxpZ2h0JykuY2xpY2soeyBtb2RpZmllcnM6IFsnU2hpZnQnXSB9KTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNlbGVjdGVkTGFiZWxzKHBhZ2UpLCBbJ0xpZ2h0IFNvdXJjZScsICdQb2ludExpZ2h0JywgJ1NreUxpZ2h0J10pO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBzdGF0dXMocGFnZSksICcxNSBhY3RvcnMgKDMgc2VsZWN0ZWQpJyk7XG5cdFx0YXdhaXQgb3V0bGluZXJSb3cocGFnZSwgJ1BvaW50TGlnaHQnKS5jbGljayh7IG1vZGlmaWVyczogWydDb250cm9sJ10gfSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN0YXR1cyhwYWdlKSwgJzE1IGFjdG9ycyAoMiBzZWxlY3RlZCknKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2NlbmVPdXRsaW5lcjogdGhlIGNhcmV0IGNvbGxhcHNlcyBhIGZvbGRlciBhbmQgaW5kZW50cyAxMnB4IHBlciBsZXZlbCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTY2VuZU91dGxpbmVyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBpbmRlbnQgPSAobGFiZWw6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyPiA9PiB3aWR0aE9mKG91dGxpbmVyUm93KHBhZ2UsIGxhYmVsKS5sb2NhdG9yKCcuc28taW5kZW50JykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBpbmRlbnQoJ01pbmltYWxfRGVmYXVsdCcpLCA2KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5kZW50KCdMaWdodHMnKSwgMTgpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBpbmRlbnQoJ0xpZ2h0IFNvdXJjZScpLCAzMCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGluZGVudCgnQ2hhaXInKSwgNDIpO1xuXHRcdGNvbnN0IGJlZm9yZSA9IChhd2FpdCBvdXRsaW5lckxhYmVscyhwYWdlKSkubGVuZ3RoO1xuXHRcdGF3YWl0IG91dGxpbmVyUm93KHBhZ2UsICdMaWdodHMnKS5sb2NhdG9yKCcuc28tYXJyb3cnKS5jbGljaygpO1xuXHRcdGNvbnN0IGFmdGVyID0gYXdhaXQgb3V0bGluZXJMYWJlbHMocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGFmdGVyLmxlbmd0aCwgYmVmb3JlIC0gNCk7XG5cdFx0YXNzZXJ0Lm9rKCFhZnRlci5pbmNsdWRlcygnTGlnaHQgU291cmNlJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBvdXRsaW5lclJvdyhwYWdlLCAnTGlnaHRzJykuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICdmYWxzZScpO1xuXHRcdGF3YWl0IG91dGxpbmVyUm93KHBhZ2UsICdMaWdodHMnKS5sb2NhdG9yKCcuc28tYXJyb3cnKS5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbCgoYXdhaXQgb3V0bGluZXJMYWJlbHMocGFnZSkpLmxlbmd0aCwgYmVmb3JlKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2NlbmVPdXRsaW5lcjogYSBjb2xsYXBzZWQgZm9sZGVyIHRoYXQgaG9sZHMgdGhlIHNlbGVjdGlvbiBrZWVwcyB0aGUgcGFyZW50IHRpbnQnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2NlbmVPdXRsaW5lcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgbWVzaGVzID0gb3V0bGluZXJSb3cocGFnZSwgJ1N0YXRpY01lc2hlcycpO1xuXHRcdGF3YWl0IG1lc2hlcy5sb2NhdG9yKCcuc28tYXJyb3cnKS5jbGljaygpO1xuXHRcdGF3YWl0IHBhcmtQb2ludGVyKHBhZ2UpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IG91dGxpbmVyTGFiZWxzKHBhZ2UpKS5pbmNsdWRlcygnQ2hhaXInKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YobWVzaGVzKSwgcmdiKCdzZWxlY3QtcGFyZW50JykpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2VsZWN0ZWRMYWJlbHMocGFnZSksIFsnQ2hhaXInXSwgJ3RoZSBoaWRkZW4gc2VsZWN0aW9uIHN1cnZpdmVzJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN0YXR1cyhwYWdlKSwgJzE1IGFjdG9ycyAoMSBzZWxlY3RlZCknKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2NlbmVPdXRsaW5lcjoga2V5Ym9hcmQgbmF2aWdhdGlvbicsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTY2VuZU91dGxpbmVyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRhd2FpdCBvdXRsaW5lclJvdyhwYWdlLCAnQXVkaW8nKS5jbGljaygpO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0Fycm93RG93bicpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2VsZWN0ZWRMYWJlbHMocGFnZSksIFsnQW1iaWVudF9XaW5kJ10pO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0Fycm93TGVmdCcpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2VsZWN0ZWRMYWJlbHMocGFnZSksIFsnQXVkaW8nXSk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnQXJyb3dMZWZ0Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IG91dGxpbmVyUm93KHBhZ2UsICdBdWRpbycpLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBvdXRsaW5lckxhYmVscyhwYWdlKSkuaW5jbHVkZXMoJ0FtYmllbnRfV2luZCcpKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdBcnJvd1JpZ2h0JywgJ0Fycm93UmlnaHQnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNlbGVjdGVkTGFiZWxzKHBhZ2UpLCBbJ0FtYmllbnRfV2luZCddKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdFbmQnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNlbGVjdGVkTGFiZWxzKHBhZ2UpLCBbJ0xhbXBfRmxvb3InXSk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnSG9tZScpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2VsZWN0ZWRMYWJlbHMocGFnZSksIFsnTWluaW1hbF9EZWZhdWx0J10pO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0Fycm93RG93bicsICdTaGlmdCtBcnJvd0Rvd24nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNlbGVjdGVkTGFiZWxzKHBhZ2UpLCBbJ0F1ZGlvJywgJ0FtYmllbnRfV2luZCddKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhdHVzKHBhZ2UpLCAnMTUgYWN0b3JzICgxIHNlbGVjdGVkKScpO1xuXHRcdGF3YWl0IGtleXMocGFnZSwgJ0VudGVyJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBzZWxlY3RlZExhYmVscyhwYWdlKSwgWydBbWJpZW50X1dpbmQnXSk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1NjZW5lT3V0bGluZXI6IHRoZSBleWUgc2hvd3Mgb24gYSBob3ZlcmVkIHJvdyBhbmQgdG9nZ2xlcyBvcGVuIGFuZCBjbG9zZWQnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2NlbmVPdXRsaW5lcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgZXllT2YgPSAobGFiZWw6IHN0cmluZyk6IExvY2F0b3IgPT4gb3V0bGluZXJSb3cocGFnZSwgbGFiZWwpLmxvY2F0b3IoJy5zby1leWUnKTtcblx0XHRjb25zdCB2aXNpYmlsaXR5ID0gKGxhYmVsOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4gZXllT2YobGFiZWwpLmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkudmlzaWJpbGl0eSk7XG5cdFx0YXdhaXQgcGFya1BvaW50ZXIocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHkoJ1BsYXllciBTdGFydCcpLCAnaGlkZGVuJyk7XG5cdFx0YXdhaXQgb3V0bGluZXJSb3cocGFnZSwgJ1BsYXllciBTdGFydCcpLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHkoJ1BsYXllciBTdGFydCcpLCAndmlzaWJsZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB2aXNpYmlsaXR5KCdMaWdodCBTb3VyY2UnKSwgJ2hpZGRlbicpO1xuXHRcdGF3YWl0IGV5ZU9mKCdQbGF5ZXIgU3RhcnQnKS5jbGljaygpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2VsZWN0ZWRMYWJlbHMocGFnZSksIFsnQ2hhaXInXSwgJ3RoZSBleWUgZG9lcyBub3Qgc2VsZWN0Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGV5ZU9mKCdQbGF5ZXIgU3RhcnQnKS5sb2NhdG9yKCd1c2UnKS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyNzby1leWUtb2ZmJyk7XG5cdFx0YXdhaXQgcGFya1BvaW50ZXIocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHkoJ1BsYXllciBTdGFydCcpLCAndmlzaWJsZScsICdhIGhpZGRlbiBpdGVtIGtlZXBzIGl0cyBjbG9zZWQgZXllJyk7XG5cdFx0YXdhaXQgZXllT2YoJ1BsYXllciBTdGFydCcpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGV5ZU9mKCdQbGF5ZXIgU3RhcnQnKS5sb2NhdG9yKCd1c2UnKS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyNzby1leWUnKTtcblx0XHRhd2FpdCBvdXRsaW5lclJvdyhwYWdlLCAnTGlnaHRzJykubG9jYXRvcignLnNvLWd1dHRlcicpLmNsaWNrKCk7XG5cdFx0YXdhaXQgcGFya1BvaW50ZXIocGFnZSk7XG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBbJ0xpZ2h0IFNvdXJjZScsICdQb2ludExpZ2h0JywgJ1NreUxpZ2h0JywgJ1Nwb3RMaWdodCddKSBhc3NlcnQuZXF1YWwoYXdhaXQgdmlzaWJpbGl0eShjaGlsZCksICd2aXNpYmxlJywgY2hpbGQgKyAnIGhpZGRlbiB3aXRoIGl0cyBmb2xkZXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdmlzaWJpbGl0eSgnQ2hhaXInKSwgJ3Zpc2libGUnLCAnYSBzZWxlY3RlZCByb3cgc2hvd3MgaXRzIGV5ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB2aXNpYmlsaXR5KCdQbGF5ZXIgU3RhcnQnKSwgJ2hpZGRlbicpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY2VuZU91dGxpbmVyOiB0aGUgc2VhcmNoIGJveCBmaWx0ZXJzLCBrZWVwcyBhbmNlc3RvcnMsIG9wZW5zIHRoZW0gYW5kIHJlc3RvcmVzIG9uIGNsZWFyJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1NjZW5lT3V0bGluZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gcGFnZS5sb2NhdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28taW5wdXQnKTtcblx0XHRjb25zdCB3aXBlID0gcGFnZS5sb2NhdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28tY2xlYXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc2hvd24od2lwZSksIGZhbHNlKTtcblx0XHRhd2FpdCBvdXRsaW5lclJvdyhwYWdlLCAnTGlnaHRzJykubG9jYXRvcignLnNvLWFycm93JykuY2xpY2soKTtcblx0XHRhd2FpdCBpbnB1dC5maWxsKCdza3lsaWdodCcpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgb3V0bGluZXJMYWJlbHMocGFnZSksIFsnTWluaW1hbF9EZWZhdWx0JywgJ0xpZ2h0cycsICdTa3lMaWdodCddKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgb3V0bGluZXJSb3cocGFnZSwgJ0xpZ2h0cycpLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAndHJ1ZScsICd0aGUgYW5jZXN0b3Igb3BlbnMnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhdHVzKHBhZ2UpLCAnU2hvd2luZyAxIG9mIDE1IGFjdG9ycyAoMSBzZWxlY3RlZCknKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgY29sb3JPZihwYWdlLmxvY2F0b3IoJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1zdGF0dXMnKSksIHJnYignYWNjZW50LWdyZWVuJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBzaG93bih3aXBlKSwgdHJ1ZSk7XG5cdFx0YXdhaXQgd2lwZS5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBpbnB1dC5pbnB1dFZhbHVlKCksICcnKTtcblx0XHRhc3NlcnQuZXF1YWwoKGF3YWl0IG91dGxpbmVyTGFiZWxzKHBhZ2UpKS5sZW5ndGgsIDE5LCAnTGlnaHRzIGlzIGNvbGxhcHNlZCBhZ2FpbjogMjMgcm93cyBtaW51cyA0Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IG91dGxpbmVyUm93KHBhZ2UsICdMaWdodHMnKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSwgJ2ZhbHNlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN0YXR1cyhwYWdlKSwgJzE1IGFjdG9ycyAoMSBzZWxlY3RlZCknKTtcblx0XHRhd2FpdCBpbnB1dC5maWxsKCdTS1knKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IG91dGxpbmVyTGFiZWxzKHBhZ2UpLCBbJ01pbmltYWxfRGVmYXVsdCcsICdMaWdodHMnLCAnU2t5TGlnaHQnLCAnU2t5IGFuZCBGb2cnLCAnQlBfU2t5X1NwaGVyZSddKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhdHVzKHBhZ2UpLCAnU2hvd2luZyAyIG9mIDE1IGFjdG9ycyAoMSBzZWxlY3RlZCknKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2NlbmVPdXRsaW5lcjogYSBmaWx0ZXIgd2l0aCBubyBtYXRjaCByZWFkcyByZWQsIEVzY2FwZSBjbGVhcnMgaXQnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2NlbmVPdXRsaW5lcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSBwYWdlLmxvY2F0b3IoJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1pbnB1dCcpO1xuXHRcdGNvbnN0IGxpbmUgPSBwYWdlLmxvY2F0b3IoJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1zdGF0dXMnKTtcblx0XHRhd2FpdCBpbnB1dC5maWxsKCd6enonKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IG91dGxpbmVyTGFiZWxzKHBhZ2UpLCBbXSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN0YXR1cyhwYWdlKSwgJ05vIG1hdGNoaW5nIGFjdG9ycyAoMTUgdG90YWwpJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGNvbG9yT2YobGluZSksIHJnYignYWNjZW50LXJlZCcpKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdFc2NhcGUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5wdXQuaW5wdXRWYWx1ZSgpLCAnJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKChhd2FpdCBvdXRsaW5lckxhYmVscyhwYWdlKSkubGVuZ3RoLCAyMyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGNvbG9yT2YobGluZSksIHJnYignZm9yZWdyb3VuZCcpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28tc2VhcmNoJykuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5ib3JkZXJUb3BDb2xvciksIHJnYigncHJpbWFyeScpLCAnZm9jdXNlZCBvdXRsaW5lIGlzIFByaW1hcnknKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2NlbmVPdXRsaW5lcjogc29ydGluZyBieSBJdGVtIExhYmVsIG9yIFR5cGUgcmVvcmRlcnMgcm93cyB3aXRoaW4gZWFjaCBwYXJlbnQnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2NlbmVPdXRsaW5lcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgaGVhZCA9IHBhZ2UubG9jYXRvcigndWUtc2NlbmUtb3V0bGluZXIgLnNvLWhjZWxsW2RhdGEtY29sdW1uPVwibGFiZWxcIl0nKTtcblx0XHRjb25zdCB0eXBlID0gcGFnZS5sb2NhdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28taGNlbGxbZGF0YS1jb2x1bW49XCJ0eXBlXCJdJyk7XG5cdFx0Y29uc3QgaW5pdGlhbCA9IGF3YWl0IG91dGxpbmVyTGFiZWxzKHBhZ2UpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoaW5pdGlhbC5zbGljZSgwLCA0KSwgWydNaW5pbWFsX0RlZmF1bHQnLCAnQXVkaW8nLCAnQW1iaWVudF9XaW5kJywgJ1N0YXJ0ZXJfQmFja2dyb3VuZCddKTtcblx0XHRhd2FpdCBoZWFkLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhlYWQuZ2V0QXR0cmlidXRlKCdhcmlhLXNvcnQnKSwgJ2Rlc2NlbmRpbmcnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaGVhZC5sb2NhdG9yKCd1c2UnKS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyNzby1kb3duJyk7XG5cdFx0Y29uc3QgZGVzYyA9IGF3YWl0IG91dGxpbmVyTGFiZWxzKHBhZ2UpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZGVzYy5zbGljZSgwLCA5KSwgWydNaW5pbWFsX0RlZmF1bHQnLCAnU3RhdGljTWVzaGVzJywgJ0xhbXBfRmxvb3InLCAnQm9va3NoZWxmJywgJ0Z1cm5pdHVyZScsICdUYWJsZScsICdTb2ZhJywgJ0NoYWlyJywgJ1NreSBhbmQgRm9nJ10pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoWy4uLmRlc2NdLnNvcnQoKSwgWy4uLmluaXRpYWxdLnNvcnQoKSwgJ3NhbWUgcm93cycpO1xuXHRcdGF3YWl0IGhlYWQuY2xpY2soKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IG91dGxpbmVyTGFiZWxzKHBhZ2UpLCBpbml0aWFsLCAnYXNjZW5kaW5nIHJlc3RvcmVzIHRoZSBmaXJzdCBvcmRlcicpO1xuXHRcdGF3YWl0IHR5cGUuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHlwZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc29ydCcpLCAnYXNjZW5kaW5nJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhlYWQuZ2V0QXR0cmlidXRlKCdhcmlhLXNvcnQnKSwgJ25vbmUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaGVhZC5sb2NhdG9yKCcuc28tc29ydCcpLmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuZGlzcGxheSksICdub25lJyk7XG5cdFx0Y29uc3QgYnlUeXBlID0gYXdhaXQgb3V0bGluZXJMYWJlbHMocGFnZSk7XG5cdFx0Y29uc3QgbGlnaHRzQXQgPSBieVR5cGUuaW5kZXhPZignTGlnaHRzJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChieVR5cGUuc2xpY2UobGlnaHRzQXQgKyAxLCBsaWdodHNBdCArIDUpLCBbJ0xpZ2h0IFNvdXJjZScsICdQb2ludExpZ2h0JywgJ1NreUxpZ2h0JywgJ1Nwb3RMaWdodCddLCAnRGlyZWN0aW9uYWxMaWdodCwgUG9pbnRMaWdodCwgU2t5TGlnaHQsIFNwb3RMaWdodCcpO1xuXHRcdGF3YWl0IHR5cGUuY2xpY2soKTtcblx0XHRjb25zdCBieVR5cGVEZXNjID0gYXdhaXQgb3V0bGluZXJMYWJlbHMocGFnZSk7XG5cdFx0Y29uc3QgbGlnaHRzRGVzYyA9IGJ5VHlwZURlc2MuaW5kZXhPZignTGlnaHRzJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChieVR5cGVEZXNjLnNsaWNlKGxpZ2h0c0Rlc2MgKyAxLCBsaWdodHNEZXNjICsgNSksIFsnU3BvdExpZ2h0JywgJ1NreUxpZ2h0JywgJ1BvaW50TGlnaHQnLCAnTGlnaHQgU291cmNlJ10pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2VsZWN0ZWRMYWJlbHMocGFnZSksIFsnQ2hhaXInXSwgJ3NvcnRpbmcga2VlcHMgdGhlIHNlbGVjdGlvbicpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY2VuZU91dGxpbmVyOiBzdHJpcGVzIGZvbGxvdyB0aGUgdmlzaWJsZSBvcmRlciBhZnRlciBhIHNvcnQnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2NlbmVPdXRsaW5lcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0YXdhaXQgcGFnZS5sb2NhdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28taGNlbGxbZGF0YS1jb2x1bW49XCJ0eXBlXCJdJykuY2xpY2soKTtcblx0XHRjb25zdCBvZGQgPSBhd2FpdCBwYWdlLiQkZXZhbCgndWUtc2NlbmUtb3V0bGluZXIgLnNvLXJvdzpub3QoW2hpZGRlbl0pJywgKGVscykgPT4gZWxzLm1hcCgoZWwpID0+IGVsLmNsYXNzTGlzdC5jb250YWlucygnaXMtb2RkJykpKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKG9kZCwgb2RkLm1hcCgoXywgaSkgPT4gaSAlIDIgPT09IDEpKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2NlbmVPdXRsaW5lcjogdGhlIGhlYWRlciBjZWxsIHRha2VzIHRoZSBEcm9wZG93biBmaWxsIG9uIGhvdmVyJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1NjZW5lT3V0bGluZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IHR5cGUgPSBwYWdlLmxvY2F0b3IoJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1oY2VsbFtkYXRhLWNvbHVtbj1cInR5cGVcIl0nKTtcblx0XHRhd2FpdCBwYXJrUG9pbnRlcihwYWdlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0eXBlKSwgcmdiKCdoZWFkZXInKSk7XG5cdFx0YXdhaXQgdHlwZS5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHR5cGUpLCByZ2IoJ2Ryb3Bkb3duJykpO1xuXHR9KTtcbn0pO1xuXG5pbnRlcmZhY2UgR2VvbWV0cnkge1xuXHRzY3JvbGxUb3A6IG51bWJlcjtcblx0c2Nyb2xsSGVpZ2h0OiBudW1iZXI7XG5cdGNsaWVudEhlaWdodDogbnVtYmVyO1xuXHR0b3A6IG51bWJlcjtcblx0aGVpZ2h0OiBudW1iZXI7XG59XG5cbmNvbnN0IGdlb21ldHJ5ID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPEdlb21ldHJ5PiA9PlxuXHRwYWdlLmV2YWx1YXRlKCgpID0+IHtcblx0XHRjb25zdCB2aWV3ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1yb3dzJyk7XG5cdFx0Y29uc3QgdGh1bWIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PigndWUtc2NlbmUtb3V0bGluZXIgLnNvLXRodW1iJyk7XG5cdFx0Y29uc3QgYmFyID0gdGh1bWI/LnBhcmVudEVsZW1lbnQ7XG5cdFx0aWYgKCF2aWV3IHx8ICF0aHVtYiB8fCAhYmFyKSB0aHJvdyBuZXcgRXJyb3IoJ291dGxpbmVyIHBhcnRzJyk7XG5cdFx0Y29uc3QgdCA9IHRodW1iLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IGIgPSBiYXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0cmV0dXJuIHsgc2Nyb2xsVG9wOiB2aWV3LnNjcm9sbFRvcCwgc2Nyb2xsSGVpZ2h0OiB2aWV3LnNjcm9sbEhlaWdodCwgY2xpZW50SGVpZ2h0OiB2aWV3LmNsaWVudEhlaWdodCwgdG9wOiB0LnRvcCAtIGIudG9wLCBoZWlnaHQ6IHQuaGVpZ2h0IH07XG5cdH0pO1xuXG5mdW5jdGlvbiBleHBlY3RlZFRodW1iKGc6IEdlb21ldHJ5KTogeyB0b3A6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XG5cdGNvbnN0IGJpYXNlZCA9IGcuY2xpZW50SGVpZ2h0IC0gMiAqIFBBRCAtIE1JTl9USFVNQjtcblx0cmV0dXJuIHsgdG9wOiBQQUQgKyBiaWFzZWQgKiAoZy5zY3JvbGxUb3AgLyBnLnNjcm9sbEhlaWdodCksIGhlaWdodDogTUlOX1RIVU1CICsgYmlhc2VkICogKGcuY2xpZW50SGVpZ2h0IC8gZy5zY3JvbGxIZWlnaHQpIH07XG59XG5cbnRlc3QoJ1NjZW5lT3V0bGluZXI6IHRoZSBzY3JvbGxiYXIgdGh1bWIgZm9sbG93cyB0aGUgcm93cywgd2hlZWwsIGRyYWcgYW5kIHRyYWNrIGNsaWNrIHNjcm9sbCB0aGVtJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1NjZW5lT3V0bGluZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGxldCBnID0gYXdhaXQgZ2VvbWV0cnkocGFnZSk7XG5cdFx0YXNzZXJ0Lm9rKGcuc2Nyb2xsSGVpZ2h0ID4gZy5jbGllbnRIZWlnaHQsICdyZWFsIG92ZXJmbG93Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGcuc2Nyb2xsVG9wLCAwKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoZy50b3AgLSBQQUQpIDwgMC41KTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoZy5oZWlnaHQgLSBleHBlY3RlZFRodW1iKGcpLmhlaWdodCkgPCAwLjUsICd0aHVtYiBsZW5ndGggMzUgKyAodHJhY2sgLSAzNSkgeCBmcmFjdGlvbicpO1xuXG5cdFx0YXdhaXQgbW92ZVBvaW50ZXIocGFnZSwgMTAwLCAyMDApO1xuXHRcdGF3YWl0IHNwaW4ocGFnZSwgMCwgNjApO1xuXHRcdGF3YWl0IHBhZ2Uud2FpdEZvckZ1bmN0aW9uKCgpID0+IChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28tcm93cycpPy5zY3JvbGxUb3AgPz8gMCkgPiAwKTtcblx0XHRhd2FpdCBzZXR0bGUocGFnZSk7XG5cdFx0ZyA9IGF3YWl0IGdlb21ldHJ5KHBhZ2UpO1xuXHRcdGFzc2VydC5vayhnLnNjcm9sbFRvcCA+IDAsICd3aGVlbCBzY3JvbGxzJyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGcudG9wIC0gZXhwZWN0ZWRUaHVtYihnKS50b3ApIDwgMC41LCAndGh1bWIgZm9sbG93cycpO1xuXG5cdFx0Y29uc3QgYmFyID0gcGFnZS5sb2NhdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28tc2InKTtcblx0XHRjb25zdCB0aHVtYiA9IHBhZ2UubG9jYXRvcigndWUtc2NlbmUtb3V0bGluZXIgLnNvLXRodW1iJyk7XG5cdFx0Y29uc3QgYmFyQm94ID0gYXdhaXQgYmFyLmJvdW5kaW5nQm94KCk7XG5cdFx0YXNzZXJ0Lm9rKGJhckJveCk7XG5cdFx0Y29uc3QgZ3JhYiA9IGNlbnRyZShhd2FpdCB0aHVtYi5ib3VuZGluZ0JveCgpKTtcblx0XHRjb25zdCBzdGFydCA9IGcuc2Nyb2xsVG9wO1xuXHRcdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIGdyYWIueCwgZ3JhYi55KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0aHVtYiksIHJnYignaG92ZXItMicpLCAnaG92ZXJlZCB0aHVtYicpO1xuXHRcdGF3YWl0IGhvbGRQb2ludGVyKHBhZ2UpO1xuXHRcdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIGdyYWIueCwgZ3JhYi55ICsgMTAsIDMpO1xuXHRcdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIGdyYWIueCwgZ3JhYi55ICsgMzAsIDMpO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3NlcyhiYXIpKS5pbmNsdWRlcygnaXMtZHJhZycpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0aHVtYiksIHJnYignaG92ZXItMicpLCAnZHJhZ2dlZCB0aHVtYicpO1xuXHRcdGF3YWl0IHJlbGVhc2VQb2ludGVyKHBhZ2UpO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRnID0gYXdhaXQgZ2VvbWV0cnkocGFnZSk7XG5cdFx0Y29uc3QgYmlhc2VkID0gZy5jbGllbnRIZWlnaHQgLSAyICogUEFEIC0gTUlOX1RIVU1CO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhnLnNjcm9sbFRvcCAtIE1hdGgubWluKGcuc2Nyb2xsSGVpZ2h0IC0gZy5jbGllbnRIZWlnaHQsIHN0YXJ0ICsgKDMwICogZy5zY3JvbGxIZWlnaHQpIC8gYmlhc2VkKSkgPCA0LCAnZHJhZyBzY3JvbGxzOiAnICsgc3RhcnQgKyAnIHRvICcgKyBnLnNjcm9sbFRvcCk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgY2xhc3NlcyhiYXIpKS5pbmNsdWRlcygnaXMtZHJhZycpKTtcblxuXHRcdGF3YWl0IHBhZ2UubW91c2UuY2xpY2soYmFyQm94LnggKyBiYXJCb3gud2lkdGggLyAyLCBiYXJCb3gueSArIDgpO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRnID0gYXdhaXQgZ2VvbWV0cnkocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGcuc2Nyb2xsVG9wLCAwLCAnY2xpY2tpbmcgdGhlIHRvcCBvZiB0aGUgdHJhY2sgc2Nyb2xscyB0byB0aGUgdG9wJyk7XG5cdFx0YXdhaXQgcGFnZS5tb3VzZS5jbGljayhiYXJCb3gueCArIGJhckJveC53aWR0aCAvIDIsIGJhckJveC55ICsgYmFyQm94LmhlaWdodCAtIDMpO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRnID0gYXdhaXQgZ2VvbWV0cnkocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGcuc2Nyb2xsVG9wLCBnLnNjcm9sbEhlaWdodCAtIGcuY2xpZW50SGVpZ2h0LCAnY2xpY2tpbmcgdGhlIGJvdHRvbSBzY3JvbGxzIHRvIHRoZSBlbmQnKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoZy50b3AgKyBnLmhlaWdodCAtIChnLmNsaWVudEhlaWdodCAtIFBBRCkpIDwgMC41LCAndGh1bWIgZW5kcyBhdCB0aGUgdHJhY2sgZW5kJyk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1NjZW5lT3V0bGluZXI6IHRoZSBiYXIgYW5kIHRoZSBoZWFkZXIgc3BhY2VyIGdvIGF3YXkgd2hpbGUgdGhlIHJvd3MgZml0JywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1NjZW5lT3V0bGluZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGJhciA9IHBhZ2UubG9jYXRvcigndWUtc2NlbmUtb3V0bGluZXIgLnNvLXNiJyk7XG5cdFx0Y29uc3Qgc3BhY2VyID0gcGFnZS5sb2NhdG9yKCd1ZS1zY2VuZS1vdXRsaW5lciAuc28taHNwYWNlcicpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBzaG93bihiYXIpLCB0cnVlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc2hvd24oc3BhY2VyKSwgdHJ1ZSk7XG5cdFx0Y29uc3Qgd2l0aEJhciA9IGF3YWl0IHdpZHRoT2Yob3V0bGluZXJSb3cocGFnZSwgJ0F1ZGlvJykpO1xuXHRcdGF3YWl0IHBhZ2UubG9jYXRvcigndWUtc2NlbmUtb3V0bGluZXIgLnNvLWlucHV0JykuZmlsbCgnY2hhaXInKTtcblx0XHRhd2FpdCBzZXR0bGUocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNob3duKGJhciksIGZhbHNlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc2hvd24oc3BhY2VyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3NlcyhwYWdlLmxvY2F0b3IoJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1oY2VsbHMnKSkpLmluY2x1ZGVzKCdpcy1uby1iYXInKSk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCB3aWR0aE9mKG91dGxpbmVyUm93KHBhZ2UsICdDaGFpcicpKSkgPj0gd2l0aEJhciArIDE1LjUsICdyb3dzIHRha2UgdGhlIGZyZWVkIDE2cHgnKTtcblx0XHRhd2FpdCBwYWdlLmxvY2F0b3IoJ3VlLXNjZW5lLW91dGxpbmVyIC5zby1pbnB1dCcpLmZpbGwoJycpO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc2hvd24oYmFyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNob3duKHNwYWNlciksIHRydWUpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY2VuZU91dGxpbmVyOiB0aGUgcGlubmVkIHNwZWNpbWVuIHN0YXlzIHBpbm5lZCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTY2VuZU91dGxpbmVyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBzcGVjaW1lbiA9IHBhZ2UubG9jYXRvcignLnNvLWNvbCcpLm50aCgxKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihzcGVjaW1lbi5sb2NhdG9yKCcuc28tcm93LmlzLXNlbGVjdGVkLmlzLWluYWN0aXZlJykpLCByZ2IoJ3NlbGVjdC1pbmFjdGl2ZScpKTtcblx0XHRjb25zdCByb3cgPSBzcGVjaW1lbi5sb2NhdG9yKCcuc28tcm93JykubnRoKDIpO1xuXHRcdGF3YWl0IHBhcmtQb2ludGVyKHBhZ2UpO1xuXHRcdGNvbnN0IGJlZm9yZSA9IGF3YWl0IGJnT2Yocm93KTtcblx0XHRhd2FpdCByb3cuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihyb3cpLCBiZWZvcmUsICdhIHBpbm5lZCByb3cgaGFzIG5vIGhvdmVyJyk7XG5cdFx0YXdhaXQgcm93LmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNwZWNpbWVuLmxvY2F0b3IoJy5zby1yb3cuaXMtc2VsZWN0ZWQnKS5jb3VudCgpLCAxKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3BlY2ltZW4ubG9jYXRvcignLnNvLWV5ZScpLmNvdW50KCksIDIpO1xuXHR9KTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gU2Nyb2xsYmFyXG5cbmludGVyZmFjZSBCYXJTdGF0ZSB7XG5cdHNjcm9sbDogbnVtYmVyO1xuXHRjb250ZW50OiBudW1iZXI7XG5cdHZpZXc6IG51bWJlcjtcblx0c3RhcnQ6IG51bWJlcjtcblx0c2l6ZTogbnVtYmVyO1xuXHRzbG90OiBudW1iZXI7XG59XG5cbi8vIFJlYWRzIHRoZSBudGggbGl2ZSBib3g6IHNjcm9sbCBvZmZzZXQsIHNpemVzIGFuZCB0aHVtYiBwbGFjZW1lbnQgYWxvbmcgdGhlIHNjcm9sbCBheGlzLlxuZnVuY3Rpb24gYmFyU3RhdGUocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlciwgdmVydGljYWw6IGJvb2xlYW4pOiBQcm9taXNlPEJhclN0YXRlPiB7XG5cdHJldHVybiBwYWdlLmV2YWx1YXRlKChbaSwgdl0pID0+IHtcblx0XHRjb25zdCBob3N0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oJ3VlLXNjcm9sbGJhciAuc2Itc2Nyb2xsJylbaV07XG5cdFx0Y29uc3QgdmlldyA9IGhvc3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5zYi12aWV3Jyk7XG5cdFx0Y29uc3QgYmFyID0gaG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLnNiJyk7XG5cdFx0Y29uc3QgdGh1bWIgPSBob3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuc2ItdGh1bWInKTtcblx0XHRpZiAoIXZpZXcgfHwgIWJhciB8fCAhdGh1bWIpIHRocm93IG5ldyBFcnJvcignYm94IHBhcnRzJyk7XG5cdFx0Y29uc3QgYiA9IGJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb25zdCB0ID0gdGh1bWIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0cmV0dXJuIHZcblx0XHRcdD8geyBzY3JvbGw6IHZpZXcuc2Nyb2xsVG9wLCBjb250ZW50OiB2aWV3LnNjcm9sbEhlaWdodCwgdmlldzogdmlldy5jbGllbnRIZWlnaHQsIHN0YXJ0OiB0LnRvcCAtIGIudG9wLCBzaXplOiB0LmhlaWdodCwgc2xvdDogYi5oZWlnaHQgfVxuXHRcdFx0OiB7IHNjcm9sbDogdmlldy5zY3JvbGxMZWZ0LCBjb250ZW50OiB2aWV3LnNjcm9sbFdpZHRoLCB2aWV3OiB2aWV3LmNsaWVudFdpZHRoLCBzdGFydDogdC5sZWZ0IC0gYi5sZWZ0LCBzaXplOiB0LndpZHRoLCBzbG90OiBiLndpZHRoIH07XG5cdH0sIFtpbmRleCwgdmVydGljYWxdIGFzIFtudW1iZXIsIGJvb2xlYW5dKTtcbn1cblxuZnVuY3Rpb24gZXhwZWN0ZWRCYXIoczogQmFyU3RhdGUpOiB7IHN0YXJ0OiBudW1iZXI7IHNpemU6IG51bWJlciB9IHtcblx0Y29uc3QgYmlhc2VkID0gcy5zbG90IC0gMiAqIFBBRCAtIE1JTl9USFVNQjtcblx0cmV0dXJuIHsgc3RhcnQ6IFBBRCArIGJpYXNlZCAqIChzLnNjcm9sbCAvIHMuY29udGVudCksIHNpemU6IE1JTl9USFVNQiArIGJpYXNlZCAqIChzLnZpZXcgLyBzLmNvbnRlbnQpIH07XG59XG5cbmNvbnN0IGxpdmUgPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKCd1ZS1zY3JvbGxiYXIgLnNiLXNjcm9sbCcpLm50aChpbmRleCk7XG5cbmFzeW5jIGZ1bmN0aW9uIGRyYWdCeShwYWdlOiBQYWdlLCB0aHVtYjogTG9jYXRvciwgZHg6IG51bWJlciwgZHk6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBmcm9tID0gY2VudHJlKGF3YWl0IHRodW1iLmJvdW5kaW5nQm94KCkpO1xuXHRhd2FpdCBtb3ZlUG9pbnRlcihwYWdlLCBmcm9tLngsIGZyb20ueSk7XG5cdGF3YWl0IGhvbGRQb2ludGVyKHBhZ2UpO1xuXHRhd2FpdCBtb3ZlUG9pbnRlcihwYWdlLCBmcm9tLnggKyBkeCAvIDIsIGZyb20ueSArIGR5IC8gMiwgMyk7XG5cdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIGZyb20ueCArIGR4LCBmcm9tLnkgKyBkeSwgMyk7XG5cdGF3YWl0IHJlbGVhc2VQb2ludGVyKHBhZ2UpO1xuXHRhd2FpdCBzZXR0bGUocGFnZSk7XG59XG5cbnRlc3QoJ1Njcm9sbGJhcjogdGhlIHZlcnRpY2FsIHRodW1iIGxlbmd0aCBhbmQgcG9zaXRpb24gZm9sbG93IHRoZSBjb250ZW50JywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1Njcm9sbGJhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0bGV0IHMgPSBhd2FpdCBiYXJTdGF0ZShwYWdlLCAwLCB0cnVlKTtcblx0XHRhc3NlcnQub2socy5jb250ZW50ID4gcy52aWV3KTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zaXplIC0gZXhwZWN0ZWRCYXIocykuc2l6ZSkgPCAwLjUsICdsZW5ndGg6ICcgKyBzLnNpemUpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhzLnN0YXJ0IC0gUEFEKSA8IDAuNSk7XG5cdFx0YXdhaXQgbGl2ZShwYWdlLCAwKS5sb2NhdG9yKCcuc2ItdmlldycpLmV2YWx1YXRlKChlbCkgPT4geyBlbC5zY3JvbGxUb3AgPSAxMjA7IH0pO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRzID0gYXdhaXQgYmFyU3RhdGUocGFnZSwgMCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKHMuc2Nyb2xsLCAxMjApO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhzLnN0YXJ0IC0gZXhwZWN0ZWRCYXIocykuc3RhcnQpIDwgMC41LCAncG9zaXRpb24gJyArIHMuc3RhcnQpO1xuXHRcdGF3YWl0IGxpdmUocGFnZSwgMCkubG9jYXRvcignLnNiLXZpZXcnKS5ldmFsdWF0ZSgoZWwpID0+IHsgZWwuc2Nyb2xsVG9wID0gZWwuc2Nyb2xsSGVpZ2h0OyB9KTtcblx0XHRhd2FpdCBzZXR0bGUocGFnZSk7XG5cdFx0cyA9IGF3YWl0IGJhclN0YXRlKHBhZ2UsIDAsIHRydWUpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhzLnN0YXJ0ICsgcy5zaXplIC0gKHMuc2xvdCAtIFBBRCkpIDwgMC41LCAndGh1bWIgZW5kcyAycHggZnJvbSB0aGUgc2xvdCBlbmQnKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2Nyb2xsYmFyOiBkcmFnZ2luZyB0aGUgdGh1bWIgc2Nyb2xscyB0aGUgdmlldycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTY3JvbGxiYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGZpcnN0ID0gbGl2ZShwYWdlLCAwKTtcblx0XHRhd2FpdCBkcmFnQnkocGFnZSwgZmlyc3QubG9jYXRvcignLnNiLXRodW1iJyksIDAsIDMwKTtcblx0XHRjb25zdCBzID0gYXdhaXQgYmFyU3RhdGUocGFnZSwgMCwgdHJ1ZSk7XG5cdFx0Y29uc3QgYmlhc2VkID0gcy5zbG90IC0gMiAqIFBBRCAtIE1JTl9USFVNQjtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zY3JvbGwgLSAoMzAgKiBzLmNvbnRlbnQpIC8gYmlhc2VkKSA8IDQsICdzY3JvbGxlZCAnICsgcy5zY3JvbGwpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IGNsYXNzZXMoZmlyc3QubG9jYXRvcignLnNiJykpKS5pbmNsdWRlcygnaXMtZHJhZycpKTtcblx0XHRhd2FpdCBkcmFnQnkocGFnZSwgZmlyc3QubG9jYXRvcignLnNiLXRodW1iJyksIDAsIC01MDApO1xuXHRcdGFzc2VydC5lcXVhbCgoYXdhaXQgYmFyU3RhdGUocGFnZSwgMCwgdHJ1ZSkpLnNjcm9sbCwgMCwgJ2RyYWdnaW5nIHBhc3QgdGhlIHRvcCBzdG9wcyBhdCB0aGUgdG9wJyk7XG5cdFx0YXdhaXQgZHJhZ0J5KHBhZ2UsIGZpcnN0LmxvY2F0b3IoJy5zYi10aHVtYicpLCAwLCA1MDApO1xuXHRcdGNvbnN0IGVuZCA9IGF3YWl0IGJhclN0YXRlKHBhZ2UsIDAsIHRydWUpO1xuXHRcdGFzc2VydC5lcXVhbChlbmQuc2Nyb2xsLCBlbmQuY29udGVudCAtIGVuZC52aWV3KTtcblx0fSk7XG59KTtcblxudGVzdCgnU2Nyb2xsYmFyOiB0aGUgdGh1bWIgaXMgSG92ZXIgYXQgcmVzdCwgSG92ZXIyIG9uIGJhciBob3ZlciBhbmQgd2hpbGUgZHJhZ2dlZCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTY3JvbGxiYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGZpcnN0ID0gbGl2ZShwYWdlLCAwKTtcblx0XHRjb25zdCB0aHVtYiA9IGZpcnN0LmxvY2F0b3IoJy5zYi10aHVtYicpO1xuXHRcdGF3YWl0IHBhcmtQb2ludGVyKHBhZ2UpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHRodW1iKSwgcmdiKCdob3ZlcicpKTtcblx0XHRhd2FpdCBmaXJzdC5sb2NhdG9yKCcuc2InKS5ob3Zlcih7IHBvc2l0aW9uOiB7IHg6IDgsIHk6IDE0MCB9IH0pO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHRodW1iKSwgcmdiKCdob3Zlci0yJyksICd0aGUgd2hvbGUgYmFyIGlzIHRoZSBob3ZlciB0YXJnZXQnKTtcblx0XHRhd2FpdCBwYXJrUG9pbnRlcihwYWdlKTtcblx0XHRjb25zdCBncmFiID0gY2VudHJlKGF3YWl0IHRodW1iLmJvdW5kaW5nQm94KCkpO1xuXHRcdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIGdyYWIueCwgZ3JhYi55KTtcblx0XHRhd2FpdCBob2xkUG9pbnRlcihwYWdlKTtcblx0XHRhd2FpdCBtb3ZlUG9pbnRlcihwYWdlLCBncmFiLnggKyAyMDAsIGdyYWIueSArIDQwLCA0KTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXMoZmlyc3QubG9jYXRvcignLnNiJykpKS5pbmNsdWRlcygnaXMtZHJhZycpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0aHVtYiksIHJnYignaG92ZXItMicpLCAnZHJhZ2dlZCwgcG9pbnRlciBvdXRzaWRlIHRoZSBiYXInKTtcblx0XHRhd2FpdCByZWxlYXNlUG9pbnRlcihwYWdlKTtcblx0XHRhd2FpdCBwYXJrUG9pbnRlcihwYWdlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0aHVtYiksIHJnYignaG92ZXInKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRodW1iLmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkud2lkdGgpLCAnOHB4Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRodW1iLmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuYm9yZGVyVG9wTGVmdFJhZGl1cyksICc0cHgnKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2Nyb2xsYmFyOiB0aGUgd2hlZWwgc2Nyb2xscyBvdmVyIHRoZSB2aWV3IGFuZCBvdmVyIHRoZSBiYXInLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2Nyb2xsYmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBvdmVyID0gY2VudHJlKGF3YWl0IGxpdmUocGFnZSwgMCkubG9jYXRvcignLnNiLXZpZXcnKS5ib3VuZGluZ0JveCgpKTtcblx0XHRjb25zdCBvbkJhciA9IGNlbnRyZShhd2FpdCBsaXZlKHBhZ2UsIDApLmxvY2F0b3IoJy5zYicpLmJvdW5kaW5nQm94KCkpO1xuXHRcdGF3YWl0IG1vdmVQb2ludGVyKHBhZ2UsIG92ZXIueCwgb3Zlci55KTtcblx0XHRhd2FpdCBzcGluKHBhZ2UsIDAsIDUwKTtcblx0XHRhd2FpdCBwYWdlLndhaXRGb3JGdW5jdGlvbigoKSA9PiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndWUtc2Nyb2xsYmFyIC5zYi12aWV3Jyk/LnNjcm9sbFRvcCA/PyAwKSA+IDApO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRsZXQgcyA9IGF3YWl0IGJhclN0YXRlKHBhZ2UsIDAsIHRydWUpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhzLnN0YXJ0IC0gZXhwZWN0ZWRCYXIocykuc3RhcnQpIDwgMC41KTtcblx0XHRjb25zdCBhZnRlclZpZXcgPSBzLnNjcm9sbDtcblx0XHRhd2FpdCBtb3ZlUG9pbnRlcihwYWdlLCBvbkJhci54LCBvbkJhci55KTtcblx0XHRhd2FpdCBzcGluKHBhZ2UsIDAsIDUwKTtcblx0XHRhd2FpdCBwYWdlLndhaXRGb3JGdW5jdGlvbigoYmVmb3JlKSA9PiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndWUtc2Nyb2xsYmFyIC5zYi12aWV3Jyk/LnNjcm9sbFRvcCA/PyAwKSA+IGJlZm9yZSwgYWZ0ZXJWaWV3KTtcblx0XHRzID0gYXdhaXQgYmFyU3RhdGUocGFnZSwgMCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKHMuc2Nyb2xsID4gYWZ0ZXJWaWV3LCAndGhlIGJhciBmb3J3YXJkcyB0aGUgd2hlZWwnKTtcblx0fSk7XG59KTtcblxudGVzdCgnU2Nyb2xsYmFyOiBjbGlja2luZyB0aGUgdHJhY2sgY2VudHJlcyB0aGUgdGh1bWIgb24gdGhlIHBvaW50ZXInLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2Nyb2xsYmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBiYXIgPSBhd2FpdCBsaXZlKHBhZ2UsIDApLmxvY2F0b3IoJy5zYicpLmJvdW5kaW5nQm94KCk7XG5cdFx0YXNzZXJ0Lm9rKGJhcik7XG5cdFx0YXdhaXQgcGFnZS5tb3VzZS5jbGljayhiYXIueCArIDgsIGJhci55ICsgMTAwKTtcblx0XHRhd2FpdCBzZXR0bGUocGFnZSk7XG5cdFx0Y29uc3QgcyA9IGF3YWl0IGJhclN0YXRlKHBhZ2UsIDAsIHRydWUpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhzLnN0YXJ0ICsgcy5zaXplIC8gMiAtIDEwMCkgPCA2LCAndGh1bWIgY2VudHJlICcgKyAocy5zdGFydCArIHMuc2l6ZSAvIDIpKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zdGFydCAtIGV4cGVjdGVkQmFyKHMpLnN0YXJ0KSA8IDAuNSk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1Njcm9sbGJhcjogYSB2ZXJ5IGxvbmcgY29udGVudCBrZWVwcyB0aGUgMzVweCBtaW5pbXVtIHRodW1iJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1Njcm9sbGJhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3QgcyA9IGF3YWl0IGJhclN0YXRlKHBhZ2UsIDEsIHRydWUpO1xuXHRcdGFzc2VydC5vayhzLnNpemUgPj0gTUlOX1RIVU1CICYmIHMuc2l6ZSA8IE1JTl9USFVNQiArIDIsICd0aHVtYiAnICsgcy5zaXplKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zaXplIC0gZXhwZWN0ZWRCYXIocykuc2l6ZSkgPCAwLjUpO1xuXHRcdGF3YWl0IGRyYWdCeShwYWdlLCBsaXZlKHBhZ2UsIDEpLmxvY2F0b3IoJy5zYi10aHVtYicpLCAwLCA2MCk7XG5cdFx0Y29uc3QgbW92ZWQgPSBhd2FpdCBiYXJTdGF0ZShwYWdlLCAxLCB0cnVlKTtcblx0XHRhc3NlcnQub2sobW92ZWQuc2Nyb2xsID4gMTAwMCwgJ2Egc21hbGwgZHJhZyBzY3JvbGxzIGZhcjogJyArIG1vdmVkLnNjcm9sbCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1Njcm9sbGJhcjogdGhlIDEycHggU2Nyb2xsQm94IHNsb3QgcGxhY2VzIHRoZSB0aHVtYiAycHggZnJvbSB0aGUgZWRnZScsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTY3JvbGxiYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGJveGVkID0gbGl2ZShwYWdlLCAyKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgd2lkdGhPZihib3hlZC5sb2NhdG9yKCcuc2InKSksIDEyKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYm94ZWQubG9jYXRvcignLnNiLXRodW1iJykuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5sZWZ0KSwgJzJweCcpO1xuXHRcdGNvbnN0IHMgPSBhd2FpdCBiYXJTdGF0ZShwYWdlLCAyLCB0cnVlKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zaXplIC0gZXhwZWN0ZWRCYXIocykuc2l6ZSkgPCAwLjUpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB3aWR0aE9mKGxpdmUocGFnZSwgMCkubG9jYXRvcignLnNiJykpLCAxNik7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGxpdmUocGFnZSwgMCkubG9jYXRvcignLnNiLXRodW1iJykuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5sZWZ0KSwgJzRweCcpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY3JvbGxiYXI6IHRoZSBob3Jpem9udGFsIGJhciBmb2xsb3dzIHNjcm9sbExlZnQsIGRyYWdzIGFuZCB0YWtlcyB0aGUgd2hlZWwnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnU2Nyb2xsYmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBzaWRld2F5cyA9IGxpdmUocGFnZSwgMyk7XG5cdFx0bGV0IHMgPSBhd2FpdCBiYXJTdGF0ZShwYWdlLCAzLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKHMuY29udGVudCA+IHMudmlldyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKHMuc2l6ZSAtIGV4cGVjdGVkQmFyKHMpLnNpemUpIDwgMC41KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc2lkZXdheXMubG9jYXRvcignLnNiLXRodW1iJykuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS50b3ApLCAnNHB4Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNpZGV3YXlzLmxvY2F0b3IoJy5zYi10aHVtYicpLmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuaGVpZ2h0KSwgJzhweCcpO1xuXHRcdGF3YWl0IHNpZGV3YXlzLmxvY2F0b3IoJy5zYi12aWV3JykuZXZhbHVhdGUoKGVsKSA9PiB7IGVsLnNjcm9sbExlZnQgPSAxMDA7IH0pO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRzID0gYXdhaXQgYmFyU3RhdGUocGFnZSwgMywgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhzLnN0YXJ0IC0gZXhwZWN0ZWRCYXIocykuc3RhcnQpIDwgMC41KTtcblx0XHRhd2FpdCBkcmFnQnkocGFnZSwgc2lkZXdheXMubG9jYXRvcignLnNiLXRodW1iJyksIC01MDAsIDApO1xuXHRcdGFzc2VydC5lcXVhbCgoYXdhaXQgYmFyU3RhdGUocGFnZSwgMywgZmFsc2UpKS5zY3JvbGwsIDApO1xuXHRcdGF3YWl0IGRyYWdCeShwYWdlLCBzaWRld2F5cy5sb2NhdG9yKCcuc2ItdGh1bWInKSwgMjAsIDApO1xuXHRcdGNvbnN0IGRyYWdnZWQgPSBhd2FpdCBiYXJTdGF0ZShwYWdlLCAzLCBmYWxzZSk7XG5cdFx0Y29uc3QgYmlhc2VkID0gZHJhZ2dlZC5zbG90IC0gMiAqIFBBRCAtIE1JTl9USFVNQjtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoZHJhZ2dlZC5zY3JvbGwgLSAoMjAgKiBkcmFnZ2VkLmNvbnRlbnQpIC8gYmlhc2VkKSA8IDQsICdzY3JvbGxlZCAnICsgZHJhZ2dlZC5zY3JvbGwpO1xuXHRcdGNvbnN0IG92ZXIgPSBjZW50cmUoYXdhaXQgc2lkZXdheXMubG9jYXRvcignLnNiLXZpZXcnKS5ib3VuZGluZ0JveCgpKTtcblx0XHRhd2FpdCBtb3ZlUG9pbnRlcihwYWdlLCBvdmVyLngsIG92ZXIueSk7XG5cdFx0YXdhaXQgc3BpbihwYWdlLCA2MCwgMCk7XG5cdFx0YXdhaXQgcGFnZS53YWl0Rm9yRnVuY3Rpb24oKGJlZm9yZSkgPT4gKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3VlLXNjcm9sbGJhciAuc2ItdmlldycpWzNdPy5zY3JvbGxMZWZ0ID8/IDApID4gYmVmb3JlLCBkcmFnZ2VkLnNjcm9sbCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBiYXJTdGF0ZShwYWdlLCAzLCBmYWxzZSkpLnNjcm9sbCA+IGRyYWdnZWQuc2Nyb2xsLCAnc2lkZXdheXMgd2hlZWwgc2Nyb2xscycpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY3JvbGxiYXI6IGEgZm9jdXNlZCB2aWV3IHNjcm9sbHMgZnJvbSB0aGUga2V5Ym9hcmQgYW5kIHRoZSB0aHVtYiBmb2xsb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1Njcm9sbGJhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0YXdhaXQgbGl2ZShwYWdlLCAwKS5sb2NhdG9yKCcuc2ItdmlldycpLmZvY3VzKCk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnUGFnZURvd24nKTtcblx0XHRhd2FpdCBzZXR0bGUocGFnZSk7XG5cdFx0bGV0IHMgPSBhd2FpdCBiYXJTdGF0ZShwYWdlLCAwLCB0cnVlKTtcblx0XHRhc3NlcnQub2socy5zY3JvbGwgPiAwKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zdGFydCAtIGV4cGVjdGVkQmFyKHMpLnN0YXJ0KSA8IDAuNSk7XG5cdFx0YXdhaXQga2V5cyhwYWdlLCAnRW5kJyk7XG5cdFx0YXdhaXQgcGFnZS53YWl0Rm9yRnVuY3Rpb24oKCkgPT4ge1xuXHRcdFx0Y29uc3QgdmlldyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3VlLXNjcm9sbGJhciAuc2ItdmlldycpO1xuXHRcdFx0cmV0dXJuIHZpZXcgIT09IG51bGwgJiYgdmlldy5zY3JvbGxUb3AgPj0gdmlldy5zY3JvbGxIZWlnaHQgLSB2aWV3LmNsaWVudEhlaWdodCAtIDE7XG5cdFx0fSk7XG5cdFx0YXdhaXQgc2V0dGxlKHBhZ2UpO1xuXHRcdHMgPSBhd2FpdCBiYXJTdGF0ZShwYWdlLCAwLCB0cnVlKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zY3JvbGwgLSAocy5jb250ZW50IC0gcy52aWV3KSkgPCAxKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMocy5zdGFydCArIHMuc2l6ZSAtIChzLnNsb3QgLSBQQUQpKSA8IDAuNSwgJ3RodW1iIGF0IHRoZSBlbmQnKTtcblx0XHRhd2FpdCBrZXlzKHBhZ2UsICdIb21lJyk7XG5cdFx0YXdhaXQgcGFnZS53YWl0Rm9yRnVuY3Rpb24oKCkgPT4gKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3VlLXNjcm9sbGJhciAuc2ItdmlldycpPy5zY3JvbGxUb3AgPz8gMSkgPT09IDApO1xuXHRcdGF3YWl0IHNldHRsZShwYWdlKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoKGF3YWl0IGJhclN0YXRlKHBhZ2UsIDAsIHRydWUpKS5zdGFydCAtIFBBRCkgPCAwLjUpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTY3JvbGxiYXI6IHBpbm5lZCBzcGVjaW1lbnMgZG8gbm90IHJlYWN0IHRvIHRoZSBwb2ludGVyJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ1Njcm9sbGJhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3Qgc3BlY2ltZW4gPSBwYWdlLmxvY2F0b3IoJy5zYi1wYWdlID4gLnNiLWdyb3VwJykubnRoKDEpLmxvY2F0b3IoJy5zYicpLmZpcnN0KCk7XG5cdFx0Y29uc3QgdGh1bWIgPSBzcGVjaW1lbi5sb2NhdG9yKCcuc2ItdGh1bWInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0aHVtYiksIHJnYignaG92ZXInKSk7XG5cdFx0YXdhaXQgc3BlY2ltZW4uaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZih0aHVtYiksIHJnYignaG92ZXInKSwgJ2EgcGlubmVkIG5vcm1hbCBzcGVjaW1lbiBzdGF5cyBub3JtYWwgdW5kZXIgdGhlIHBvaW50ZXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihwYWdlLmxvY2F0b3IoJy5zYi5pcy1ob3ZlciAuc2ItdGh1bWInKS5maXJzdCgpKSwgcmdiKCdob3Zlci0yJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHBhZ2UubG9jYXRvcignLnNiLmlzLWRyYWcgLnNiLXRodW1iJykuZmlyc3QoKSksIHJnYignaG92ZXItMicpKTtcblx0fSk7XG59KTtcbiIsICIvLy8gPHJlZmVyZW5jZSBsaWI9XCJkb21cIiAvPlxuLy8gSGVscGVycyBmb3IgdGhlIGludGVyYWN0aW9uIHRlc3RzIG9mIHRyZWUtbGlrZSBhbmQgc2Nyb2xsaW5nIHByZXZpZXdzLlxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydC9zdHJpY3QnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgb3BlblByZXZpZXcsIHdpdGhCcm93c2VyLCByb290IH0gZnJvbSAnLi9saWIudHMnO1xuXG5pbnRlcmZhY2UgVG9rZW5GaWxlIHtcblx0Y29sb3I6IHsgdGhlbWVzOiBBcnJheTx7IGlkOiBzdHJpbmcgfT47IHRva2VuczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0+IH07XG59XG5cbi8vIFRoZSBjb21wdXRlZCBjb2xvdXIgYSB0b2tlbiBwYWludHMsIHdyaXR0ZW4gdGhlIHdheSB0aGUgYnJvd3NlciByZXBvcnRzIGl0LlxuZXhwb3J0IGZ1bmN0aW9uIHJnYih0b2tlbjogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3QgZmlsZSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyb290LCAndG9rZW5zLmpzb24nKSwgJ3V0ZjgnKSkgYXMgVG9rZW5GaWxlO1xuXHRjb25zdCB0aGVtZSA9IGZpbGUuY29sb3IudGhlbWVzWzBdLmlkO1xuXHRsZXQgbmFtZSA9IHRva2VuO1xuXHRmb3IgKGxldCBob3BzID0gMDsgaG9wcyA8IDg7IGhvcHMrKykge1xuXHRcdGNvbnN0IGVudHJ5ID0gZmlsZS5jb2xvci50b2tlbnMuZmluZCgodCkgPT4gdC5uYW1lID09PSBuYW1lKTtcblx0XHRhc3NlcnQub2soZW50cnksICd0b2tlbiAnICsgbmFtZSk7XG5cdFx0Y29uc3QgcmF3ID0gdHlwZW9mIGVudHJ5LnZhbHVlID09PSAnc3RyaW5nJyA/IGVudHJ5LnZhbHVlIDogZW50cnkudmFsdWVbdGhlbWVdO1xuXHRcdGNvbnN0IGFsaWFzID0gL15cXHsoLispXFx9JC8uZXhlYyhyYXcpO1xuXHRcdGlmIChhbGlhcykge1xuXHRcdFx0bmFtZSA9IGFsaWFzWzFdO1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXHRcdGNvbnN0IGhleCA9IC9eIyhbMC05YS1mXXs2fSkkL2kuZXhlYyhyYXcpO1xuXHRcdGFzc2VydC5vayhoZXgsICdzaXggZGlnaXQgaGV4IGZvciAnICsgbmFtZSk7XG5cdFx0Y29uc3QgbiA9IHBhcnNlSW50KGhleFsxXSwgMTYpO1xuXHRcdHJldHVybiAncmdiKCcgKyAobiA+PiAxNikgKyAnLCAnICsgKChuID4+IDgpICYgMjU1KSArICcsICcgKyAobiAmIDI1NSkgKyAnKSc7XG5cdH1cblx0dGhyb3cgbmV3IEVycm9yKCdhbGlhcyBsb29wIGZvciAnICsgdG9rZW4pO1xufVxuXG4vLyBPcGVucyBhIHByZXZpZXcsIHJ1bnMgdGhlIGJvZHksIHRoZW4gcmVxdWlyZXMgYSBjbGVhbiBjb25zb2xlLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGluUHJldmlldyhuYW1lOiBzdHJpbmcsIGJvZHk6IChwYWdlOiBQYWdlKSA9PiBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsIG5hbWUpO1xuXHRcdGF3YWl0IGJvZHkocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGVycm9ycy5sZW5ndGgsIDAsICdwYWdlIGVycm9yczogJyArIGVycm9ycy5qb2luKCcgfCAnKSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGNvbnN0IGJnT2YgPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmJhY2tncm91bmRDb2xvcik7XG5leHBvcnQgY29uc3QgY29sb3JPZiA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuY29sb3IpO1xuZXhwb3J0IGNvbnN0IGNsYXNzZXMgPSBhc3luYyAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4gKChhd2FpdCB0YXJnZXQuZ2V0QXR0cmlidXRlKCdjbGFzcycpKSA/PyAnJykuc3BsaXQoL1xccysvKTtcbmV4cG9ydCBjb25zdCB3aWR0aE9mID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8bnVtYmVyPiA9PiB0YXJnZXQuZXZhbHVhdGUoKGVsKSA9PiBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aCk7XG5leHBvcnQgY29uc3Qgc2V0dGxlID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2Uud2FpdEZvclRpbWVvdXQoODApO1xuLy8gTW92ZXMgdGhlIHBvaW50ZXIgdG8gdGhlIGVtcHR5IHBhZ2UgbWFyZ2luLCB3aGljaCB0YWtlcyB0aGUgaG92ZXIgb2ZmIGFueSByb3cuXG5leHBvcnQgY29uc3QgcGFya1BvaW50ZXIgPSAocGFnZTogUGFnZSk6IFByb21pc2U8dm9pZD4gPT4gcGFnZS5tb3VzZS5tb3ZlKDIsIDIpO1xuXG5leHBvcnQgY29uc3Qgc2hvd24gPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxib29sZWFuPiA9PiB0YXJnZXQuaXNWaXNpYmxlKCk7XG5leHBvcnQgaW50ZXJmYWNlIEJveCB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9XG4vLyBUaGUgbWlkZGxlIHBvaW50IG9mIGEgYm91bmRpbmcgYm94LlxuZXhwb3J0IGNvbnN0IGNlbnRyZSA9IChiOiBCb3ggfCBudWxsKTogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9ID0+IHtcblx0YXNzZXJ0Lm9rKGIsICdib3VuZGluZyBib3gnKTtcblx0cmV0dXJuIHsgeDogYi54ICsgYi53aWR0aCAvIDIsIHk6IGIueSArIGIuaGVpZ2h0IC8gMiB9O1xufTtcbmV4cG9ydCBjb25zdCBjbGlja0JsYW5rID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuY2xpY2soMiwgMik7XG5leHBvcnQgY29uc3Qga2V5cyA9IChwYWdlOiBQYWdlLCAuLi5rZXlzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4gPT4ga2V5cy5yZWR1Y2UoKGNoYWluLCBrZXkpID0+IGNoYWluLnRoZW4oKCkgPT4gcGFnZS5rZXlib2FyZC5wcmVzcyhrZXkpKSwgUHJvbWlzZS5yZXNvbHZlKCkpO1xuZXhwb3J0IGNvbnN0IG1vdmVQb2ludGVyID0gKHBhZ2U6IFBhZ2UsIHg6IG51bWJlciwgeTogbnVtYmVyLCBzdGVwcyA9IDEpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UubW92ZSh4LCB5LCB7IHN0ZXBzIH0pO1xuZXhwb3J0IGNvbnN0IGhvbGRQb2ludGVyID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuZG93bigpO1xuZXhwb3J0IGNvbnN0IHJlbGVhc2VQb2ludGVyID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UudXAoKTtcbmV4cG9ydCBjb25zdCBzcGluID0gKHBhZ2U6IFBhZ2UsIGR4OiBudW1iZXIsIGR5OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2Uud2hlZWwoZHgsIGR5KTtcblxuZnVuY3Rpb24gZXNjYXBlUmVnRXhwKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB0ZXh0LnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyk7XG59XG5cbi8vIFRoZSByb3cgaW5zaWRlIGBzY29wZWAgd2hvc2UgbGFiZWwgdGV4dCBpcyBleGFjdGx5IGBsYWJlbGAuXG5leHBvcnQgZnVuY3Rpb24gcm93SW4ocGFnZTogUGFnZSwgc2NvcGU6IHN0cmluZywgcm93Q2xhc3M6IHN0cmluZywgdGV4dENsYXNzOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcpOiBMb2NhdG9yIHtcblx0cmV0dXJuIHBhZ2UubG9jYXRvcihzY29wZSArICcgJyArIHJvd0NsYXNzKS5maWx0ZXIoeyBoYXM6IHBhZ2UubG9jYXRvcih0ZXh0Q2xhc3MsIHsgaGFzVGV4dDogbmV3IFJlZ0V4cCgnXicgKyBlc2NhcGVSZWdFeHAobGFiZWwpICsgJyQnKSB9KSB9KTtcbn1cblxuZXhwb3J0IGNvbnN0IHZpc2libGVMYWJlbHMgPSAocGFnZTogUGFnZSwgc2NvcGU6IHN0cmluZywgcm93Q2xhc3M6IHN0cmluZywgdGV4dENsYXNzOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiA9PlxuXHRwYWdlLiQkZXZhbChzY29wZSArICcgJyArIHJvd0NsYXNzICsgJzpub3QoW2hpZGRlbl0pICcgKyB0ZXh0Q2xhc3MsIChlbHMpID0+IGVscy5tYXAoKGVsKSA9PiBlbC50ZXh0Q29udGVudCA/PyAnJykpO1xuIiwgIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBTaGFyZWQgaGVscGVycyBmb3IgdGhlIHByZXZpZXcgaW50ZXJhY3Rpb24gdGVzdHMuIFRoZSBET00gbGliIHR5cGVzIHRoZSBjYWxsYmFja3MgdGhhdCBydW4gaW4gdGhlIHBhZ2UuXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgaHR0cCBmcm9tICdub2RlOmh0dHAnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgeyBjaHJvbWl1bSwgdHlwZSBCcm93c2VyLCB0eXBlIFBhZ2UgfSBmcm9tICdwbGF5d3JpZ2h0JztcblxuY29uc3QgaGVyZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpO1xuZXhwb3J0IGNvbnN0IHJvb3QgPSBwYXRoLnJlc29sdmUoaGVyZSwgJy4uJywgJ2Rlc2lnbi1zeXN0ZW0nKTtcblxuaW50ZXJmYWNlIFRva2VuVmFsdWUgeyBbdGhlbWU6IHN0cmluZ106IHN0cmluZyB9XG5pbnRlcmZhY2UgVG9rZW5zIHtcblx0Y29sb3I6IHsgdGhlbWVzOiBBcnJheTx7IGlkOiBzdHJpbmcgfT47IHRva2VuczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfCBUb2tlblZhbHVlIH0+IH07XG5cdHNwYWNpbmc6IHsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9PiB9O1xuXHRyYWRpdXM6IHsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9PiB9O1xuXHR0eXBlOiB7IGZhbWlsaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH07XG59XG5cbi8vIEJ1aWxkcyB0aGUgdG9rZW5zLmNzcyB0aGF0IHRoZSBwcmV2aWV3IGZyYW1lIHByZWxvYWRzLCBmcm9tIHRva2Vucy5qc29uIChmaXJzdCB0aGVtZSkuXG5leHBvcnQgZnVuY3Rpb24gdG9rZW5zQ3NzKCk6IHN0cmluZyB7XG5cdGNvbnN0IHRva2VucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyb290LCAndG9rZW5zLmpzb24nKSwgJ3V0ZjgnKSkgYXMgVG9rZW5zO1xuXHRjb25zdCB0aGVtZSA9IHRva2Vucy5jb2xvci50aGVtZXNbMF0uaWQ7XG5cdGNvbnN0IHZhcnM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0IHJlc29sdmUgPSAodmFsdWU6IHN0cmluZyB8IFRva2VuVmFsdWUpOiBzdHJpbmcgPT4ge1xuXHRcdGNvbnN0IHJhdyA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyB2YWx1ZSA6IHZhbHVlW3RoZW1lXTtcblx0XHRjb25zdCBhbGlhcyA9IC9eXFx7KC4rKVxcfSQvLmV4ZWMocmF3KTtcblx0XHRyZXR1cm4gYWxpYXMgPyAndmFyKC0tJyArIGFsaWFzWzFdICsgJyknIDogcmF3O1xuXHR9O1xuXHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zLmNvbG9yLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgcmVzb2x2ZSh0LnZhbHVlKSArICc7Jyk7XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMuc3BhY2luZy50b2tlbnMpIHZhcnMucHVzaCgnLS0nICsgdC5uYW1lICsgJzogJyArIHQudmFsdWUgKyAnOycpO1xuXHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zLnJhZGl1cy50b2tlbnMpIHZhcnMucHVzaCgnLS0nICsgdC5uYW1lICsgJzogJyArIHQudmFsdWUgKyAnOycpO1xuXHRmb3IgKGNvbnN0IFtrZXksIHN0YWNrXSBvZiBPYmplY3QuZW50cmllcyh0b2tlbnMudHlwZS5mYW1pbGllcykpIHZhcnMucHVzaCgnLS1mb250LScgKyBrZXkgKyAnOiAnICsgc3RhY2sgKyAnOycpO1xuXHRyZXR1cm4gJzpyb290IHsgJyArIHZhcnMuam9pbignICcpICsgJyB9XFxuYm9keSB7IGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQpOyBjb2xvcjogdmFyKC0tZm9yZWdyb3VuZCk7IH0nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXcge1xuXHRwYWdlOiBQYWdlO1xuXHRlcnJvcnM6IHN0cmluZ1tdO1xufVxuXG5jb25zdCBNSU1FOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuXHQnLmh0bWwnOiAndGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04Jyxcblx0Jy5qcyc6ICd0ZXh0L2phdmFzY3JpcHQ7IGNoYXJzZXQ9dXRmLTgnLFxuXHQnLmNzcyc6ICd0ZXh0L2NzczsgY2hhcnNldD11dGYtOCcsXG5cdCcuanNvbic6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0Jy5wbmcnOiAnaW1hZ2UvcG5nJyxcblx0Jy5zdmcnOiAnaW1hZ2Uvc3ZnK3htbCcsXG59O1xuXG5sZXQgYmFzZVVybDogUHJvbWlzZTxzdHJpbmc+IHwgdW5kZWZpbmVkO1xuXG4vLyBTZXJ2ZXMgZGVzaWduLXN5c3RlbSBvdmVyIGh0dHAsIGJlY2F1c2UgQ2hyb21pdW0gYmxvY2tzIG1vZHVsZSBzY3JpcHRzIG9uIGZpbGU6Ly8uIE9uZSBzZXJ2ZXIgcGVyIHByb2Nlc3MuXG5leHBvcnQgZnVuY3Rpb24gc2VydmUoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0YmFzZVVybCA/Pz0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKChyZXEsIHJlcykgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZSA9IHBhdGguam9pbihyb290LCBkZWNvZGVVUklDb21wb25lbnQobmV3IFVSTChyZXEudXJsID8/ICcvJywgJ2h0dHA6Ly94JykucGF0aG5hbWUpKTtcblx0XHRcdGlmICghZmlsZS5zdGFydHNXaXRoKHJvb3QpIHx8ICFmcy5leGlzdHNTeW5jKGZpbGUpIHx8IGZzLnN0YXRTeW5jKGZpbGUpLmlzRGlyZWN0b3J5KCkpIHtcblx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDQpLmVuZCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXMud3JpdGVIZWFkKDIwMCwgeyAnY29udGVudC10eXBlJzogTUlNRVtwYXRoLmV4dG5hbWUoZmlsZSldID8/ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nIH0pO1xuXHRcdFx0ZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlKS5waXBlKHJlcyk7XG5cdFx0fSk7XG5cdFx0c2VydmVyLm9uKCdlcnJvcicsIHJlamVjdCk7XG5cdFx0c2VydmVyLmxpc3RlbigwLCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuXHRcdFx0c2VydmVyLnVucmVmKCk7XG5cdFx0XHRjb25zdCBhZGRyZXNzID0gc2VydmVyLmFkZHJlc3MoKTtcblx0XHRcdHJlc29sdmUoJ2h0dHA6Ly8xMjcuMC4wLjE6JyArICh0eXBlb2YgYWRkcmVzcyA9PT0gJ29iamVjdCcgJiYgYWRkcmVzcyA/IGFkZHJlc3MucG9ydCA6IDApKTtcblx0XHR9KTtcblx0fSk7XG5cdHJldHVybiBiYXNlVXJsO1xufVxuXG4vLyBUaGUgZGVzaWduIHN5c3RlbSBwYWdlIHByZWxvYWRzIGNvbXBvbmVudHMvYnVuZGxlLmpzIGFzIGEgY2xhc3NpYyBzY3JpcHQgYWhlYWQgb2YgdGhlIHByZXZpZXcgbWFya3VwLiBUZXN0cyBkbyB0aGUgc2FtZS5cbmV4cG9ydCBjb25zdCB3aXRoQnVuZGxlID0gKGh0bWw6IHN0cmluZyk6IHN0cmluZyA9PiBodG1sLnJlcGxhY2UoJzwvaGVhZD4nLCAnPHNjcmlwdCBzcmM9XCIvY29tcG9uZW50cy9idW5kbGUuanNcIj48L3NjcmlwdD48L2hlYWQ+Jyk7XG5cbi8vIE9wZW5zIGEgY29tcG9uZW50IHByZXZpZXcgd2l0aCB0aGUgdG9rZW5zIGluamVjdGVkLiBDb25zb2xlIGFuZCBwYWdlIGVycm9ycyBjb2xsZWN0IGluIGBlcnJvcnNgLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5QcmV2aWV3KGJyb3dzZXI6IEJyb3dzZXIsIG5hbWU6IHN0cmluZywgdmlld3BvcnQgPSB7IHdpZHRoOiAxMDAwLCBoZWlnaHQ6IDgwMCB9KTogUHJvbWlzZTxQcmV2aWV3PiB7XG5cdGNvbnN0IHBhZ2UgPSBhd2FpdCBicm93c2VyLm5ld1BhZ2UoeyB2aWV3cG9ydCB9KTtcblx0Y29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXHRwYWdlLm9uKCdwYWdlZXJyb3InLCAoZSkgPT4gZXJyb3JzLnB1c2goU3RyaW5nKGUpKSk7XG5cdHBhZ2Uub24oJ2NvbnNvbGUnLCAobSkgPT4ge1xuXHRcdGlmIChtLnR5cGUoKSA9PT0gJ2Vycm9yJyAmJiAhL2ZvbnRzXFwuZ3xFUlJffEZhaWxlZCB0byBsb2FkIHJlc291cmNlLy50ZXN0KG0udGV4dCgpKSkgZXJyb3JzLnB1c2gobS50ZXh0KCkpO1xuXHR9KTtcblx0YXdhaXQgcGFnZS5yb3V0ZSgnKiovY29tcG9uZW50cy8qL3ByZXZpZXcuaHRtbCcsIGFzeW5jIChyb3V0ZSkgPT4ge1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGUuZmV0Y2goKTtcblx0XHRhd2FpdCByb3V0ZS5mdWxmaWxsKHsgcmVzcG9uc2UsIGJvZHk6IHdpdGhCdW5kbGUoYXdhaXQgcmVzcG9uc2UudGV4dCgpKSB9KTtcblx0fSk7XG5cdGF3YWl0IHBhZ2UuZ290bygoYXdhaXQgc2VydmUoKSkgKyAnL2NvbXBvbmVudHMvJyArIG5hbWUgKyAnL3ByZXZpZXcuaHRtbCcpO1xuXHRhd2FpdCBwYWdlLmFkZFN0eWxlVGFnKHsgY29udGVudDogdG9rZW5zQ3NzKCkgfSk7XG5cdGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTAwKTtcblx0cmV0dXJuIHsgcGFnZSwgZXJyb3JzIH07XG59XG5cbi8vIFJ1bnMgYSB0ZXN0IGJvZHkgd2l0aCBhIGZyZXNoIGJyb3dzZXIgYW5kIGFsd2F5cyBjbG9zZXMgaXQuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aEJyb3dzZXIoYm9keTogKGJyb3dzZXI6IEJyb3dzZXIpID0+IFByb21pc2U8dm9pZD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgYnJvd3NlciA9IGF3YWl0IGNocm9taXVtLmxhdW5jaCgpO1xuXHR0cnkge1xuXHRcdGF3YWl0IGJvZHkoYnJvd3Nlcik7XG5cdH0gZmluYWxseSB7XG5cdFx0YXdhaXQgYnJvd3Nlci5jbG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBiYWNrZ3JvdW5kID0gKHBhZ2U6IFBhZ2UsIHNlbGVjdG9yOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4gcGFnZS4kZXZhbChzZWxlY3RvciwgKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5iYWNrZ3JvdW5kQ29sb3IpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLE9BQU9BLGFBQVk7QUFDbkIsU0FBUyxZQUFZOzs7QUNEckIsT0FBTyxZQUFZO0FBQ25CLE9BQU9DLFNBQVE7QUFDZixPQUFPQyxXQUFVOzs7QUNGakIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHFCQUFxQjtBQUM5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TUFBTSxNQUFNO0FBQ3ZCLFVBQU0sS0FBSyxnQkFBZ0IsT0FBTyxTQUFTLGNBQWMsdUJBQXVCLEdBQUcsYUFBYSxPQUFPLENBQUM7QUFDeEcsVUFBTSxPQUFPLElBQUk7QUFDakIsSUFBQUEsUUFBTyxHQUFHLEtBQUssS0FBSyxNQUFNLFNBQVMsTUFBTSxHQUFHLElBQUksR0FBRyxRQUFRLEdBQUcsSUFBSSxHQUFHO0FBQUEsRUFDdEUsQ0FBQztBQUNGLENBQUM7QUFFRCxLQUFLLDJEQUEyRCxZQUFZO0FBQzNFLFFBQU0sVUFBVSxhQUFhLE9BQU8sU0FBUztBQUM1QyxVQUFNLFdBQVcsS0FBSyxRQUFRLHNCQUFzQixFQUFFLElBQUksQ0FBQyxFQUFFLFFBQVEsS0FBSyxFQUFFLE1BQU07QUFDbEYsVUFBTSxRQUFRLFNBQVMsUUFBUSxXQUFXO0FBQzFDLElBQUFBLFFBQU8sTUFBTSxNQUFNLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxDQUFDO0FBQzVDLFVBQU0sU0FBUyxNQUFNO0FBQ3JCLElBQUFBLFFBQU8sTUFBTSxNQUFNLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxHQUFHLHlEQUF5RDtBQUN2RyxJQUFBQSxRQUFPLE1BQU0sTUFBTSxLQUFLLEtBQUssUUFBUSx3QkFBd0IsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLFNBQVMsQ0FBQztBQUN2RixJQUFBQSxRQUFPLE1BQU0sTUFBTSxLQUFLLEtBQUssUUFBUSx1QkFBdUIsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLFNBQVMsQ0FBQztBQUFBLEVBQ3ZGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJhc3NlcnQiLCAiZnMiLCAicGF0aCIsICJmcyIsICJwYXRoIiwgImtleXMiLCAiYXNzZXJ0Il0KfQo=
