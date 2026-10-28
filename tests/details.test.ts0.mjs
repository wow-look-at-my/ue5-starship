// tests/details.test.ts
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
  for (const [key2, stack] of Object.entries(tokens.type.families)) vars.push("--font-" + key2 + ": " + stack + ";");
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

// tests/details.test.ts
var CLEAR = "rgba(0, 0, 0, 0)";
var shadowOf = (target) => target.evaluate((el) => getComputedStyle(el).boxShadow);
var colorOf = (target) => target.evaluate((el) => getComputedStyle(el).color);
var visibilityOf = (target) => target.evaluate((el) => getComputedStyle(el).visibility);
var trimmed = async (target) => (await target.textContent() ?? "").trim();
var dataValue = (target) => target.evaluate((el) => Number(el.dataset.value));
var activeClass = (page) => page.evaluate(() => document.activeElement.className);
var key = (page, name) => page.keyboard.press(name);
var typeIn = (page, text) => page.keyboard.type(text);
var replaceText = async (page, text) => {
  await key(page, "Control+a");
  await typeIn(page, text);
};
var triple = (fields) => Promise.all([0, 1, 2].map((i) => dataValue(fields.nth(i))));
var pointerDown = (page) => page.mouse.down();
var pointerUp = (page) => page.mouse.up();
var pointerTo = (page, x, y) => page.mouse.move(x, y);
var computedColor = (page, css) => page.evaluate((value) => {
  const swatch = document.body.appendChild(document.createElement("i"));
  swatch.style.color = value;
  const resolved = getComputedStyle(swatch).color;
  swatch.remove();
  return resolved;
}, css);
async function centerOf(target) {
  const box = await target.boundingBox();
  assert2.ok(box, "target has a box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
test("DetailsHeader: buttons show hover and pressed, the lock toggles, the name edits", async () => {
  await inPreview("DetailsHeader", async (page) => {
    const add = page.locator("ue-details-header .DetailsHeader-add");
    assert2.equal(await bgOf(add), rgb("secondary"));
    await add.hover();
    assert2.equal(await bgOf(add), rgb("hover"));
    await pointerDown(page);
    assert2.equal(await bgOf(add), rgb("header"));
    await pointerUp(page);
    const help = page.locator("ue-details-header .DetailsHeader-help");
    assert2.equal(await bgOf(help), CLEAR);
    await help.hover();
    assert2.equal(await bgOf(help), rgb("dropdown"));
    const lock = page.locator("ue-details-header .DetailsHeader-lock");
    const glyph = lock.locator("use");
    assert2.equal(await glyph.getAttribute("href"), "#DetailsHeader-unlock");
    await lock.click();
    assert2.equal(await lock.getAttribute("aria-pressed"), "true");
    assert2.equal(await glyph.getAttribute("href"), "#DetailsHeader-locked");
    await lock.click();
    assert2.equal(await glyph.getAttribute("href"), "#DetailsHeader-unlock");
    const label = page.locator("ue-details-header .DetailsHeader-label");
    const instance = page.locator("ue-details-header .DetailsHeader-instance .name");
    assert2.equal(await bgOf(label), CLEAR);
    await label.hover();
    assert2.equal(await bgOf(label), rgb("input"));
    assert2.ok((await shadowOf(label)).includes(rgb("hover")), "hover outline");
    await label.click();
    assert2.ok((await shadowOf(label)).includes(rgb("primary")), "focus outline");
    await replaceText(page, "Table");
    await key(page, "Enter");
    assert2.equal(await trimmed(label), "Table");
    assert2.equal(await trimmed(instance), "Table");
    await label.click();
    await replaceText(page, "Sofa");
    await key(page, "Escape");
    assert2.equal(await trimmed(label), "Table");
  });
});
test("DetailsSearchRow: typing shows the clear X, Escape and X clear, star toggles, gear opens a menu", async () => {
  await inPreview("DetailsSearchRow", async (page) => {
    const row = page.locator("ue-details-search-row");
    const input = row.locator(".DetailsSearchRow-text");
    const box = row.locator(".DetailsSearchRow-search");
    const clear = row.locator(".DetailsSearchRow-clear");
    assert2.ok(!await clear.isVisible(), "no X without text");
    await box.hover();
    assert2.ok((await shadowOf(box)).includes(rgb("hover")), "hover outline");
    await input.click();
    assert2.ok((await shadowOf(box)).includes(rgb("primary")), "focus ring");
    await typeIn(page, "scale");
    assert2.equal(await input.inputValue(), "scale");
    assert2.ok(await clear.isVisible(), "X shows with text");
    await clear.click();
    assert2.equal(await input.inputValue(), "");
    assert2.ok(!await clear.isVisible());
    await typeIn(page, "abc");
    await key(page, "Escape");
    assert2.equal(await input.inputValue(), "");
    const star = row.locator('[data-role="favorites"]');
    await star.click();
    assert2.equal(await star.getAttribute("aria-pressed"), "true");
    assert2.equal(await colorOf(star), rgb("accent-blue"));
    await star.click();
    assert2.equal(await star.getAttribute("aria-pressed"), "false");
    const table = row.locator(".DetailsSearchRow-btn.is-button").first();
    await table.hover();
    assert2.equal(await bgOf(table), rgb("dropdown"));
    const gear = row.locator('[data-role="options"]');
    const menu = row.locator(".DetailsSearchRow-menu");
    const modified = row.locator('[data-option="modified"]');
    assert2.ok(!await menu.isVisible());
    await gear.click();
    assert2.ok(await menu.isVisible());
    assert2.equal(await gear.getAttribute("aria-expanded"), "true");
    assert2.equal(await modified.getAttribute("aria-checked"), "false");
    await modified.click();
    assert2.ok(!await menu.isVisible(), "menu closes after a pick");
    assert2.equal(await modified.getAttribute("aria-checked"), "true");
    await gear.click();
    await key(page, "Escape");
    assert2.ok(!await menu.isVisible());
  });
});
test("FilterPills: a click makes one active pill, hover and arrow keys work", async () => {
  await inPreview("FilterPills", async (page) => {
    const pills = page.locator("ue-filter-pills .FilterPills-pill");
    const checked = () => pills.locator('xpath=self::*[contains(@class, "is-checked")]').allTextContents();
    assert2.deepEqual(await checked(), ["All"]);
    const physics = pills.filter({ hasText: /^Physics$/ });
    await physics.hover();
    assert2.equal(await bgOf(physics), rgb("hover"));
    await physics.click();
    assert2.deepEqual(await checked(), ["Physics"]);
    assert2.equal(await bgOf(physics), rgb("primary-hover"));
    await page.mouse.move(0, 0);
    assert2.equal(await bgOf(physics), rgb("primary"));
    assert2.equal(await physics.getAttribute("aria-selected"), "true");
    assert2.equal(await page.locator('ue-filter-pills [aria-selected="true"]').count(), 1);
    await key(page, "ArrowRight");
    assert2.deepEqual(await checked(), ["Rendering"]);
    await key(page, "Home");
    assert2.deepEqual(await checked(), ["General"]);
    await key(page, "End");
    assert2.deepEqual(await checked(), ["All"]);
    await key(page, "ArrowRight");
    assert2.deepEqual(await checked(), ["General"], "wraps around");
  });
});
test("SegmentedControl: click selects, arrows move, hover fills, the pinned row is untouched", async () => {
  await inPreview("SegmentedControl", async (page) => {
    const group = page.locator("ue-segmented-control").nth(0);
    const segs = group.locator(".SegmentedControl-seg");
    const checked = () => group.locator(".SegmentedControl-seg.is-checked").allTextContents();
    assert2.deepEqual(await checked(), ["Static"]);
    await segs.nth(1).hover();
    assert2.equal(await bgOf(segs.nth(1)), rgb("hover"));
    await segs.nth(1).click();
    assert2.deepEqual(await checked(), ["Stationary"]);
    assert2.equal(await segs.nth(1).getAttribute("aria-checked"), "true");
    assert2.equal(await segs.nth(0).getAttribute("aria-checked"), "false");
    await page.mouse.move(0, 0);
    assert2.equal(await bgOf(segs.nth(1)), rgb("dropdown"));
    await key(page, "ArrowRight");
    assert2.deepEqual(await checked(), ["Movable"]);
    await key(page, "ArrowRight");
    assert2.deepEqual(await checked(), ["Movable"], "stops at the end");
    await key(page, "Home");
    assert2.deepEqual(await checked(), ["Static"]);
    const pinnedRow = page.locator(".SegmentedControl-row").nth(1);
    assert2.equal(await pinnedRow.locator("xpath=ancestor::ue-segmented-control").count(), 0);
    await pinnedRow.locator(".SegmentedControl-seg").nth(0).click();
    assert2.deepEqual(await pinnedRow.locator(".SegmentedControl-seg.is-checked").allTextContents(), ["Stationary"]);
    const second = page.locator("ue-segmented-control").nth(1);
    await second.locator(".SegmentedControl-seg").nth(2).click();
    assert2.deepEqual(await second.locator(".SegmentedControl-seg.is-checked").allTextContents(), ["Movable"]);
    assert2.deepEqual(await checked(), ["Static"], "a second instance is independent");
  });
});
test("AssetPicker: the list sets the label and thumbnail, buttons react, reset restores", async () => {
  await inPreview("AssetPicker", async (page) => {
    const root2 = page.locator("ue-asset-picker");
    const combo = root2.locator(".AssetPicker-combo");
    const menu = root2.locator(".AssetPicker-menu");
    const label = root2.locator(".AssetPicker-combo .label");
    const reset = root2.locator(".AssetPicker-reset");
    const thumb = root2.locator(".AssetPicker-thumbFrame");
    const option = (name) => root2.locator('.AssetPicker-menuItem[data-asset="' + name + '"]');
    assert2.equal(await trimmed(label), "SM_Chair");
    assert2.ok(!await menu.isVisible());
    await combo.hover();
    assert2.ok((await shadowOf(combo)).includes(rgb("hover")));
    await combo.click();
    assert2.ok(await menu.isVisible());
    await option("SM_Couch").click();
    assert2.ok(!await menu.isVisible());
    assert2.equal(await trimmed(label), "SM_Couch");
    assert2.equal(await thumb.getAttribute("title"), "/Game/Props/SM_Couch.SM_Couch");
    assert2.equal(await option("SM_Couch").getAttribute("aria-selected"), "true");
    assert2.equal(await option("SM_Chair").getAttribute("aria-selected"), "false");
    await combo.focus();
    await key(page, "ArrowDown");
    assert2.ok(await menu.isVisible());
    await key(page, "ArrowDown");
    await key(page, "Enter");
    assert2.equal(await trimmed(label), "SM_Lamp");
    assert2.equal(await activeClass(page), "AssetPicker-combo", "focus returns to the combo");
    const use = root2.locator('[data-role="use"]');
    await use.hover();
    assert2.equal(await bgOf(use), rgb("dropdown"));
    await use.click();
    assert2.equal(await trimmed(label), "SM_Table");
    assert2.equal(await visibilityOf(reset), "visible");
    await reset.click();
    assert2.equal(await trimmed(label), "None");
    assert2.equal(await visibilityOf(reset), "hidden");
    assert2.equal(await thumb.getAttribute("title"), "None");
    await combo.click();
    await page.mouse.click(910, 710);
    assert2.ok(!await menu.isVisible(), "an outside click closes the list");
  });
});
test("VectorInput: dragging changes a value and shows reset, reset restores, typing and keys work", async () => {
  await inPreview("VectorInput", async (page) => {
    const scale = page.locator("ue-vector-input .VectorInput-row").nth(2);
    const fields = scale.locator(".VectorInput-field");
    const reset = scale.locator(".VectorInput-reset");
    const shown = (i) => trimmed(fields.nth(i).locator(".VectorInput-value-text"));
    assert2.equal(await fields.nth(0).evaluate((el) => getComputedStyle(el).cursor), "ew-resize");
    assert2.equal(await visibilityOf(reset), "hidden", "no reset at the default");
    await fields.nth(0).hover();
    assert2.ok((await shadowOf(fields.nth(0))).includes(rgb("hover")));
    const { x, y } = await centerOf(fields.nth(0));
    await pointerTo(page, x, y);
    await pointerDown(page);
    await page.mouse.move(x + 20, y, { steps: 4 });
    assert2.ok((await shadowOf(fields.nth(0))).includes(rgb("primary")), "active outline while dragging");
    await page.mouse.move(x + 70, y, { steps: 8 });
    await pointerUp(page);
    assert2.ok(await dataValue(fields.nth(0)) > 1.3, "dragging right raised X: " + await dataValue(fields.nth(0)));
    assert2.equal(await dataValue(fields.nth(1)), 1, "the other axes stay unlinked");
    assert2.equal(await visibilityOf(reset), "visible", "reset shows after a change");
    assert2.ok(!await fields.nth(0).evaluate((el) => el.classList.contains("is-active")), "active outline ends with the drag");
    await reset.click();
    assert2.deepEqual(await triple(fields), [1, 1, 1]);
    assert2.equal(await shown(0), "1.0");
    assert2.equal(await visibilityOf(reset), "hidden");
    await pointerTo(page, x, y);
    await pointerDown(page);
    await page.mouse.move(x + 60, y, { steps: 6 });
    await key(page, "Escape");
    await pointerUp(page);
    assert2.equal(await dataValue(fields.nth(0)), 1, "Escape restores the value from before the drag");
    await fields.nth(1).click();
    assert2.ok(await fields.nth(1).evaluate((el) => el.classList.contains("is-editing")));
    await typeIn(page, "2.5");
    await key(page, "Enter");
    assert2.equal(await dataValue(fields.nth(1)), 2.5);
    assert2.equal(await shown(1), "2.5");
    await fields.nth(1).click();
    await typeIn(page, "9");
    await key(page, "Escape");
    assert2.equal(await dataValue(fields.nth(1)), 2.5);
    await fields.nth(2).focus();
    await key(page, "ArrowUp");
    assert2.equal(await dataValue(fields.nth(2)), 1.0025);
    await key(page, "ArrowDown");
    await key(page, "ArrowDown");
    assert2.equal(await dataValue(fields.nth(2)), 0.9975);
  });
});
test("VectorInput: the scale lock links the axes, the label menu opens, units survive an edit", async () => {
  await inPreview("VectorInput", async (page) => {
    const rows = page.locator("ue-vector-input .VectorInput-row");
    const fields = rows.nth(2).locator(".VectorInput-field");
    const lock = rows.nth(2).locator(".VectorInput-lock");
    await lock.click();
    assert2.equal(await lock.getAttribute("aria-pressed"), "true");
    assert2.equal(await lock.locator("use").getAttribute("href"), "#VectorInput-locked");
    await fields.nth(0).click();
    await typeIn(page, "2");
    await key(page, "Enter");
    assert2.deepEqual(await triple(fields), [2, 2, 2]);
    await fields.nth(1).focus();
    await key(page, "ArrowUp");
    const [x, , z] = await triple(fields);
    assert2.ok(Math.abs(x - 2.0025) < 1e-6 && Math.abs(z - 2.0025) < 1e-6, "stepping Y moves X and Z by the same ratio");
    await lock.click();
    assert2.equal(await lock.locator("use").getAttribute("href"), "#VectorInput-unlock");
    await fields.nth(0).click();
    await typeIn(page, "3");
    await key(page, "Enter");
    assert2.equal(await dataValue(fields.nth(0)), 3);
    assert2.ok(await dataValue(fields.nth(1)) < 3, "unlocked axes move alone");
    const menu = rows.nth(0).locator(".VectorInput-menu");
    assert2.ok(!await menu.isVisible());
    await rows.nth(0).locator(".VectorInput-combo").click();
    assert2.ok(await menu.isVisible());
    assert2.equal(await trimmed(menu.locator(".VectorInput-menuHead")), "Location Type");
    await menu.locator(".VectorInput-menuItem", { hasText: "World" }).click();
    assert2.ok(!await menu.isVisible());
    assert2.equal(await menu.locator(".VectorInput-menuItem", { hasText: "World" }).getAttribute("aria-checked"), "true");
    assert2.equal(await menu.locator(".VectorInput-menuItem", { hasText: "Relative" }).getAttribute("aria-checked"), "false");
    const yaw = rows.nth(1).locator(".VectorInput-field").nth(2);
    await yaw.click();
    await replaceText(page, "90");
    await key(page, "Enter");
    assert2.equal(await trimmed(yaw.locator(".VectorInput-value-text")), "90.0 \xB0");
  });
});
test("DetailsCategory: headers fold their rows, row arrows fold children, checkbox and text edit work", async () => {
  await inPreview("DetailsCategory", async (page) => {
    const frame = page.locator("ue-details-category").nth(0);
    const header = frame.locator(".DetailsCategory-catRow").nth(0);
    const rowOf = (name2) => frame.locator(".DetailsCategory-row").filter({ has: page.locator(".DetailsCategory-label", { hasText: new RegExp("^" + name2 + "$") }) });
    assert2.ok(await rowOf("Visible").isVisible());
    assert2.ok(!await rowOf("Static Mesh").isVisible(), "Static Mesh rows start folded");
    await header.hover();
    assert2.equal(await colorOf(header.locator(".DetailsCategory-arrow")), await computedColor(page, "color-mix(in srgb, var(--foreground-hover) 60%, transparent)"));
    await header.click();
    assert2.equal(await header.getAttribute("aria-expanded"), "false");
    assert2.equal(await header.locator("use").getAttribute("href"), "#DetailsCategory-right");
    for (const name2 of ["Visible", "Actor Label", "Collision Preset", "Lighting", "Cast Shadow"]) assert2.ok(!await rowOf(name2).isVisible(), name2 + " folded");
    await header.press("ArrowRight");
    assert2.equal(await header.locator("use").getAttribute("href"), "#DetailsCategory-down");
    assert2.ok(await rowOf("Visible").isVisible());
    await header.press("Enter");
    assert2.ok(!await rowOf("Visible").isVisible(), "Enter folds");
    await header.press("Space");
    assert2.ok(await rowOf("Visible").isVisible(), "Space unfolds");
    const arrow = rowOf("Lighting").locator(".DetailsCategory-rowArrow");
    assert2.ok(await rowOf("Cast Shadow").isVisible());
    await arrow.click();
    assert2.ok(!await rowOf("Cast Shadow").isVisible());
    assert2.equal(await arrow.getAttribute("aria-expanded"), "false");
    await arrow.click();
    assert2.ok(await rowOf("Cast Shadow").isVisible());
    const name = rowOf("Visible").locator(".DetailsCategory-name");
    assert2.equal(await bgOf(name), rgb("panel"));
    await name.hover();
    assert2.equal(await bgOf(name), rgb("header"));
    const check = rowOf("Visible").locator(".DetailsCategory-check");
    assert2.equal(await check.getAttribute("aria-checked"), "true");
    await check.click();
    assert2.equal(await check.getAttribute("aria-checked"), "false");
    assert2.equal(await visibilityOf(check.locator("svg")), "hidden");
    await check.press("Space");
    assert2.equal(await check.getAttribute("aria-checked"), "true");
    const field = rowOf("Actor Label").locator(".DetailsCategory-text");
    const reset = rowOf("Actor Label").locator(".DetailsCategory-reset");
    await field.click();
    assert2.ok((await shadowOf(field)).includes(rgb("primary")));
    await replaceText(page, "Table");
    await key(page, "Enter");
    assert2.equal(await trimmed(field), "Table");
    await field.click();
    await replaceText(page, "Junk");
    await key(page, "Escape");
    assert2.equal(await trimmed(field), "Table");
    await reset.click();
    assert2.equal(await trimmed(field), "StaticMeshActor_0");
    assert2.equal(await visibilityOf(reset), "hidden");
    assert2.ok(!await rowOf("Render in Main Pass").isVisible());
    await frame.locator(".DetailsCategory-advRow").click();
    assert2.ok(await rowOf("Render in Main Pass").isVisible());
    await frame.locator(".DetailsCategory-catRow").nth(1).click();
    assert2.ok(await frame.locator(".DetailsCategory-row", { hasText: "SM_Chair" }).isVisible());
    const pinned = page.locator(".DetailsCategory-frame").last();
    assert2.equal(await pinned.locator("xpath=ancestor::ue-details-category").count(), 0);
    assert2.ok(await pinned.locator(".DetailsCategory-row.is-hover").isVisible());
  });
});
test("DetailsCategory: the live details panel filters rows by search and section", async () => {
  await inPreview("DetailsCategory", async (page) => {
    const panel = page.locator(".DetailsCategory-panel");
    const input = panel.locator(".DetailsCategory-srInput");
    const shown = () => panel.locator(".DetailsCategory-row").evaluateAll((rows) => rows.filter((row) => row.offsetParent !== null).map((row) => (row.querySelector(".DetailsCategory-label")?.textContent ?? "").trim()));
    const cats = () => panel.locator(".DetailsCategory-cat").evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => (el.querySelector(".DetailsCategory-title")?.textContent ?? "").trim()));
    const pill = (label) => panel.locator(".DetailsCategory-pill", { hasText: new RegExp("^" + label + "$") });
    const option = async (name2) => {
      await panel.locator('[data-role="options"]').click();
      await panel.locator('[data-option="' + name2 + '"]').click();
    };
    assert2.deepEqual(await cats(), ["General", "Rendering"]);
    assert2.equal((await shown()).length, 7);
    await input.click();
    await typeIn(page, "shadow");
    assert2.deepEqual(await shown(), ["Lighting", "Cast Shadow"], "the parent row stays with its matching child");
    assert2.deepEqual(await cats(), ["Rendering"], "a category with no match hides");
    assert2.ok(await panel.locator(".DetailsCategory-srClear").isVisible());
    await key(page, "Escape");
    assert2.equal(await input.inputValue(), "");
    assert2.equal((await shown()).length, 7);
    await typeIn(page, "zzz");
    assert2.deepEqual(await shown(), []);
    assert2.ok(await panel.locator(".DetailsCategory-empty").isVisible(), "empty message");
    await panel.locator(".DetailsCategory-srClear").click();
    assert2.ok(!await panel.locator(".DetailsCategory-empty").isVisible());
    await pill("General").click();
    assert2.deepEqual(await cats(), ["General"]);
    assert2.equal(await panel.locator(".DetailsCategory-pill.is-checked").count(), 1);
    await pill("Physics").click();
    assert2.deepEqual(await cats(), []);
    assert2.ok(await panel.locator(".DetailsCategory-empty").isVisible());
    await pill("Rendering").click();
    assert2.deepEqual(await cats(), ["Rendering"]);
    await input.click();
    await typeIn(page, "tags");
    assert2.deepEqual(await shown(), [], "search and section combine");
    await panel.locator(".DetailsCategory-srClear").click();
    await pill("All").click();
    await option("collapseAll");
    assert2.deepEqual(await shown(), []);
    await option("expandAll");
    assert2.equal((await shown()).length, 7);
    await option("modified");
    assert2.deepEqual(await shown(), ["Actor Label", "Tags"], "only rows with a reset arrow");
    await option("modified");
    assert2.equal((await shown()).length, 7);
    const star = panel.locator('[data-role="favorites"]');
    await star.click();
    assert2.equal(await star.getAttribute("aria-pressed"), "true");
    const lock = panel.locator('[data-role="lock"]');
    await lock.click();
    assert2.equal(await lock.locator("use").getAttribute("href"), "#DetailsCategory-locked");
    const name = panel.locator(".DetailsCategory-hdrName");
    await name.click();
    await replaceText(page, "Bench");
    await key(page, "Enter");
    assert2.equal(await trimmed(name), "Bench");
  });
});
for (const name of ["DetailsHeader", "DetailsSearchRow", "FilterPills", "DetailsCategory", "VectorInput", "SegmentedControl", "AssetPicker"]) {
  test(name + ": no script tags, captions present", async () => {
    await inPreview(name, async (page) => {
      assert2.equal(await page.locator("script:not([src])").count(), 0, "inline script");
      assert2.equal(await page.locator('script:not([src$="bundle.js"])').count(), 0, "script tag");
      assert2.ok(await page.locator('[class*="-cap"]').count() >= 1, "captions");
    });
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZGV0YWlscy50ZXN0LnRzIiwgInByZXZpZXcta2l0LnRzIiwgImxpYi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8vIDxyZWZlcmVuY2UgbGliPVwiZG9tXCIgLz5cbi8vIEludGVyYWN0aW9uIHRlc3RzIGZvciB0aGUgRGV0YWlscyBncm91cDogdGhlIHByZXZpZXdzIHJ1biB0aGVpciBjdXN0b20gZWxlbWVudHMgaW4gYSByZWFsIGJyb3dzZXIuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0L3N0cmljdCc7XG5pbXBvcnQgeyB0ZXN0IH0gZnJvbSAnbm9kZTp0ZXN0JztcbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgYmdPZiwgaW5QcmV2aWV3LCByZ2IgfSBmcm9tICcuL3ByZXZpZXcta2l0LnRzJztcblxuY29uc3QgQ0xFQVIgPSAncmdiYSgwLCAwLCAwLCAwKSc7XG5cbmNvbnN0IHNoYWRvd09mID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nPiA9PiB0YXJnZXQuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5ib3hTaGFkb3cpO1xuY29uc3QgY29sb3JPZiA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuY29sb3IpO1xuY29uc3QgdmlzaWJpbGl0eU9mID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nPiA9PiB0YXJnZXQuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS52aXNpYmlsaXR5KTtcbmNvbnN0IHRyaW1tZWQgPSBhc3luYyAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+ICgoYXdhaXQgdGFyZ2V0LnRleHRDb250ZW50KCkpID8/ICcnKS50cmltKCk7XG5jb25zdCBkYXRhVmFsdWUgPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxudW1iZXI+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwpID0+IE51bWJlcigoZWwgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQudmFsdWUpKTtcbmNvbnN0IGFjdGl2ZUNsYXNzID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZz4gPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCBhcyBIVE1MRWxlbWVudCkuY2xhc3NOYW1lKTtcbmNvbnN0IGtleSA9IChwYWdlOiBQYWdlLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2Uua2V5Ym9hcmQucHJlc3MobmFtZSk7XG5jb25zdCB0eXBlSW4gPSAocGFnZTogUGFnZSwgdGV4dDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiBwYWdlLmtleWJvYXJkLnR5cGUodGV4dCk7XG5jb25zdCByZXBsYWNlVGV4dCA9IGFzeW5jIChwYWdlOiBQYWdlLCB0ZXh0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcblx0YXdhaXQga2V5KHBhZ2UsICdDb250cm9sK2EnKTtcblx0YXdhaXQgdHlwZUluKHBhZ2UsIHRleHQpO1xufTtcbmNvbnN0IHRyaXBsZSA9IChmaWVsZHM6IExvY2F0b3IpOiBQcm9taXNlPG51bWJlcltdPiA9PiBQcm9taXNlLmFsbChbMCwgMSwgMl0ubWFwKChpKSA9PiBkYXRhVmFsdWUoZmllbGRzLm50aChpKSkpKTtcbmNvbnN0IHBvaW50ZXJEb3duID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuZG93bigpO1xuY29uc3QgcG9pbnRlclVwID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UudXAoKTtcbmNvbnN0IHBvaW50ZXJUbyA9IChwYWdlOiBQYWdlLCB4OiBudW1iZXIsIHk6IG51bWJlcik6IFByb21pc2U8dm9pZD4gPT4gcGFnZS5tb3VzZS5tb3ZlKHgsIHkpO1xuXG4vLyBDb21wdXRlcyBhIGNvbG91ciB0aGUgd2F5IHRoZSBwYWdlIGRvZXMsIGZvciB2YWx1ZXMgdGhlIHRva2VuIGZpbGUgY2Fubm90IGV4cHJlc3Mgc3VjaCBhcyBjb2xvci1taXgoKS5cbmNvbnN0IGNvbXB1dGVkQ29sb3IgPSAocGFnZTogUGFnZSwgY3NzOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT5cblx0cGFnZS5ldmFsdWF0ZSgodmFsdWUpID0+IHtcblx0XHRjb25zdCBzd2F0Y2ggPSBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2knKSk7XG5cdFx0c3dhdGNoLnN0eWxlLmNvbG9yID0gdmFsdWU7XG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSBnZXRDb21wdXRlZFN0eWxlKHN3YXRjaCkuY29sb3I7XG5cdFx0c3dhdGNoLnJlbW92ZSgpO1xuXHRcdHJldHVybiByZXNvbHZlZDtcblx0fSwgY3NzKTtcblxuYXN5bmMgZnVuY3Rpb24gY2VudGVyT2YodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTx7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0+IHtcblx0Y29uc3QgYm94ID0gYXdhaXQgdGFyZ2V0LmJvdW5kaW5nQm94KCk7XG5cdGFzc2VydC5vayhib3gsICd0YXJnZXQgaGFzIGEgYm94Jyk7XG5cdHJldHVybiB7IHg6IGJveC54ICsgYm94LndpZHRoIC8gMiwgeTogYm94LnkgKyBib3guaGVpZ2h0IC8gMiB9O1xufVxuXG50ZXN0KCdEZXRhaWxzSGVhZGVyOiBidXR0b25zIHNob3cgaG92ZXIgYW5kIHByZXNzZWQsIHRoZSBsb2NrIHRvZ2dsZXMsIHRoZSBuYW1lIGVkaXRzJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ0RldGFpbHNIZWFkZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGFkZCA9IHBhZ2UubG9jYXRvcigndWUtZGV0YWlscy1oZWFkZXIgLkRldGFpbHNIZWFkZXItYWRkJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YoYWRkKSwgcmdiKCdzZWNvbmRhcnknKSk7XG5cdFx0YXdhaXQgYWRkLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YoYWRkKSwgcmdiKCdob3ZlcicpKTtcblx0XHRhd2FpdCBwb2ludGVyRG93bihwYWdlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihhZGQpLCByZ2IoJ2hlYWRlcicpKTtcblx0XHRhd2FpdCBwb2ludGVyVXAocGFnZSk7XG5cblx0XHRjb25zdCBoZWxwID0gcGFnZS5sb2NhdG9yKCd1ZS1kZXRhaWxzLWhlYWRlciAuRGV0YWlsc0hlYWRlci1oZWxwJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YoaGVscCksIENMRUFSKTtcblx0XHRhd2FpdCBoZWxwLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YoaGVscCksIHJnYignZHJvcGRvd24nKSk7XG5cblx0XHRjb25zdCBsb2NrID0gcGFnZS5sb2NhdG9yKCd1ZS1kZXRhaWxzLWhlYWRlciAuRGV0YWlsc0hlYWRlci1sb2NrJyk7XG5cdFx0Y29uc3QgZ2x5cGggPSBsb2NrLmxvY2F0b3IoJ3VzZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBnbHlwaC5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyNEZXRhaWxzSGVhZGVyLXVubG9jaycpO1xuXHRcdGF3YWl0IGxvY2suY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgbG9jay5nZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBnbHlwaC5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyNEZXRhaWxzSGVhZGVyLWxvY2tlZCcpO1xuXHRcdGF3YWl0IGxvY2suY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZ2x5cGguZ2V0QXR0cmlidXRlKCdocmVmJyksICcjRGV0YWlsc0hlYWRlci11bmxvY2snKTtcblxuXHRcdGNvbnN0IGxhYmVsID0gcGFnZS5sb2NhdG9yKCd1ZS1kZXRhaWxzLWhlYWRlciAuRGV0YWlsc0hlYWRlci1sYWJlbCcpO1xuXHRcdGNvbnN0IGluc3RhbmNlID0gcGFnZS5sb2NhdG9yKCd1ZS1kZXRhaWxzLWhlYWRlciAuRGV0YWlsc0hlYWRlci1pbnN0YW5jZSAubmFtZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKGxhYmVsKSwgQ0xFQVIpO1xuXHRcdGF3YWl0IGxhYmVsLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YobGFiZWwpLCByZ2IoJ2lucHV0JykpO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgc2hhZG93T2YobGFiZWwpKS5pbmNsdWRlcyhyZ2IoJ2hvdmVyJykpLCAnaG92ZXIgb3V0bGluZScpO1xuXHRcdGF3YWl0IGxhYmVsLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBzaGFkb3dPZihsYWJlbCkpLmluY2x1ZGVzKHJnYigncHJpbWFyeScpKSwgJ2ZvY3VzIG91dGxpbmUnKTtcblx0XHRhd2FpdCByZXBsYWNlVGV4dChwYWdlLCAnVGFibGUnKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0VudGVyJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRyaW1tZWQobGFiZWwpLCAnVGFibGUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHJpbW1lZChpbnN0YW5jZSksICdUYWJsZScpO1xuXHRcdGF3YWl0IGxhYmVsLmNsaWNrKCk7XG5cdFx0YXdhaXQgcmVwbGFjZVRleHQocGFnZSwgJ1NvZmEnKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0VzY2FwZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0cmltbWVkKGxhYmVsKSwgJ1RhYmxlJyk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ0RldGFpbHNTZWFyY2hSb3c6IHR5cGluZyBzaG93cyB0aGUgY2xlYXIgWCwgRXNjYXBlIGFuZCBYIGNsZWFyLCBzdGFyIHRvZ2dsZXMsIGdlYXIgb3BlbnMgYSBtZW51JywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCBpblByZXZpZXcoJ0RldGFpbHNTZWFyY2hSb3cnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IHJvdyA9IHBhZ2UubG9jYXRvcigndWUtZGV0YWlscy1zZWFyY2gtcm93Jyk7XG5cdFx0Y29uc3QgaW5wdXQgPSByb3cubG9jYXRvcignLkRldGFpbHNTZWFyY2hSb3ctdGV4dCcpO1xuXHRcdGNvbnN0IGJveCA9IHJvdy5sb2NhdG9yKCcuRGV0YWlsc1NlYXJjaFJvdy1zZWFyY2gnKTtcblx0XHRjb25zdCBjbGVhciA9IHJvdy5sb2NhdG9yKCcuRGV0YWlsc1NlYXJjaFJvdy1jbGVhcicpO1xuXG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgY2xlYXIuaXNWaXNpYmxlKCkpLCAnbm8gWCB3aXRob3V0IHRleHQnKTtcblx0XHRhd2FpdCBib3guaG92ZXIoKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IHNoYWRvd09mKGJveCkpLmluY2x1ZGVzKHJnYignaG92ZXInKSksICdob3ZlciBvdXRsaW5lJyk7XG5cdFx0YXdhaXQgaW5wdXQuY2xpY2soKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IHNoYWRvd09mKGJveCkpLmluY2x1ZGVzKHJnYigncHJpbWFyeScpKSwgJ2ZvY3VzIHJpbmcnKTtcblx0XHRhd2FpdCB0eXBlSW4ocGFnZSwgJ3NjYWxlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGlucHV0LmlucHV0VmFsdWUoKSwgJ3NjYWxlJyk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IGNsZWFyLmlzVmlzaWJsZSgpLCAnWCBzaG93cyB3aXRoIHRleHQnKTtcblx0XHRhd2FpdCBjbGVhci5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBpbnB1dC5pbnB1dFZhbHVlKCksICcnKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBjbGVhci5pc1Zpc2libGUoKSkpO1xuXHRcdGF3YWl0IHR5cGVJbihwYWdlLCAnYWJjJyk7XG5cdFx0YXdhaXQga2V5KHBhZ2UsICdFc2NhcGUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5wdXQuaW5wdXRWYWx1ZSgpLCAnJyk7XG5cblx0XHRjb25zdCBzdGFyID0gcm93LmxvY2F0b3IoJ1tkYXRhLXJvbGU9XCJmYXZvcml0ZXNcIl0nKTtcblx0XHRhd2FpdCBzdGFyLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN0YXIuZ2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgY29sb3JPZihzdGFyKSwgcmdiKCdhY2NlbnQtYmx1ZScpKTtcblx0XHRhd2FpdCBzdGFyLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN0YXIuZ2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnKSwgJ2ZhbHNlJyk7XG5cblx0XHRjb25zdCB0YWJsZSA9IHJvdy5sb2NhdG9yKCcuRGV0YWlsc1NlYXJjaFJvdy1idG4uaXMtYnV0dG9uJykuZmlyc3QoKTtcblx0XHRhd2FpdCB0YWJsZS5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHRhYmxlKSwgcmdiKCdkcm9wZG93bicpKTtcblxuXHRcdGNvbnN0IGdlYXIgPSByb3cubG9jYXRvcignW2RhdGEtcm9sZT1cIm9wdGlvbnNcIl0nKTtcblx0XHRjb25zdCBtZW51ID0gcm93LmxvY2F0b3IoJy5EZXRhaWxzU2VhcmNoUm93LW1lbnUnKTtcblx0XHRjb25zdCBtb2RpZmllZCA9IHJvdy5sb2NhdG9yKCdbZGF0YS1vcHRpb249XCJtb2RpZmllZFwiXScpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCkpKTtcblx0XHRhd2FpdCBnZWFyLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCkpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBnZWFyLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBtb2RpZmllZC5nZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcpLCAnZmFsc2UnKTtcblx0XHRhd2FpdCBtb2RpZmllZC5jbGljaygpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCkpLCAnbWVudSBjbG9zZXMgYWZ0ZXIgYSBwaWNrJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1vZGlmaWVkLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICd0cnVlJyk7XG5cdFx0YXdhaXQgZ2Vhci5jbGljaygpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnRXNjYXBlJyk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgbWVudS5pc1Zpc2libGUoKSkpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdGaWx0ZXJQaWxsczogYSBjbGljayBtYWtlcyBvbmUgYWN0aXZlIHBpbGwsIGhvdmVyIGFuZCBhcnJvdyBrZXlzIHdvcmsnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnRmlsdGVyUGlsbHMnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IHBpbGxzID0gcGFnZS5sb2NhdG9yKCd1ZS1maWx0ZXItcGlsbHMgLkZpbHRlclBpbGxzLXBpbGwnKTtcblx0XHRjb25zdCBjaGVja2VkID0gKCk6IFByb21pc2U8c3RyaW5nW10+ID0+IHBpbGxzLmxvY2F0b3IoJ3hwYXRoPXNlbGY6OipbY29udGFpbnMoQGNsYXNzLCBcImlzLWNoZWNrZWRcIildJykuYWxsVGV4dENvbnRlbnRzKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBjaGVja2VkKCksIFsnQWxsJ10pO1xuXG5cdFx0Y29uc3QgcGh5c2ljcyA9IHBpbGxzLmZpbHRlcih7IGhhc1RleHQ6IC9eUGh5c2ljcyQvIH0pO1xuXHRcdGF3YWl0IHBoeXNpY3MuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihwaHlzaWNzKSwgcmdiKCdob3ZlcicpKTtcblx0XHRhd2FpdCBwaHlzaWNzLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBjaGVja2VkKCksIFsnUGh5c2ljcyddKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihwaHlzaWNzKSwgcmdiKCdwcmltYXJ5LWhvdmVyJykpO1xuXHRcdGF3YWl0IHBhZ2UubW91c2UubW92ZSgwLCAwKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihwaHlzaWNzKSwgcmdiKCdwcmltYXJ5JykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBwaHlzaWNzLmdldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJ3VlLWZpbHRlci1waWxscyBbYXJpYS1zZWxlY3RlZD1cInRydWVcIl0nKS5jb3VudCgpLCAxKTtcblxuXHRcdGF3YWl0IGtleShwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgY2hlY2tlZCgpLCBbJ1JlbmRlcmluZyddKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0hvbWUnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IGNoZWNrZWQoKSwgWydHZW5lcmFsJ10pO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnRW5kJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBjaGVja2VkKCksIFsnQWxsJ10pO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgY2hlY2tlZCgpLCBbJ0dlbmVyYWwnXSwgJ3dyYXBzIGFyb3VuZCcpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdTZWdtZW50ZWRDb250cm9sOiBjbGljayBzZWxlY3RzLCBhcnJvd3MgbW92ZSwgaG92ZXIgZmlsbHMsIHRoZSBwaW5uZWQgcm93IGlzIHVudG91Y2hlZCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdTZWdtZW50ZWRDb250cm9sJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBncm91cCA9IHBhZ2UubG9jYXRvcigndWUtc2VnbWVudGVkLWNvbnRyb2wnKS5udGgoMCk7XG5cdFx0Y29uc3Qgc2VncyA9IGdyb3VwLmxvY2F0b3IoJy5TZWdtZW50ZWRDb250cm9sLXNlZycpO1xuXHRcdGNvbnN0IGNoZWNrZWQgPSAoKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4gZ3JvdXAubG9jYXRvcignLlNlZ21lbnRlZENvbnRyb2wtc2VnLmlzLWNoZWNrZWQnKS5hbGxUZXh0Q29udGVudHMoKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IGNoZWNrZWQoKSwgWydTdGF0aWMnXSk7XG5cblx0XHRhd2FpdCBzZWdzLm50aCgxKS5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKHNlZ3MubnRoKDEpKSwgcmdiKCdob3ZlcicpKTtcblx0XHRhd2FpdCBzZWdzLm50aCgxKS5jbGljaygpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgY2hlY2tlZCgpLCBbJ1N0YXRpb25hcnknXSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNlZ3MubnRoKDEpLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNlZ3MubnRoKDApLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICdmYWxzZScpO1xuXHRcdGF3YWl0IHBhZ2UubW91c2UubW92ZSgwLCAwKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihzZWdzLm50aCgxKSksIHJnYignZHJvcGRvd24nKSk7XG5cblx0XHRhd2FpdCBrZXkocGFnZSwgJ0Fycm93UmlnaHQnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IGNoZWNrZWQoKSwgWydNb3ZhYmxlJ10pO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgY2hlY2tlZCgpLCBbJ01vdmFibGUnXSwgJ3N0b3BzIGF0IHRoZSBlbmQnKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0hvbWUnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IGNoZWNrZWQoKSwgWydTdGF0aWMnXSk7XG5cblx0XHRjb25zdCBwaW5uZWRSb3cgPSBwYWdlLmxvY2F0b3IoJy5TZWdtZW50ZWRDb250cm9sLXJvdycpLm50aCgxKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgcGlubmVkUm93LmxvY2F0b3IoJ3hwYXRoPWFuY2VzdG9yOjp1ZS1zZWdtZW50ZWQtY29udHJvbCcpLmNvdW50KCksIDApO1xuXHRcdGF3YWl0IHBpbm5lZFJvdy5sb2NhdG9yKCcuU2VnbWVudGVkQ29udHJvbC1zZWcnKS5udGgoMCkuY2xpY2soKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHBpbm5lZFJvdy5sb2NhdG9yKCcuU2VnbWVudGVkQ29udHJvbC1zZWcuaXMtY2hlY2tlZCcpLmFsbFRleHRDb250ZW50cygpLCBbJ1N0YXRpb25hcnknXSk7XG5cblx0XHRjb25zdCBzZWNvbmQgPSBwYWdlLmxvY2F0b3IoJ3VlLXNlZ21lbnRlZC1jb250cm9sJykubnRoKDEpO1xuXHRcdGF3YWl0IHNlY29uZC5sb2NhdG9yKCcuU2VnbWVudGVkQ29udHJvbC1zZWcnKS5udGgoMikuY2xpY2soKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNlY29uZC5sb2NhdG9yKCcuU2VnbWVudGVkQ29udHJvbC1zZWcuaXMtY2hlY2tlZCcpLmFsbFRleHRDb250ZW50cygpLCBbJ01vdmFibGUnXSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBjaGVja2VkKCksIFsnU3RhdGljJ10sICdhIHNlY29uZCBpbnN0YW5jZSBpcyBpbmRlcGVuZGVudCcpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdBc3NldFBpY2tlcjogdGhlIGxpc3Qgc2V0cyB0aGUgbGFiZWwgYW5kIHRodW1ibmFpbCwgYnV0dG9ucyByZWFjdCwgcmVzZXQgcmVzdG9yZXMnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnQXNzZXRQaWNrZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IHJvb3QgPSBwYWdlLmxvY2F0b3IoJ3VlLWFzc2V0LXBpY2tlcicpO1xuXHRcdGNvbnN0IGNvbWJvID0gcm9vdC5sb2NhdG9yKCcuQXNzZXRQaWNrZXItY29tYm8nKTtcblx0XHRjb25zdCBtZW51ID0gcm9vdC5sb2NhdG9yKCcuQXNzZXRQaWNrZXItbWVudScpO1xuXHRcdGNvbnN0IGxhYmVsID0gcm9vdC5sb2NhdG9yKCcuQXNzZXRQaWNrZXItY29tYm8gLmxhYmVsJyk7XG5cdFx0Y29uc3QgcmVzZXQgPSByb290LmxvY2F0b3IoJy5Bc3NldFBpY2tlci1yZXNldCcpO1xuXHRcdGNvbnN0IHRodW1iID0gcm9vdC5sb2NhdG9yKCcuQXNzZXRQaWNrZXItdGh1bWJGcmFtZScpO1xuXHRcdGNvbnN0IG9wdGlvbiA9IChuYW1lOiBzdHJpbmcpOiBMb2NhdG9yID0+IHJvb3QubG9jYXRvcignLkFzc2V0UGlja2VyLW1lbnVJdGVtW2RhdGEtYXNzZXQ9XCInICsgbmFtZSArICdcIl0nKTtcblxuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0cmltbWVkKGxhYmVsKSwgJ1NNX0NoYWlyJyk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgbWVudS5pc1Zpc2libGUoKSkpO1xuXHRcdGF3YWl0IGNvbWJvLmhvdmVyKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBzaGFkb3dPZihjb21ibykpLmluY2x1ZGVzKHJnYignaG92ZXInKSkpO1xuXHRcdGF3YWl0IGNvbWJvLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCkpO1xuXHRcdGF3YWl0IG9wdGlvbignU01fQ291Y2gnKS5jbGljaygpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCkpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHJpbW1lZChsYWJlbCksICdTTV9Db3VjaCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0aHVtYi5nZXRBdHRyaWJ1dGUoJ3RpdGxlJyksICcvR2FtZS9Qcm9wcy9TTV9Db3VjaC5TTV9Db3VjaCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBvcHRpb24oJ1NNX0NvdWNoJykuZ2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IG9wdGlvbignU01fQ2hhaXInKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ2ZhbHNlJyk7XG5cblx0XHRhd2FpdCBjb21iby5mb2N1cygpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnQXJyb3dEb3duJyk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCkpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnQXJyb3dEb3duJyk7XG5cdFx0YXdhaXQga2V5KHBhZ2UsICdFbnRlcicpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0cmltbWVkKGxhYmVsKSwgJ1NNX0xhbXAnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYWN0aXZlQ2xhc3MocGFnZSksICdBc3NldFBpY2tlci1jb21ibycsICdmb2N1cyByZXR1cm5zIHRvIHRoZSBjb21ibycpO1xuXG5cdFx0Y29uc3QgdXNlID0gcm9vdC5sb2NhdG9yKCdbZGF0YS1yb2xlPVwidXNlXCJdJyk7XG5cdFx0YXdhaXQgdXNlLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnT2YodXNlKSwgcmdiKCdkcm9wZG93bicpKTtcblx0XHRhd2FpdCB1c2UuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHJpbW1lZChsYWJlbCksICdTTV9UYWJsZScpO1xuXG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHlPZihyZXNldCksICd2aXNpYmxlJyk7XG5cdFx0YXdhaXQgcmVzZXQuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHJpbW1lZChsYWJlbCksICdOb25lJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHlPZihyZXNldCksICdoaWRkZW4nKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdGh1bWIuZ2V0QXR0cmlidXRlKCd0aXRsZScpLCAnTm9uZScpO1xuXG5cdFx0YXdhaXQgY29tYm8uY2xpY2soKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLmNsaWNrKDkxMCwgNzEwKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBtZW51LmlzVmlzaWJsZSgpKSwgJ2FuIG91dHNpZGUgY2xpY2sgY2xvc2VzIHRoZSBsaXN0Jyk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1ZlY3RvcklucHV0OiBkcmFnZ2luZyBjaGFuZ2VzIGEgdmFsdWUgYW5kIHNob3dzIHJlc2V0LCByZXNldCByZXN0b3JlcywgdHlwaW5nIGFuZCBrZXlzIHdvcmsnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnVmVjdG9ySW5wdXQnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IHNjYWxlID0gcGFnZS5sb2NhdG9yKCd1ZS12ZWN0b3ItaW5wdXQgLlZlY3RvcklucHV0LXJvdycpLm50aCgyKTtcblx0XHRjb25zdCBmaWVsZHMgPSBzY2FsZS5sb2NhdG9yKCcuVmVjdG9ySW5wdXQtZmllbGQnKTtcblx0XHRjb25zdCByZXNldCA9IHNjYWxlLmxvY2F0b3IoJy5WZWN0b3JJbnB1dC1yZXNldCcpO1xuXHRcdGNvbnN0IHNob3duID0gKGk6IG51bWJlcik6IFByb21pc2U8c3RyaW5nPiA9PiB0cmltbWVkKGZpZWxkcy5udGgoaSkubG9jYXRvcignLlZlY3RvcklucHV0LXZhbHVlLXRleHQnKSk7XG5cblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZmllbGRzLm50aCgwKS5ldmFsdWF0ZSgoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmN1cnNvciksICdldy1yZXNpemUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdmlzaWJpbGl0eU9mKHJlc2V0KSwgJ2hpZGRlbicsICdubyByZXNldCBhdCB0aGUgZGVmYXVsdCcpO1xuXHRcdGF3YWl0IGZpZWxkcy5udGgoMCkuaG92ZXIoKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IHNoYWRvd09mKGZpZWxkcy5udGgoMCkpKS5pbmNsdWRlcyhyZ2IoJ2hvdmVyJykpKTtcblxuXHRcdGNvbnN0IHsgeCwgeSB9ID0gYXdhaXQgY2VudGVyT2YoZmllbGRzLm50aCgwKSk7XG5cdFx0YXdhaXQgcG9pbnRlclRvKHBhZ2UsIHgsIHkpO1xuXHRcdGF3YWl0IHBvaW50ZXJEb3duKHBhZ2UpO1xuXHRcdGF3YWl0IHBhZ2UubW91c2UubW92ZSh4ICsgMjAsIHksIHsgc3RlcHM6IDQgfSk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBzaGFkb3dPZihmaWVsZHMubnRoKDApKSkuaW5jbHVkZXMocmdiKCdwcmltYXJ5JykpLCAnYWN0aXZlIG91dGxpbmUgd2hpbGUgZHJhZ2dpbmcnKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoeCArIDcwLCB5LCB7IHN0ZXBzOiA4IH0pO1xuXHRcdGF3YWl0IHBvaW50ZXJVcChwYWdlKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGRhdGFWYWx1ZShmaWVsZHMubnRoKDApKSkgPiAxLjMsICdkcmFnZ2luZyByaWdodCByYWlzZWQgWDogJyArIChhd2FpdCBkYXRhVmFsdWUoZmllbGRzLm50aCgwKSkpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZGF0YVZhbHVlKGZpZWxkcy5udGgoMSkpLCAxLCAndGhlIG90aGVyIGF4ZXMgc3RheSB1bmxpbmtlZCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB2aXNpYmlsaXR5T2YocmVzZXQpLCAndmlzaWJsZScsICdyZXNldCBzaG93cyBhZnRlciBhIGNoYW5nZScpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IGZpZWxkcy5udGgoMCkuZXZhbHVhdGUoKGVsKSA9PiBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLWFjdGl2ZScpKSksICdhY3RpdmUgb3V0bGluZSBlbmRzIHdpdGggdGhlIGRyYWcnKTtcblxuXHRcdGF3YWl0IHJlc2V0LmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0cmlwbGUoZmllbGRzKSwgWzEsIDEsIDFdKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc2hvd24oMCksICcxLjAnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdmlzaWJpbGl0eU9mKHJlc2V0KSwgJ2hpZGRlbicpO1xuXG5cdFx0YXdhaXQgcG9pbnRlclRvKHBhZ2UsIHgsIHkpO1xuXHRcdGF3YWl0IHBvaW50ZXJEb3duKHBhZ2UpO1xuXHRcdGF3YWl0IHBhZ2UubW91c2UubW92ZSh4ICsgNjAsIHksIHsgc3RlcHM6IDYgfSk7XG5cdFx0YXdhaXQga2V5KHBhZ2UsICdFc2NhcGUnKTtcblx0XHRhd2FpdCBwb2ludGVyVXAocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGRhdGFWYWx1ZShmaWVsZHMubnRoKDApKSwgMSwgJ0VzY2FwZSByZXN0b3JlcyB0aGUgdmFsdWUgZnJvbSBiZWZvcmUgdGhlIGRyYWcnKTtcblxuXHRcdGF3YWl0IGZpZWxkcy5udGgoMSkuY2xpY2soKTtcblx0XHRhc3NlcnQub2soYXdhaXQgZmllbGRzLm50aCgxKS5ldmFsdWF0ZSgoZWwpID0+IGVsLmNsYXNzTGlzdC5jb250YWlucygnaXMtZWRpdGluZycpKSk7XG5cdFx0YXdhaXQgdHlwZUluKHBhZ2UsICcyLjUnKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0VudGVyJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGRhdGFWYWx1ZShmaWVsZHMubnRoKDEpKSwgMi41KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc2hvd24oMSksICcyLjUnKTtcblx0XHRhd2FpdCBmaWVsZHMubnRoKDEpLmNsaWNrKCk7XG5cdFx0YXdhaXQgdHlwZUluKHBhZ2UsICc5Jyk7XG5cdFx0YXdhaXQga2V5KHBhZ2UsICdFc2NhcGUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZGF0YVZhbHVlKGZpZWxkcy5udGgoMSkpLCAyLjUpO1xuXG5cdFx0YXdhaXQgZmllbGRzLm50aCgyKS5mb2N1cygpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnQXJyb3dVcCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBkYXRhVmFsdWUoZmllbGRzLm50aCgyKSksIDEuMDAyNSk7XG5cdFx0YXdhaXQga2V5KHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0Fycm93RG93bicpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBkYXRhVmFsdWUoZmllbGRzLm50aCgyKSksIDAuOTk3NSk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1ZlY3RvcklucHV0OiB0aGUgc2NhbGUgbG9jayBsaW5rcyB0aGUgYXhlcywgdGhlIGxhYmVsIG1lbnUgb3BlbnMsIHVuaXRzIHN1cnZpdmUgYW4gZWRpdCcsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdWZWN0b3JJbnB1dCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdFx0Y29uc3Qgcm93cyA9IHBhZ2UubG9jYXRvcigndWUtdmVjdG9yLWlucHV0IC5WZWN0b3JJbnB1dC1yb3cnKTtcblx0XHRjb25zdCBmaWVsZHMgPSByb3dzLm50aCgyKS5sb2NhdG9yKCcuVmVjdG9ySW5wdXQtZmllbGQnKTtcblx0XHRjb25zdCBsb2NrID0gcm93cy5udGgoMikubG9jYXRvcignLlZlY3RvcklucHV0LWxvY2snKTtcblxuXHRcdGF3YWl0IGxvY2suY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgbG9jay5nZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBsb2NrLmxvY2F0b3IoJ3VzZScpLmdldEF0dHJpYnV0ZSgnaHJlZicpLCAnI1ZlY3RvcklucHV0LWxvY2tlZCcpO1xuXHRcdGF3YWl0IGZpZWxkcy5udGgoMCkuY2xpY2soKTtcblx0XHRhd2FpdCB0eXBlSW4ocGFnZSwgJzInKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0VudGVyJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0cmlwbGUoZmllbGRzKSwgWzIsIDIsIDJdKTtcblxuXHRcdGF3YWl0IGZpZWxkcy5udGgoMSkuZm9jdXMoKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0Fycm93VXAnKTtcblx0XHRjb25zdCBbeCwgLCB6XSA9IGF3YWl0IHRyaXBsZShmaWVsZHMpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyh4IC0gMi4wMDI1KSA8IDFlLTYgJiYgTWF0aC5hYnMoeiAtIDIuMDAyNSkgPCAxZS02LCAnc3RlcHBpbmcgWSBtb3ZlcyBYIGFuZCBaIGJ5IHRoZSBzYW1lIHJhdGlvJyk7XG5cblx0XHRhd2FpdCBsb2NrLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGxvY2subG9jYXRvcigndXNlJykuZ2V0QXR0cmlidXRlKCdocmVmJyksICcjVmVjdG9ySW5wdXQtdW5sb2NrJyk7XG5cdFx0YXdhaXQgZmllbGRzLm50aCgwKS5jbGljaygpO1xuXHRcdGF3YWl0IHR5cGVJbihwYWdlLCAnMycpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnRW50ZXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZGF0YVZhbHVlKGZpZWxkcy5udGgoMCkpLCAzKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGRhdGFWYWx1ZShmaWVsZHMubnRoKDEpKSkgPCAzLCAndW5sb2NrZWQgYXhlcyBtb3ZlIGFsb25lJyk7XG5cblx0XHRjb25zdCBtZW51ID0gcm93cy5udGgoMCkubG9jYXRvcignLlZlY3RvcklucHV0LW1lbnUnKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBtZW51LmlzVmlzaWJsZSgpKSk7XG5cdFx0YXdhaXQgcm93cy5udGgoMCkubG9jYXRvcignLlZlY3RvcklucHV0LWNvbWJvJykuY2xpY2soKTtcblx0XHRhc3NlcnQub2soYXdhaXQgbWVudS5pc1Zpc2libGUoKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRyaW1tZWQobWVudS5sb2NhdG9yKCcuVmVjdG9ySW5wdXQtbWVudUhlYWQnKSksICdMb2NhdGlvbiBUeXBlJyk7XG5cdFx0YXdhaXQgbWVudS5sb2NhdG9yKCcuVmVjdG9ySW5wdXQtbWVudUl0ZW0nLCB7IGhhc1RleHQ6ICdXb3JsZCcgfSkuY2xpY2soKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBtZW51LmlzVmlzaWJsZSgpKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUubG9jYXRvcignLlZlY3RvcklucHV0LW1lbnVJdGVtJywgeyBoYXNUZXh0OiAnV29ybGQnIH0pLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUubG9jYXRvcignLlZlY3RvcklucHV0LW1lbnVJdGVtJywgeyBoYXNUZXh0OiAnUmVsYXRpdmUnIH0pLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICdmYWxzZScpO1xuXG5cdFx0Y29uc3QgeWF3ID0gcm93cy5udGgoMSkubG9jYXRvcignLlZlY3RvcklucHV0LWZpZWxkJykubnRoKDIpO1xuXHRcdGF3YWl0IHlhdy5jbGljaygpO1xuXHRcdGF3YWl0IHJlcGxhY2VUZXh0KHBhZ2UsICc5MCcpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnRW50ZXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdHJpbW1lZCh5YXcubG9jYXRvcignLlZlY3RvcklucHV0LXZhbHVlLXRleHQnKSksICc5MC4wIFx1MDBCMCcpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdEZXRhaWxzQ2F0ZWdvcnk6IGhlYWRlcnMgZm9sZCB0aGVpciByb3dzLCByb3cgYXJyb3dzIGZvbGQgY2hpbGRyZW4sIGNoZWNrYm94IGFuZCB0ZXh0IGVkaXQgd29yaycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgaW5QcmV2aWV3KCdEZXRhaWxzQ2F0ZWdvcnknLCBhc3luYyAocGFnZSkgPT4ge1xuXHRcdGNvbnN0IGZyYW1lID0gcGFnZS5sb2NhdG9yKCd1ZS1kZXRhaWxzLWNhdGVnb3J5JykubnRoKDApO1xuXHRcdGNvbnN0IGhlYWRlciA9IGZyYW1lLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktY2F0Um93JykubnRoKDApO1xuXHRcdGNvbnN0IHJvd09mID0gKG5hbWU6IHN0cmluZyk6IExvY2F0b3IgPT4gZnJhbWUubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1yb3cnKS5maWx0ZXIoeyBoYXM6IHBhZ2UubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1sYWJlbCcsIHsgaGFzVGV4dDogbmV3IFJlZ0V4cCgnXicgKyBuYW1lICsgJyQnKSB9KSB9KTtcblxuXHRcdGFzc2VydC5vayhhd2FpdCByb3dPZignVmlzaWJsZScpLmlzVmlzaWJsZSgpKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCByb3dPZignU3RhdGljIE1lc2gnKS5pc1Zpc2libGUoKSksICdTdGF0aWMgTWVzaCByb3dzIHN0YXJ0IGZvbGRlZCcpO1xuXHRcdGF3YWl0IGhlYWRlci5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBjb2xvck9mKGhlYWRlci5sb2NhdG9yKCcuRGV0YWlsc0NhdGVnb3J5LWFycm93JykpLCBhd2FpdCBjb21wdXRlZENvbG9yKHBhZ2UsICdjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tZm9yZWdyb3VuZC1ob3ZlcikgNjAlLCB0cmFuc3BhcmVudCknKSk7XG5cblx0XHRhd2FpdCBoZWFkZXIuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaGVhZGVyLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgaGVhZGVyLmxvY2F0b3IoJ3VzZScpLmdldEF0dHJpYnV0ZSgnaHJlZicpLCAnI0RldGFpbHNDYXRlZ29yeS1yaWdodCcpO1xuXHRcdGZvciAoY29uc3QgbmFtZSBvZiBbJ1Zpc2libGUnLCAnQWN0b3IgTGFiZWwnLCAnQ29sbGlzaW9uIFByZXNldCcsICdMaWdodGluZycsICdDYXN0IFNoYWRvdyddKSBhc3NlcnQub2soIShhd2FpdCByb3dPZihuYW1lKS5pc1Zpc2libGUoKSksIG5hbWUgKyAnIGZvbGRlZCcpO1xuXHRcdGF3YWl0IGhlYWRlci5wcmVzcygnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBoZWFkZXIubG9jYXRvcigndXNlJykuZ2V0QXR0cmlidXRlKCdocmVmJyksICcjRGV0YWlsc0NhdGVnb3J5LWRvd24nKTtcblx0XHRhc3NlcnQub2soYXdhaXQgcm93T2YoJ1Zpc2libGUnKS5pc1Zpc2libGUoKSk7XG5cdFx0YXdhaXQgaGVhZGVyLnByZXNzKCdFbnRlcicpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IHJvd09mKCdWaXNpYmxlJykuaXNWaXNpYmxlKCkpLCAnRW50ZXIgZm9sZHMnKTtcblx0XHRhd2FpdCBoZWFkZXIucHJlc3MoJ1NwYWNlJyk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHJvd09mKCdWaXNpYmxlJykuaXNWaXNpYmxlKCksICdTcGFjZSB1bmZvbGRzJyk7XG5cblx0XHRjb25zdCBhcnJvdyA9IHJvd09mKCdMaWdodGluZycpLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktcm93QXJyb3cnKTtcblx0XHRhc3NlcnQub2soYXdhaXQgcm93T2YoJ0Nhc3QgU2hhZG93JykuaXNWaXNpYmxlKCkpO1xuXHRcdGF3YWl0IGFycm93LmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgcm93T2YoJ0Nhc3QgU2hhZG93JykuaXNWaXNpYmxlKCkpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYXJyb3cuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICdmYWxzZScpO1xuXHRcdGF3YWl0IGFycm93LmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHJvd09mKCdDYXN0IFNoYWRvdycpLmlzVmlzaWJsZSgpKTtcblxuXHRcdGNvbnN0IG5hbWUgPSByb3dPZignVmlzaWJsZScpLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktbmFtZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZ09mKG5hbWUpLCByZ2IoJ3BhbmVsJykpO1xuXHRcdGF3YWl0IG5hbWUuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmdPZihuYW1lKSwgcmdiKCdoZWFkZXInKSk7XG5cblx0XHRjb25zdCBjaGVjayA9IHJvd09mKCdWaXNpYmxlJykubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1jaGVjaycpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBjaGVjay5nZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcpLCAndHJ1ZScpO1xuXHRcdGF3YWl0IGNoZWNrLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGNoZWNrLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICdmYWxzZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB2aXNpYmlsaXR5T2YoY2hlY2subG9jYXRvcignc3ZnJykpLCAnaGlkZGVuJyk7XG5cdFx0YXdhaXQgY2hlY2sucHJlc3MoJ1NwYWNlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGNoZWNrLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICd0cnVlJyk7XG5cblx0XHRjb25zdCBmaWVsZCA9IHJvd09mKCdBY3RvciBMYWJlbCcpLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktdGV4dCcpO1xuXHRcdGNvbnN0IHJlc2V0ID0gcm93T2YoJ0FjdG9yIExhYmVsJykubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1yZXNldCcpO1xuXHRcdGF3YWl0IGZpZWxkLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBzaGFkb3dPZihmaWVsZCkpLmluY2x1ZGVzKHJnYigncHJpbWFyeScpKSk7XG5cdFx0YXdhaXQgcmVwbGFjZVRleHQocGFnZSwgJ1RhYmxlJyk7XG5cdFx0YXdhaXQga2V5KHBhZ2UsICdFbnRlcicpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0cmltbWVkKGZpZWxkKSwgJ1RhYmxlJyk7XG5cdFx0YXdhaXQgZmllbGQuY2xpY2soKTtcblx0XHRhd2FpdCByZXBsYWNlVGV4dChwYWdlLCAnSnVuaycpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnRXNjYXBlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRyaW1tZWQoZmllbGQpLCAnVGFibGUnKTtcblx0XHRhd2FpdCByZXNldC5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0cmltbWVkKGZpZWxkKSwgJ1N0YXRpY01lc2hBY3Rvcl8wJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHlPZihyZXNldCksICdoaWRkZW4nKTtcblxuXHRcdGFzc2VydC5vayghKGF3YWl0IHJvd09mKCdSZW5kZXIgaW4gTWFpbiBQYXNzJykuaXNWaXNpYmxlKCkpKTtcblx0XHRhd2FpdCBmcmFtZS5sb2NhdG9yKCcuRGV0YWlsc0NhdGVnb3J5LWFkdlJvdycpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHJvd09mKCdSZW5kZXIgaW4gTWFpbiBQYXNzJykuaXNWaXNpYmxlKCkpO1xuXHRcdGF3YWl0IGZyYW1lLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktY2F0Um93JykubnRoKDEpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IGZyYW1lLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktcm93JywgeyBoYXNUZXh0OiAnU01fQ2hhaXInIH0pLmlzVmlzaWJsZSgpKTtcblxuXHRcdGNvbnN0IHBpbm5lZCA9IHBhZ2UubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1mcmFtZScpLmxhc3QoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgcGlubmVkLmxvY2F0b3IoJ3hwYXRoPWFuY2VzdG9yOjp1ZS1kZXRhaWxzLWNhdGVnb3J5JykuY291bnQoKSwgMCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHBpbm5lZC5sb2NhdG9yKCcuRGV0YWlsc0NhdGVnb3J5LXJvdy5pcy1ob3ZlcicpLmlzVmlzaWJsZSgpKTtcblx0fSk7XG59KTtcblxudGVzdCgnRGV0YWlsc0NhdGVnb3J5OiB0aGUgbGl2ZSBkZXRhaWxzIHBhbmVsIGZpbHRlcnMgcm93cyBieSBzZWFyY2ggYW5kIHNlY3Rpb24nLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IGluUHJldmlldygnRGV0YWlsc0NhdGVnb3J5JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRjb25zdCBwYW5lbCA9IHBhZ2UubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1wYW5lbCcpO1xuXHRcdGNvbnN0IGlucHV0ID0gcGFuZWwubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1zcklucHV0Jyk7XG5cdFx0Y29uc3Qgc2hvd24gPSAoKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4gcGFuZWwubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1yb3cnKS5ldmFsdWF0ZUFsbCgocm93cykgPT4gcm93cy5maWx0ZXIoKHJvdykgPT4gKHJvdyBhcyBIVE1MRWxlbWVudCkub2Zmc2V0UGFyZW50ICE9PSBudWxsKS5tYXAoKHJvdykgPT4gKHJvdy5xdWVyeVNlbGVjdG9yKCcuRGV0YWlsc0NhdGVnb3J5LWxhYmVsJyk/LnRleHRDb250ZW50ID8/ICcnKS50cmltKCkpKTtcblx0XHRjb25zdCBjYXRzID0gKCk6IFByb21pc2U8c3RyaW5nW10+ID0+IHBhbmVsLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktY2F0JykuZXZhbHVhdGVBbGwoKGVscykgPT4gZWxzLmZpbHRlcigoZWwpID0+IChlbCBhcyBIVE1MRWxlbWVudCkub2Zmc2V0UGFyZW50ICE9PSBudWxsKS5tYXAoKGVsKSA9PiAoZWwucXVlcnlTZWxlY3RvcignLkRldGFpbHNDYXRlZ29yeS10aXRsZScpPy50ZXh0Q29udGVudCA/PyAnJykudHJpbSgpKSk7XG5cdFx0Y29uc3QgcGlsbCA9IChsYWJlbDogc3RyaW5nKTogTG9jYXRvciA9PiBwYW5lbC5sb2NhdG9yKCcuRGV0YWlsc0NhdGVnb3J5LXBpbGwnLCB7IGhhc1RleHQ6IG5ldyBSZWdFeHAoJ14nICsgbGFiZWwgKyAnJCcpIH0pO1xuXHRcdGNvbnN0IG9wdGlvbiA9IGFzeW5jIChuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcblx0XHRcdGF3YWl0IHBhbmVsLmxvY2F0b3IoJ1tkYXRhLXJvbGU9XCJvcHRpb25zXCJdJykuY2xpY2soKTtcblx0XHRcdGF3YWl0IHBhbmVsLmxvY2F0b3IoJ1tkYXRhLW9wdGlvbj1cIicgKyBuYW1lICsgJ1wiXScpLmNsaWNrKCk7XG5cdFx0fTtcblxuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgY2F0cygpLCBbJ0dlbmVyYWwnLCAnUmVuZGVyaW5nJ10pO1xuXHRcdGFzc2VydC5lcXVhbCgoYXdhaXQgc2hvd24oKSkubGVuZ3RoLCA3KTtcblxuXHRcdGF3YWl0IGlucHV0LmNsaWNrKCk7XG5cdFx0YXdhaXQgdHlwZUluKHBhZ2UsICdzaGFkb3cnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNob3duKCksIFsnTGlnaHRpbmcnLCAnQ2FzdCBTaGFkb3cnXSwgJ3RoZSBwYXJlbnQgcm93IHN0YXlzIHdpdGggaXRzIG1hdGNoaW5nIGNoaWxkJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBjYXRzKCksIFsnUmVuZGVyaW5nJ10sICdhIGNhdGVnb3J5IHdpdGggbm8gbWF0Y2ggaGlkZXMnKTtcblx0XHRhc3NlcnQub2soYXdhaXQgcGFuZWwubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1zckNsZWFyJykuaXNWaXNpYmxlKCkpO1xuXHRcdGF3YWl0IGtleShwYWdlLCAnRXNjYXBlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGlucHV0LmlucHV0VmFsdWUoKSwgJycpO1xuXHRcdGFzc2VydC5lcXVhbCgoYXdhaXQgc2hvd24oKSkubGVuZ3RoLCA3KTtcblxuXHRcdGF3YWl0IHR5cGVJbihwYWdlLCAnenp6Jyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBzaG93bigpLCBbXSk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHBhbmVsLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktZW1wdHknKS5pc1Zpc2libGUoKSwgJ2VtcHR5IG1lc3NhZ2UnKTtcblx0XHRhd2FpdCBwYW5lbC5sb2NhdG9yKCcuRGV0YWlsc0NhdGVnb3J5LXNyQ2xlYXInKS5jbGljaygpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IHBhbmVsLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktZW1wdHknKS5pc1Zpc2libGUoKSkpO1xuXG5cdFx0YXdhaXQgcGlsbCgnR2VuZXJhbCcpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBjYXRzKCksIFsnR2VuZXJhbCddKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFuZWwubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1waWxsLmlzLWNoZWNrZWQnKS5jb3VudCgpLCAxKTtcblx0XHRhd2FpdCBwaWxsKCdQaHlzaWNzJykuY2xpY2soKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IGNhdHMoKSwgW10pO1xuXHRcdGFzc2VydC5vayhhd2FpdCBwYW5lbC5sb2NhdG9yKCcuRGV0YWlsc0NhdGVnb3J5LWVtcHR5JykuaXNWaXNpYmxlKCkpO1xuXHRcdGF3YWl0IHBpbGwoJ1JlbmRlcmluZycpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBjYXRzKCksIFsnUmVuZGVyaW5nJ10pO1xuXHRcdGF3YWl0IGlucHV0LmNsaWNrKCk7XG5cdFx0YXdhaXQgdHlwZUluKHBhZ2UsICd0YWdzJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBzaG93bigpLCBbXSwgJ3NlYXJjaCBhbmQgc2VjdGlvbiBjb21iaW5lJyk7XG5cdFx0YXdhaXQgcGFuZWwubG9jYXRvcignLkRldGFpbHNDYXRlZ29yeS1zckNsZWFyJykuY2xpY2soKTtcblx0XHRhd2FpdCBwaWxsKCdBbGwnKS5jbGljaygpO1xuXG5cdFx0YXdhaXQgb3B0aW9uKCdjb2xsYXBzZUFsbCcpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgc2hvd24oKSwgW10pO1xuXHRcdGF3YWl0IG9wdGlvbignZXhwYW5kQWxsJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKChhd2FpdCBzaG93bigpKS5sZW5ndGgsIDcpO1xuXHRcdGF3YWl0IG9wdGlvbignbW9kaWZpZWQnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNob3duKCksIFsnQWN0b3IgTGFiZWwnLCAnVGFncyddLCAnb25seSByb3dzIHdpdGggYSByZXNldCBhcnJvdycpO1xuXHRcdGF3YWl0IG9wdGlvbignbW9kaWZpZWQnKTtcblx0XHRhc3NlcnQuZXF1YWwoKGF3YWl0IHNob3duKCkpLmxlbmd0aCwgNyk7XG5cblx0XHRjb25zdCBzdGFyID0gcGFuZWwubG9jYXRvcignW2RhdGEtcm9sZT1cImZhdm9yaXRlc1wiXScpO1xuXHRcdGF3YWl0IHN0YXIuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3Rhci5nZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcpLCAndHJ1ZScpO1xuXHRcdGNvbnN0IGxvY2sgPSBwYW5lbC5sb2NhdG9yKCdbZGF0YS1yb2xlPVwibG9ja1wiXScpO1xuXHRcdGF3YWl0IGxvY2suY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgbG9jay5sb2NhdG9yKCd1c2UnKS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyNEZXRhaWxzQ2F0ZWdvcnktbG9ja2VkJyk7XG5cdFx0Y29uc3QgbmFtZSA9IHBhbmVsLmxvY2F0b3IoJy5EZXRhaWxzQ2F0ZWdvcnktaGRyTmFtZScpO1xuXHRcdGF3YWl0IG5hbWUuY2xpY2soKTtcblx0XHRhd2FpdCByZXBsYWNlVGV4dChwYWdlLCAnQmVuY2gnKTtcblx0XHRhd2FpdCBrZXkocGFnZSwgJ0VudGVyJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRyaW1tZWQobmFtZSksICdCZW5jaCcpO1xuXHR9KTtcbn0pO1xuXG5mb3IgKGNvbnN0IG5hbWUgb2YgWydEZXRhaWxzSGVhZGVyJywgJ0RldGFpbHNTZWFyY2hSb3cnLCAnRmlsdGVyUGlsbHMnLCAnRGV0YWlsc0NhdGVnb3J5JywgJ1ZlY3RvcklucHV0JywgJ1NlZ21lbnRlZENvbnRyb2wnLCAnQXNzZXRQaWNrZXInXSkge1xuXHR0ZXN0KG5hbWUgKyAnOiBubyBzY3JpcHQgdGFncywgY2FwdGlvbnMgcHJlc2VudCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBpblByZXZpZXcobmFtZSwgYXN5bmMgKHBhZ2UpID0+IHtcblx0XHRcdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJ3NjcmlwdDpub3QoW3NyY10pJykuY291bnQoKSwgMCwgJ2lubGluZSBzY3JpcHQnKTtcblx0XHRcdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJ3NjcmlwdDpub3QoW3NyYyQ9XCJidW5kbGUuanNcIl0pJykuY291bnQoKSwgMCwgJ3NjcmlwdCB0YWcnKTtcblx0XHRcdGFzc2VydC5vaygoYXdhaXQgcGFnZS5sb2NhdG9yKCdbY2xhc3MqPVwiLWNhcFwiXScpLmNvdW50KCkpID49IDEsICdjYXB0aW9ucycpO1xuXHRcdH0pO1xuXHR9KTtcbn1cbiIsICIvLy8gPHJlZmVyZW5jZSBsaWI9XCJkb21cIiAvPlxuLy8gSGVscGVycyBmb3IgdGhlIGludGVyYWN0aW9uIHRlc3RzIG9mIHRyZWUtbGlrZSBhbmQgc2Nyb2xsaW5nIHByZXZpZXdzLlxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydC9zdHJpY3QnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgb3BlblByZXZpZXcsIHdpdGhCcm93c2VyLCByb290IH0gZnJvbSAnLi9saWIudHMnO1xuXG5pbnRlcmZhY2UgVG9rZW5GaWxlIHtcblx0Y29sb3I6IHsgdGhlbWVzOiBBcnJheTx7IGlkOiBzdHJpbmcgfT47IHRva2VuczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0+IH07XG59XG5cbi8vIFRoZSBjb21wdXRlZCBjb2xvdXIgYSB0b2tlbiBwYWludHMsIHdyaXR0ZW4gdGhlIHdheSB0aGUgYnJvd3NlciByZXBvcnRzIGl0LlxuZXhwb3J0IGZ1bmN0aW9uIHJnYih0b2tlbjogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3QgZmlsZSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyb290LCAndG9rZW5zLmpzb24nKSwgJ3V0ZjgnKSkgYXMgVG9rZW5GaWxlO1xuXHRjb25zdCB0aGVtZSA9IGZpbGUuY29sb3IudGhlbWVzWzBdLmlkO1xuXHRsZXQgbmFtZSA9IHRva2VuO1xuXHRmb3IgKGxldCBob3BzID0gMDsgaG9wcyA8IDg7IGhvcHMrKykge1xuXHRcdGNvbnN0IGVudHJ5ID0gZmlsZS5jb2xvci50b2tlbnMuZmluZCgodCkgPT4gdC5uYW1lID09PSBuYW1lKTtcblx0XHRhc3NlcnQub2soZW50cnksICd0b2tlbiAnICsgbmFtZSk7XG5cdFx0Y29uc3QgcmF3ID0gdHlwZW9mIGVudHJ5LnZhbHVlID09PSAnc3RyaW5nJyA/IGVudHJ5LnZhbHVlIDogZW50cnkudmFsdWVbdGhlbWVdO1xuXHRcdGNvbnN0IGFsaWFzID0gL15cXHsoLispXFx9JC8uZXhlYyhyYXcpO1xuXHRcdGlmIChhbGlhcykge1xuXHRcdFx0bmFtZSA9IGFsaWFzWzFdO1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXHRcdGNvbnN0IGhleCA9IC9eIyhbMC05YS1mXXs2fSkkL2kuZXhlYyhyYXcpO1xuXHRcdGFzc2VydC5vayhoZXgsICdzaXggZGlnaXQgaGV4IGZvciAnICsgbmFtZSk7XG5cdFx0Y29uc3QgbiA9IHBhcnNlSW50KGhleFsxXSwgMTYpO1xuXHRcdHJldHVybiAncmdiKCcgKyAobiA+PiAxNikgKyAnLCAnICsgKChuID4+IDgpICYgMjU1KSArICcsICcgKyAobiAmIDI1NSkgKyAnKSc7XG5cdH1cblx0dGhyb3cgbmV3IEVycm9yKCdhbGlhcyBsb29wIGZvciAnICsgdG9rZW4pO1xufVxuXG4vLyBPcGVucyBhIHByZXZpZXcsIHJ1bnMgdGhlIGJvZHksIHRoZW4gcmVxdWlyZXMgYSBjbGVhbiBjb25zb2xlLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGluUHJldmlldyhuYW1lOiBzdHJpbmcsIGJvZHk6IChwYWdlOiBQYWdlKSA9PiBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsIG5hbWUpO1xuXHRcdGF3YWl0IGJvZHkocGFnZSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGVycm9ycy5sZW5ndGgsIDAsICdwYWdlIGVycm9yczogJyArIGVycm9ycy5qb2luKCcgfCAnKSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGNvbnN0IGJnT2YgPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmJhY2tncm91bmRDb2xvcik7XG5leHBvcnQgY29uc3QgY29sb3JPZiA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuY29sb3IpO1xuZXhwb3J0IGNvbnN0IGNsYXNzZXMgPSBhc3luYyAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4gKChhd2FpdCB0YXJnZXQuZ2V0QXR0cmlidXRlKCdjbGFzcycpKSA/PyAnJykuc3BsaXQoL1xccysvKTtcbmV4cG9ydCBjb25zdCB3aWR0aE9mID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8bnVtYmVyPiA9PiB0YXJnZXQuZXZhbHVhdGUoKGVsKSA9PiBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aCk7XG5leHBvcnQgY29uc3Qgc2V0dGxlID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2Uud2FpdEZvclRpbWVvdXQoODApO1xuLy8gTW92ZXMgdGhlIHBvaW50ZXIgdG8gdGhlIGVtcHR5IHBhZ2UgbWFyZ2luLCB3aGljaCB0YWtlcyB0aGUgaG92ZXIgb2ZmIGFueSByb3cuXG5leHBvcnQgY29uc3QgcGFya1BvaW50ZXIgPSAocGFnZTogUGFnZSk6IFByb21pc2U8dm9pZD4gPT4gcGFnZS5tb3VzZS5tb3ZlKDIsIDIpO1xuXG5leHBvcnQgY29uc3Qgc2hvd24gPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxib29sZWFuPiA9PiB0YXJnZXQuaXNWaXNpYmxlKCk7XG5leHBvcnQgaW50ZXJmYWNlIEJveCB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9XG4vLyBUaGUgbWlkZGxlIHBvaW50IG9mIGEgYm91bmRpbmcgYm94LlxuZXhwb3J0IGNvbnN0IGNlbnRyZSA9IChiOiBCb3ggfCBudWxsKTogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9ID0+IHtcblx0YXNzZXJ0Lm9rKGIsICdib3VuZGluZyBib3gnKTtcblx0cmV0dXJuIHsgeDogYi54ICsgYi53aWR0aCAvIDIsIHk6IGIueSArIGIuaGVpZ2h0IC8gMiB9O1xufTtcbmV4cG9ydCBjb25zdCBjbGlja0JsYW5rID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuY2xpY2soMiwgMik7XG5leHBvcnQgY29uc3Qga2V5cyA9IChwYWdlOiBQYWdlLCAuLi5rZXlzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4gPT4ga2V5cy5yZWR1Y2UoKGNoYWluLCBrZXkpID0+IGNoYWluLnRoZW4oKCkgPT4gcGFnZS5rZXlib2FyZC5wcmVzcyhrZXkpKSwgUHJvbWlzZS5yZXNvbHZlKCkpO1xuZXhwb3J0IGNvbnN0IG1vdmVQb2ludGVyID0gKHBhZ2U6IFBhZ2UsIHg6IG51bWJlciwgeTogbnVtYmVyLCBzdGVwcyA9IDEpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UubW92ZSh4LCB5LCB7IHN0ZXBzIH0pO1xuZXhwb3J0IGNvbnN0IGhvbGRQb2ludGVyID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuZG93bigpO1xuZXhwb3J0IGNvbnN0IHJlbGVhc2VQb2ludGVyID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UudXAoKTtcbmV4cG9ydCBjb25zdCBzcGluID0gKHBhZ2U6IFBhZ2UsIGR4OiBudW1iZXIsIGR5OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2Uud2hlZWwoZHgsIGR5KTtcblxuZnVuY3Rpb24gZXNjYXBlUmVnRXhwKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB0ZXh0LnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyk7XG59XG5cbi8vIFRoZSByb3cgaW5zaWRlIGBzY29wZWAgd2hvc2UgbGFiZWwgdGV4dCBpcyBleGFjdGx5IGBsYWJlbGAuXG5leHBvcnQgZnVuY3Rpb24gcm93SW4ocGFnZTogUGFnZSwgc2NvcGU6IHN0cmluZywgcm93Q2xhc3M6IHN0cmluZywgdGV4dENsYXNzOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcpOiBMb2NhdG9yIHtcblx0cmV0dXJuIHBhZ2UubG9jYXRvcihzY29wZSArICcgJyArIHJvd0NsYXNzKS5maWx0ZXIoeyBoYXM6IHBhZ2UubG9jYXRvcih0ZXh0Q2xhc3MsIHsgaGFzVGV4dDogbmV3IFJlZ0V4cCgnXicgKyBlc2NhcGVSZWdFeHAobGFiZWwpICsgJyQnKSB9KSB9KTtcbn1cblxuZXhwb3J0IGNvbnN0IHZpc2libGVMYWJlbHMgPSAocGFnZTogUGFnZSwgc2NvcGU6IHN0cmluZywgcm93Q2xhc3M6IHN0cmluZywgdGV4dENsYXNzOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiA9PlxuXHRwYWdlLiQkZXZhbChzY29wZSArICcgJyArIHJvd0NsYXNzICsgJzpub3QoW2hpZGRlbl0pICcgKyB0ZXh0Q2xhc3MsIChlbHMpID0+IGVscy5tYXAoKGVsKSA9PiBlbC50ZXh0Q29udGVudCA/PyAnJykpO1xuIiwgIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBTaGFyZWQgaGVscGVycyBmb3IgdGhlIHByZXZpZXcgaW50ZXJhY3Rpb24gdGVzdHMuIFRoZSBET00gbGliIHR5cGVzIHRoZSBjYWxsYmFja3MgdGhhdCBydW4gaW4gdGhlIHBhZ2UuXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgaHR0cCBmcm9tICdub2RlOmh0dHAnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgeyBjaHJvbWl1bSwgdHlwZSBCcm93c2VyLCB0eXBlIFBhZ2UgfSBmcm9tICdwbGF5d3JpZ2h0JztcblxuY29uc3QgaGVyZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpO1xuZXhwb3J0IGNvbnN0IHJvb3QgPSBwYXRoLnJlc29sdmUoaGVyZSwgJy4uJywgJ2Rlc2lnbi1zeXN0ZW0nKTtcblxuaW50ZXJmYWNlIFRva2VuVmFsdWUgeyBbdGhlbWU6IHN0cmluZ106IHN0cmluZyB9XG5pbnRlcmZhY2UgVG9rZW5zIHtcblx0Y29sb3I6IHsgdGhlbWVzOiBBcnJheTx7IGlkOiBzdHJpbmcgfT47IHRva2VuczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfCBUb2tlblZhbHVlIH0+IH07XG5cdHNwYWNpbmc6IHsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9PiB9O1xuXHRyYWRpdXM6IHsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9PiB9O1xuXHR0eXBlOiB7IGZhbWlsaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH07XG59XG5cbi8vIEJ1aWxkcyB0aGUgdG9rZW5zLmNzcyB0aGF0IHRoZSBwcmV2aWV3IGZyYW1lIHByZWxvYWRzLCBmcm9tIHRva2Vucy5qc29uIChmaXJzdCB0aGVtZSkuXG5leHBvcnQgZnVuY3Rpb24gdG9rZW5zQ3NzKCk6IHN0cmluZyB7XG5cdGNvbnN0IHRva2VucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyb290LCAndG9rZW5zLmpzb24nKSwgJ3V0ZjgnKSkgYXMgVG9rZW5zO1xuXHRjb25zdCB0aGVtZSA9IHRva2Vucy5jb2xvci50aGVtZXNbMF0uaWQ7XG5cdGNvbnN0IHZhcnM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0IHJlc29sdmUgPSAodmFsdWU6IHN0cmluZyB8IFRva2VuVmFsdWUpOiBzdHJpbmcgPT4ge1xuXHRcdGNvbnN0IHJhdyA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyB2YWx1ZSA6IHZhbHVlW3RoZW1lXTtcblx0XHRjb25zdCBhbGlhcyA9IC9eXFx7KC4rKVxcfSQvLmV4ZWMocmF3KTtcblx0XHRyZXR1cm4gYWxpYXMgPyAndmFyKC0tJyArIGFsaWFzWzFdICsgJyknIDogcmF3O1xuXHR9O1xuXHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zLmNvbG9yLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgcmVzb2x2ZSh0LnZhbHVlKSArICc7Jyk7XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMuc3BhY2luZy50b2tlbnMpIHZhcnMucHVzaCgnLS0nICsgdC5uYW1lICsgJzogJyArIHQudmFsdWUgKyAnOycpO1xuXHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zLnJhZGl1cy50b2tlbnMpIHZhcnMucHVzaCgnLS0nICsgdC5uYW1lICsgJzogJyArIHQudmFsdWUgKyAnOycpO1xuXHRmb3IgKGNvbnN0IFtrZXksIHN0YWNrXSBvZiBPYmplY3QuZW50cmllcyh0b2tlbnMudHlwZS5mYW1pbGllcykpIHZhcnMucHVzaCgnLS1mb250LScgKyBrZXkgKyAnOiAnICsgc3RhY2sgKyAnOycpO1xuXHRyZXR1cm4gJzpyb290IHsgJyArIHZhcnMuam9pbignICcpICsgJyB9XFxuYm9keSB7IGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQpOyBjb2xvcjogdmFyKC0tZm9yZWdyb3VuZCk7IH0nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXcge1xuXHRwYWdlOiBQYWdlO1xuXHRlcnJvcnM6IHN0cmluZ1tdO1xufVxuXG5jb25zdCBNSU1FOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuXHQnLmh0bWwnOiAndGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04Jyxcblx0Jy5qcyc6ICd0ZXh0L2phdmFzY3JpcHQ7IGNoYXJzZXQ9dXRmLTgnLFxuXHQnLmNzcyc6ICd0ZXh0L2NzczsgY2hhcnNldD11dGYtOCcsXG5cdCcuanNvbic6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0Jy5wbmcnOiAnaW1hZ2UvcG5nJyxcblx0Jy5zdmcnOiAnaW1hZ2Uvc3ZnK3htbCcsXG59O1xuXG5sZXQgYmFzZVVybDogUHJvbWlzZTxzdHJpbmc+IHwgdW5kZWZpbmVkO1xuXG4vLyBTZXJ2ZXMgZGVzaWduLXN5c3RlbSBvdmVyIGh0dHAsIGJlY2F1c2UgQ2hyb21pdW0gYmxvY2tzIG1vZHVsZSBzY3JpcHRzIG9uIGZpbGU6Ly8uIE9uZSBzZXJ2ZXIgcGVyIHByb2Nlc3MuXG5leHBvcnQgZnVuY3Rpb24gc2VydmUoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0YmFzZVVybCA/Pz0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKChyZXEsIHJlcykgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZSA9IHBhdGguam9pbihyb290LCBkZWNvZGVVUklDb21wb25lbnQobmV3IFVSTChyZXEudXJsID8/ICcvJywgJ2h0dHA6Ly94JykucGF0aG5hbWUpKTtcblx0XHRcdGlmICghZmlsZS5zdGFydHNXaXRoKHJvb3QpIHx8ICFmcy5leGlzdHNTeW5jKGZpbGUpIHx8IGZzLnN0YXRTeW5jKGZpbGUpLmlzRGlyZWN0b3J5KCkpIHtcblx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDQpLmVuZCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXMud3JpdGVIZWFkKDIwMCwgeyAnY29udGVudC10eXBlJzogTUlNRVtwYXRoLmV4dG5hbWUoZmlsZSldID8/ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nIH0pO1xuXHRcdFx0ZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlKS5waXBlKHJlcyk7XG5cdFx0fSk7XG5cdFx0c2VydmVyLm9uKCdlcnJvcicsIHJlamVjdCk7XG5cdFx0c2VydmVyLmxpc3RlbigwLCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuXHRcdFx0c2VydmVyLnVucmVmKCk7XG5cdFx0XHRjb25zdCBhZGRyZXNzID0gc2VydmVyLmFkZHJlc3MoKTtcblx0XHRcdHJlc29sdmUoJ2h0dHA6Ly8xMjcuMC4wLjE6JyArICh0eXBlb2YgYWRkcmVzcyA9PT0gJ29iamVjdCcgJiYgYWRkcmVzcyA/IGFkZHJlc3MucG9ydCA6IDApKTtcblx0XHR9KTtcblx0fSk7XG5cdHJldHVybiBiYXNlVXJsO1xufVxuXG4vLyBUaGUgZGVzaWduIHN5c3RlbSBwYWdlIHByZWxvYWRzIGNvbXBvbmVudHMvYnVuZGxlLmpzIGFzIGEgY2xhc3NpYyBzY3JpcHQgYWhlYWQgb2YgdGhlIHByZXZpZXcgbWFya3VwLiBUZXN0cyBkbyB0aGUgc2FtZS5cbmV4cG9ydCBjb25zdCB3aXRoQnVuZGxlID0gKGh0bWw6IHN0cmluZyk6IHN0cmluZyA9PiBodG1sLnJlcGxhY2UoJzwvaGVhZD4nLCAnPHNjcmlwdCBzcmM9XCIvY29tcG9uZW50cy9idW5kbGUuanNcIj48L3NjcmlwdD48L2hlYWQ+Jyk7XG5cbi8vIE9wZW5zIGEgY29tcG9uZW50IHByZXZpZXcgd2l0aCB0aGUgdG9rZW5zIGluamVjdGVkLiBDb25zb2xlIGFuZCBwYWdlIGVycm9ycyBjb2xsZWN0IGluIGBlcnJvcnNgLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5QcmV2aWV3KGJyb3dzZXI6IEJyb3dzZXIsIG5hbWU6IHN0cmluZywgdmlld3BvcnQgPSB7IHdpZHRoOiAxMDAwLCBoZWlnaHQ6IDgwMCB9KTogUHJvbWlzZTxQcmV2aWV3PiB7XG5cdGNvbnN0IHBhZ2UgPSBhd2FpdCBicm93c2VyLm5ld1BhZ2UoeyB2aWV3cG9ydCB9KTtcblx0Y29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXHRwYWdlLm9uKCdwYWdlZXJyb3InLCAoZSkgPT4gZXJyb3JzLnB1c2goU3RyaW5nKGUpKSk7XG5cdHBhZ2Uub24oJ2NvbnNvbGUnLCAobSkgPT4ge1xuXHRcdGlmIChtLnR5cGUoKSA9PT0gJ2Vycm9yJyAmJiAhL2ZvbnRzXFwuZ3xFUlJffEZhaWxlZCB0byBsb2FkIHJlc291cmNlLy50ZXN0KG0udGV4dCgpKSkgZXJyb3JzLnB1c2gobS50ZXh0KCkpO1xuXHR9KTtcblx0YXdhaXQgcGFnZS5yb3V0ZSgnKiovY29tcG9uZW50cy8qL3ByZXZpZXcuaHRtbCcsIGFzeW5jIChyb3V0ZSkgPT4ge1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGUuZmV0Y2goKTtcblx0XHRhd2FpdCByb3V0ZS5mdWxmaWxsKHsgcmVzcG9uc2UsIGJvZHk6IHdpdGhCdW5kbGUoYXdhaXQgcmVzcG9uc2UudGV4dCgpKSB9KTtcblx0fSk7XG5cdGF3YWl0IHBhZ2UuZ290bygoYXdhaXQgc2VydmUoKSkgKyAnL2NvbXBvbmVudHMvJyArIG5hbWUgKyAnL3ByZXZpZXcuaHRtbCcpO1xuXHRhd2FpdCBwYWdlLmFkZFN0eWxlVGFnKHsgY29udGVudDogdG9rZW5zQ3NzKCkgfSk7XG5cdGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTAwKTtcblx0cmV0dXJuIHsgcGFnZSwgZXJyb3JzIH07XG59XG5cbi8vIFJ1bnMgYSB0ZXN0IGJvZHkgd2l0aCBhIGZyZXNoIGJyb3dzZXIgYW5kIGFsd2F5cyBjbG9zZXMgaXQuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aEJyb3dzZXIoYm9keTogKGJyb3dzZXI6IEJyb3dzZXIpID0+IFByb21pc2U8dm9pZD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgYnJvd3NlciA9IGF3YWl0IGNocm9taXVtLmxhdW5jaCgpO1xuXHR0cnkge1xuXHRcdGF3YWl0IGJvZHkoYnJvd3Nlcik7XG5cdH0gZmluYWxseSB7XG5cdFx0YXdhaXQgYnJvd3Nlci5jbG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBiYWNrZ3JvdW5kID0gKHBhZ2U6IFBhZ2UsIHNlbGVjdG9yOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4gcGFnZS4kZXZhbChzZWxlY3RvciwgKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5iYWNrZ3JvdW5kQ29sb3IpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLE9BQU9BLGFBQVk7QUFDbkIsU0FBUyxZQUFZOzs7QUNEckIsT0FBTyxZQUFZO0FBQ25CLE9BQU9DLFNBQVE7QUFDZixPQUFPQyxXQUFVOzs7QUNGakIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUF5QztBQUVsRCxJQUFNLE9BQU8sS0FBSyxRQUFRLGNBQWMsWUFBWSxHQUFHLENBQUM7QUFDakQsSUFBTSxPQUFPLEtBQUssUUFBUSxNQUFNLE1BQU0sZUFBZTtBQVdyRCxTQUFTLFlBQW9CO0FBQ25D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QVEseUJBQXlCO0FBQ3BELFVBQU0sS0FBSyxNQUFNO0FBQ2pCLElBQUFBLFFBQU8sTUFBTSxNQUFNLEtBQUssYUFBYSxjQUFjLEdBQUcsTUFBTTtBQUM1RCxVQUFNLE9BQU8sTUFBTSxRQUFRLG9CQUFvQjtBQUMvQyxVQUFNLEtBQUssTUFBTTtBQUNqQixJQUFBQSxRQUFPLE1BQU0sTUFBTSxLQUFLLFFBQVEsS0FBSyxFQUFFLGFBQWEsTUFBTSxHQUFHLHlCQUF5QjtBQUN0RixVQUFNLE9BQU8sTUFBTSxRQUFRLDBCQUEwQjtBQUNyRCxVQUFNLEtBQUssTUFBTTtBQUNqQixVQUFNLFlBQVksTUFBTSxPQUFPO0FBQy9CLFVBQU0sSUFBSSxNQUFNLE9BQU87QUFDdkIsSUFBQUEsUUFBTyxNQUFNLE1BQU0sUUFBUSxJQUFJLEdBQUcsT0FBTztBQUFBLEVBQzFDLENBQUM7QUFDRixDQUFDO0FBRUQsV0FBVyxRQUFRLENBQUMsaUJBQWlCLG9CQUFvQixlQUFlLG1CQUFtQixlQUFlLG9CQUFvQixhQUFhLEdBQUc7QUFDN0ksT0FBSyxPQUFPLHNDQUFzQyxZQUFZO0FBQzdELFVBQU0sVUFBVSxNQUFNLE9BQU8sU0FBUztBQUNyQyxNQUFBQSxRQUFPLE1BQU0sTUFBTSxLQUFLLFFBQVEsbUJBQW1CLEVBQUUsTUFBTSxHQUFHLEdBQUcsZUFBZTtBQUNoRixNQUFBQSxRQUFPLE1BQU0sTUFBTSxLQUFLLFFBQVEsZ0NBQWdDLEVBQUUsTUFBTSxHQUFHLEdBQUcsWUFBWTtBQUMxRixNQUFBQSxRQUFPLEdBQUksTUFBTSxLQUFLLFFBQVEsaUJBQWlCLEVBQUUsTUFBTSxLQUFNLEdBQUcsVUFBVTtBQUFBLElBQzNFLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRjsiLAogICJuYW1lcyI6IFsiYXNzZXJ0IiwgImZzIiwgInBhdGgiLCAia2V5IiwgImZzIiwgInBhdGgiLCAiYXNzZXJ0IiwgInJvb3QiLCAibmFtZSJdCn0K
