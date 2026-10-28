// tests/docking.test.ts
import assert from "node:assert/strict";
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
  const resolve2 = (value) => {
    const raw = typeof value === "string" ? value : value[theme];
    const alias = /^\{(.+)\}$/.exec(raw);
    return alias ? "var(--" + alias[1] + ")" : raw;
  };
  for (const t of tokens.color.tokens) vars.push("--" + t.name + ": " + resolve2(t.value) + ";");
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
  baseUrl ??= new Promise((resolve2, reject) => {
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
      resolve2("http://127.0.0.1:" + (typeof address === "object" && address ? address.port : 0));
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

// tests/docking.test.ts
var TRANSPARENT = "rgba(0, 0, 0, 0)";
function resolve(page, property, value) {
  return page.evaluate(([prop, css]) => {
    const probe = document.createElement("div");
    probe.style.setProperty(prop, css);
    document.body.append(probe);
    const computed = getComputedStyle(probe).getPropertyValue(prop);
    probe.remove();
    return computed;
  }, [property, value]);
}
var bg = (target) => target.evaluate((el) => getComputedStyle(el).backgroundColor);
var fg = (target) => target.evaluate((el) => getComputedStyle(el).color);
var visibility = (target) => target.evaluate((el) => getComputedStyle(el).visibility);
var lineContent = (target) => target.evaluate((el) => getComputedStyle(el, "::before").content);
var classes = (target) => target.evaluate((el) => Array.from(el.classList));
var focusedTab = (page) => page.evaluate(() => document.activeElement?.dataset.tab);
var names = (tabs) => tabs.evaluateAll((els) => els.map((el) => el.dataset.tab ?? ""));
test("DockTab: hover shows the hovered fill, the hovered text colour and the close button", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const outliner = page.locator("ue-dock-tab").nth(0).locator('.dockTab[data-tab="outliner"]');
    const close = outliner.locator(".dockTab-close");
    assert.equal(await bg(outliner), TRANSPARENT);
    assert.equal(await visibility(close), "hidden");
    await outliner.hover();
    const hoveredFill = await resolve(page, "background-color", "color-mix(in srgb, var(--panel) 80%, transparent)");
    assert.equal(await bg(outliner), hoveredFill);
    assert.equal(await bg(page.locator(".dockTab--hovered[data-pinned]").first()), hoveredFill, "live hover equals the pinned hovered specimen");
    assert.equal(await fg(outliner), await resolve(page, "color", "var(--foreground-hover)"));
    assert.equal(await visibility(close), "visible");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: the close button shows its hovered and pressed colours", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const details = page.locator("ue-dock-tab").nth(0).locator('.dockTab[data-tab="details"]');
    const close = details.locator(".dockTab-close");
    assert.equal(await fg(close), await resolve(page, "color", "var(--foreground)"));
    await close.hover();
    assert.equal(await fg(close), await resolve(page, "color", "var(--foreground-hover)"));
    await page.mouse.down();
    assert.equal(await fg(close), await resolve(page, "color", "var(--foreground)"), "pressed keeps the Foreground tint");
    await page.mouse.move(2, 2);
    await page.mouse.up();
    assert.equal(await details.count(), 1, "releasing outside the button does not close the tab");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: clicking a tab makes it the foreground tab and swaps the panel", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const stack = page.locator("ue-dock-tab").nth(0);
    const tab = (name) => stack.locator('.dockTab[data-tab="' + name + '"]');
    const panel = (name) => stack.locator('[data-panel="' + name + '"]');
    assert.ok(await panel("details").isVisible());
    assert.ok(await panel("content").isHidden());
    await tab("content").click();
    assert.ok((await classes(tab("content"))).includes("dockTab--foreground"));
    assert.ok(!(await classes(tab("details"))).includes("dockTab--foreground"));
    assert.equal(await tab("content").getAttribute("aria-selected"), "true");
    assert.equal(await tab("details").getAttribute("aria-selected"), "false");
    assert.equal(await tab("content").getAttribute("tabindex"), "0");
    assert.equal(await tab("details").getAttribute("tabindex"), "-1");
    assert.ok(await panel("content").isVisible());
    assert.ok(await panel("details").isHidden());
    assert.match(await panel("content").innerText(), /Content Browser panel/);
    assert.equal(await bg(tab("content")), await resolve(page, "background-color", "var(--panel)"));
    assert.equal(await bg(tab("details")), TRANSPARENT);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: the active state moves between stacks and shows the primary line only on a minor tab", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const left = page.locator("ue-dock-tab").nth(0).locator('.dockTab[data-tab="details"]');
    const right = page.locator("ue-dock-tab").nth(1).locator('.dockTab[data-tab="layers"]');
    const major = page.locator("ue-dock-tab").nth(2).locator('.dockTab[data-tab="level2"]');
    const pinnedActive = page.locator(".dockTab--active[data-pinned]").first();
    assert.ok((await classes(left)).includes("dockTab--active"));
    assert.notEqual(await lineContent(left), "none");
    await right.click();
    assert.ok((await classes(right)).includes("dockTab--active"));
    assert.ok(!(await classes(left)).includes("dockTab--active"), "the left stack lost the active state");
    assert.notEqual(await lineContent(right), "none");
    assert.equal(await fg(right), await resolve(page, "color", "var(--foreground-hover)"));
    await major.click();
    assert.ok((await classes(major)).includes("dockTab--active"));
    assert.equal(await lineContent(major), "none", "a major tab never shows the active line");
    assert.equal(await fg(major), await resolve(page, "color", "var(--white)"));
    assert.ok((await classes(pinnedActive)).includes("dockTab--active"), "the pinned specimen keeps its forced state");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: closing the foreground tab selects its left neighbour, and the last close leaves an empty well", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const stack = page.locator("ue-dock-tab").nth(0);
    const tabs = stack.locator(".dockTab-well > .dockTab");
    const tab = (name) => stack.locator('.dockTab[data-tab="' + name + '"]');
    await tab("content").click();
    await tab("content").locator(".dockTab-close").click();
    assert.deepEqual(await names(tabs), ["details", "outliner"]);
    assert.ok((await classes(tab("outliner"))).includes("dockTab--foreground"), "the left neighbour takes over");
    assert.ok((await classes(tab("outliner"))).includes("dockTab--active"), "and keeps the active state");
    assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
    assert.equal(await stack.locator('[data-panel="content"]').count(), 0, "the panel left with its tab");
    await tab("details").hover();
    await tab("details").locator(".dockTab-close").click();
    assert.deepEqual(await names(tabs), ["outliner"], "closing a background tab keeps the foreground tab");
    assert.ok((await classes(tab("outliner"))).includes("dockTab--foreground"));
    await tab("outliner").locator(".dockTab-close").click();
    assert.equal(await tabs.count(), 0);
    const well = stack.locator(".dockTab-well");
    assert.ok((await well.boundingBox()).height >= 33, "the empty well keeps its height");
    assert.equal(await stack.locator("[data-panel]").count(), 0);
    await stack.locator(".dockTab-reset").click();
    assert.deepEqual(await names(tabs), ["details", "outliner", "content"], "Restore tabs brings the tabs back");
    assert.ok((await classes(tab("details"))).includes("dockTab--foreground"));
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: a middle click closes a tab", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const stack = page.locator("ue-dock-tab").nth(1);
    await stack.locator('.dockTab[data-tab="layers"]').click({ button: "middle" });
    assert.deepEqual(await names(stack.locator(".dockTab-well > .dockTab")), ["place"]);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: arrow keys, Home, End, Enter and Delete work on a focused tab", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const stack = page.locator("ue-dock-tab").nth(0);
    const tab = (name) => stack.locator('.dockTab[data-tab="' + name + '"]');
    await tab("details").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await focusedTab(page), "outliner");
    assert.ok((await classes(tab("outliner"))).includes("dockTab--foreground"));
    assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
    await page.keyboard.press("End");
    assert.equal(await focusedTab(page), "content");
    await page.keyboard.press("ArrowRight");
    assert.equal(await focusedTab(page), "details", "arrow keys wrap around");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await focusedTab(page), "content");
    await page.keyboard.press("Home");
    assert.equal(await focusedTab(page), "details");
    assert.ok(await tab("details").evaluate((el) => getComputedStyle(el).outlineStyle !== "none"), "a focused tab shows a focus ring");
    await page.keyboard.press("Delete");
    assert.deepEqual(await names(stack.locator(".dockTab-well > .dockTab")), ["outliner", "content"]);
    assert.ok((await classes(tab("outliner"))).includes("dockTab--foreground"));
    assert.equal(await focusedTab(page), "outliner", "focus follows to the new foreground tab");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: the major stack switches tabs and panels like the minor one", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const stack = page.locator("ue-dock-tab").nth(2);
    const second = stack.locator('.dockTab[data-tab="level2"]');
    await second.hover();
    assert.equal(await bg(second), await resolve(page, "background-color", "color-mix(in srgb, var(--panel) 80%, transparent)"));
    await second.click();
    assert.ok((await classes(second)).includes("dockTab--foreground"));
    assert.match(await stack.locator('[data-panel="level2"]').innerText(), /Second_Level/);
    assert.ok(await stack.locator('[data-panel="level1"]').isHidden());
    await second.locator(".dockTab-close").click();
    assert.ok((await classes(stack.locator('.dockTab[data-tab="level1"]'))).includes("dockTab--foreground"));
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("DockTab: pinned specimens ignore the pointer", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "DockTab");
    const normal = page.locator(".dockTab[data-pinned]").first();
    const before = await classes(normal);
    await normal.hover();
    assert.equal(await bg(normal), TRANSPARENT);
    assert.equal(await visibility(normal.locator(".dockTab-close")), "hidden");
    await normal.click();
    assert.deepEqual(await classes(normal), before);
    assert.equal(await page.locator("ue-dock-tab").count(), 3);
    assert.equal(await page.locator("[data-pinned] ue-dock-tab, ue-dock-tab [data-pinned]").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("TabWell: hover, click and the content swap work in the minor stack", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "TabWell");
    const stack = page.locator("ue-tab-well").nth(0);
    const tab = (name) => stack.locator('.tabWell-tab[data-tab="' + name + '"]');
    const outliner = tab("outliner");
    assert.equal(await bg(outliner), TRANSPARENT);
    await outliner.hover();
    assert.equal(await bg(outliner), await resolve(page, "background-color", "color-mix(in srgb, var(--panel) 80%, transparent)"));
    assert.equal(await visibility(outliner.locator(".tabWell-close")), "visible");
    assert.equal(await fg(outliner), await resolve(page, "color", "var(--foreground-hover)"));
    await outliner.click();
    assert.ok((await classes(outliner)).includes("tabWell-tab--foreground"));
    assert.ok((await classes(outliner)).includes("tabWell-tab--active"));
    assert.ok(!(await classes(tab("details"))).includes("tabWell-tab--foreground"));
    assert.equal(await bg(outliner), await resolve(page, "background-color", "var(--panel)"));
    assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
    assert.ok(await stack.locator('[data-panel="details"]').isHidden());
    assert.match(await stack.locator(".tabWell-content").innerText(), /Outliner panel/);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("TabWell: close removes the tab, the left neighbour takes over, the last close leaves an empty well", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "TabWell");
    const stack = page.locator("ue-tab-well").nth(0);
    const tabs = stack.locator(".tabWell-well > .tabWell-tab");
    const tab = (name) => stack.locator('.tabWell-tab[data-tab="' + name + '"]');
    await tab("content").click();
    await tab("content").locator(".tabWell-close").click();
    assert.deepEqual(await names(tabs), ["details", "outliner"]);
    assert.ok((await classes(tab("outliner"))).includes("tabWell-tab--foreground"));
    await tab("outliner").locator(".tabWell-close").click();
    assert.ok((await classes(tab("details"))).includes("tabWell-tab--foreground"));
    await tab("details").locator(".tabWell-close").click();
    assert.equal(await tabs.count(), 0);
    assert.ok((await stack.locator(".tabWell-well").boundingBox()).height >= 25, "the empty well keeps its height");
    await stack.locator(".tabWell-reset").click();
    assert.deepEqual(await names(tabs), ["details", "outliner", "content"]);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("TabWell: the major stack works on its own and never shows the active line", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "TabWell");
    const minor = page.locator("ue-tab-well").nth(0);
    const major = page.locator("ue-tab-well").nth(1);
    const second = major.locator('.tabWell-tab[data-tab="level2"]');
    await second.click();
    assert.ok((await classes(second)).includes("tabWell-tab--foreground"));
    assert.ok((await classes(second)).includes("tabWell-tab--active"));
    assert.equal(await lineContent(second), "none");
    assert.ok(!(await classes(minor.locator('.tabWell-tab[data-tab="details"]'))).includes("tabWell-tab--active"), "the minor stack lost the active state");
    assert.ok(await major.locator('[data-panel="level2"]').isVisible());
    assert.equal(await bg(major.locator(".tabWell-content")), await resolve(page, "background-color", "var(--background)"));
    await minor.locator('.tabWell-tab[data-tab="outliner"]').click();
    assert.notEqual(await lineContent(minor.locator('.tabWell-tab[data-tab="outliner"]')), "none");
    assert.ok(!(await classes(second)).includes("tabWell-tab--active"));
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("TabWell: keyboard moves between tabs and Delete closes", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "TabWell");
    const stack = page.locator("ue-tab-well").nth(0);
    await stack.locator('.tabWell-tab[data-tab="details"]').focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await focusedTab(page), "outliner");
    assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await focusedTab(page), "content", "wraps to the last tab");
    await page.keyboard.press("Home");
    assert.equal(await focusedTab(page), "details");
    await page.keyboard.press("Delete");
    assert.deepEqual(await names(stack.locator(".tabWell-well > .tabWell-tab")), ["outliner", "content"]);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("WindowChrome: the buttons show their hover fills and the pressed state drops the fill", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "WindowChrome");
    const frame = page.locator(".windowChrome-frame");
    const minimize = frame.locator('[data-action="minimize"]');
    const close = frame.locator('[data-action="close"]');
    assert.equal(await bg(minimize), TRANSPARENT);
    await minimize.hover();
    assert.equal(await bg(minimize), await resolve(page, "background-color", "rgba(255, 255, 255, 0.157)"));
    assert.equal(await fg(minimize), await resolve(page, "color", "var(--foreground-hover)"));
    assert.equal(await bg(page.locator(".windowChrome-btn--hover[data-pinned]").first()), await bg(minimize), "live hover equals the pinned hover specimen");
    await close.hover();
    assert.equal(await bg(close), await resolve(page, "background-color", "rgba(255, 79, 79, 0.588)"));
    assert.equal(await bg(minimize), TRANSPARENT, "the fill follows the pointer");
    await page.mouse.down();
    assert.equal(await bg(close), TRANSPARENT, "pressed has no fill");
    assert.equal(await fg(close), await resolve(page, "color", "var(--foreground)"));
    await page.mouse.move(2, 2);
    await page.mouse.up();
    assert.ok(await frame.isVisible(), "releasing outside the button does not close the window");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("WindowChrome: maximize toggles to the restore glyph and back", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "WindowChrome");
    const frame = page.locator(".windowChrome-frame");
    const maximize = frame.locator('[data-action="maximize"]');
    const glyph = maximize.locator("use");
    assert.equal(await glyph.getAttribute("href"), "#windowChrome-i-max");
    assert.equal(await maximize.getAttribute("aria-label"), "Maximize");
    await maximize.click();
    assert.equal(await glyph.getAttribute("href"), "#windowChrome-i-restore");
    assert.equal(await maximize.getAttribute("aria-label"), "Restore Down");
    assert.equal(await frame.getAttribute("data-maximized"), "");
    await maximize.click();
    assert.equal(await glyph.getAttribute("href"), "#windowChrome-i-max");
    assert.equal(await frame.getAttribute("data-maximized"), null);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("WindowChrome: minimize and close hide the window and the restore button brings it back", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "WindowChrome");
    const frame = page.locator(".windowChrome-frame");
    const reopen = page.locator(".windowChrome-reopen");
    assert.ok(await reopen.isHidden());
    await frame.locator('[data-action="close"]').click();
    assert.ok(await frame.isHidden());
    assert.ok(await reopen.isVisible());
    await reopen.click();
    assert.ok(await frame.isVisible());
    assert.ok(await reopen.isHidden());
    await frame.locator('[data-action="minimize"]').click();
    assert.ok(await frame.isHidden());
    await page.keyboard.press("Enter");
    assert.ok(await frame.isVisible(), "the restore button is keyboard operable");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("WindowChrome: the window state follows focus", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "WindowChrome");
    const frame = page.locator(".windowChrome-frame");
    const status = page.locator(".windowChrome-status");
    assert.equal(await frame.getAttribute("data-active"), "false");
    assert.equal(await status.innerText(), "Window inactive");
    await page.locator(".windowChrome-content").click();
    assert.equal(await frame.getAttribute("data-active"), "true");
    assert.equal(await status.innerText(), "Window active");
    await frame.locator('[data-action="maximize"]').focus();
    assert.equal(await frame.getAttribute("data-active"), "true", "focus moving inside the window keeps it active");
    await page.mouse.click(900, 700);
    assert.equal(await frame.getAttribute("data-active"), "false");
    assert.equal(await status.innerText(), "Window inactive");
    await page.keyboard.press("Tab");
    assert.equal(await frame.getAttribute("data-active"), "true", "tabbing into the window activates it");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("WindowChrome: pinned button specimens ignore the pointer", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "WindowChrome");
    const pinned = page.locator(".windowChrome-states .windowChrome-btn--close").first();
    await pinned.hover();
    assert.equal(await bg(pinned), TRANSPARENT);
    assert.equal(await page.locator("ue-window-chrome").count(), 1);
    assert.equal(await page.locator("[data-pinned] ue-window-chrome, ue-window-chrome [data-pinned]").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
async function sizes(demo, axis) {
  const panes = demo.locator(".splitter-pane");
  const first = await panes.nth(0).boundingBox();
  const second = await panes.nth(1).boundingBox();
  return { before: first[axis], after: second[axis] };
}
async function dragHandle(page, handle, dx, dy, release = true) {
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  if (release) await page.mouse.up();
}
test("Splitter: hover shows the secondary fill and the resize cursor", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Splitter");
    const row = page.locator("ue-splitter").nth(0).locator(".splitter-handle");
    const col = page.locator("ue-splitter").nth(1).locator(".splitter-handle");
    assert.equal(await bg(row), await resolve(page, "background-color", "var(--background)"));
    assert.equal(await row.evaluate((el) => getComputedStyle(el).cursor), "col-resize");
    assert.equal(await col.evaluate((el) => getComputedStyle(el).cursor), "row-resize");
    await row.hover();
    assert.equal(await bg(row), await resolve(page, "background-color", "var(--secondary)"));
    assert.equal(await bg(page.locator(".splitter-handle--highlight[data-pinned]").first()), await bg(row), "live hover equals the pinned highlight");
    await page.mouse.move(2, 2);
    assert.equal(await bg(row), await resolve(page, "background-color", "var(--background)"));
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("Splitter: dragging the horizontal handle resizes both panes and holds the pressed colour", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Splitter");
    const demo = page.locator("ue-splitter").nth(0).locator(".splitter-demo");
    const handle = demo.locator(".splitter-handle");
    const start = await sizes(demo, "width");
    await dragHandle(page, handle, 40, 0, false);
    assert.ok((await classes(handle)).includes("splitter-handle--highlight"), "dragging keeps the highlight");
    assert.equal(await bg(handle), await resolve(page, "background-color", "var(--secondary)"));
    await page.mouse.up();
    const end = await sizes(demo, "width");
    assert.ok(Math.abs(end.before - (start.before + 40)) <= 1, "the first pane grew by the drag distance: " + start.before + " to " + end.before);
    assert.ok(Math.abs(end.after - (start.after - 40)) <= 1, "the second pane shrank by the same distance");
    assert.ok(Math.abs(end.before + end.after - (start.before + start.after)) <= 1, "the panes still fill the same space");
    assert.ok(!(await classes(handle)).includes("splitter-handle--highlight"), "the highlight class leaves with the drag");
    await page.mouse.move(2, 2);
    assert.equal(await bg(handle), await resolve(page, "background-color", "var(--background)"));
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("Splitter: no pane shrinks below the minimum size", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Splitter");
    const demo = page.locator("ue-splitter").nth(0).locator(".splitter-demo");
    const handle = demo.locator(".splitter-handle");
    const start = await sizes(demo, "width");
    const total = start.before + start.after;
    await dragHandle(page, handle, 3e3, 0);
    let end = await sizes(demo, "width");
    assert.ok(Math.abs(end.after - 20) <= 1, "the second pane stops at 20 but is " + end.after);
    assert.ok(Math.abs(end.before - (total - 20)) <= 1);
    await dragHandle(page, handle, -3e3, 0);
    end = await sizes(demo, "width");
    assert.ok(Math.abs(end.before - 20) <= 1, "the first pane stops at 20 but is " + end.before);
    assert.ok(Math.abs(end.after - (total - 20)) <= 1);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("Splitter: dragging the vertical handle resizes the pane heights", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Splitter");
    const demo = page.locator("ue-splitter").nth(1).locator(".splitter-demo");
    const handle = demo.locator(".splitter-handle");
    const start = await sizes(demo, "height");
    await dragHandle(page, handle, 0, -30);
    const end = await sizes(demo, "height");
    assert.ok(Math.abs(end.before - (start.before - 30)) <= 1, "the top pane shrank by the drag distance");
    assert.ok(Math.abs(end.after - (start.after + 30)) <= 1);
    const widths = await sizes(demo, "width");
    assert.equal(widths.before, widths.after, "a vertical drag leaves the widths alone");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("Splitter: arrow keys move a focused handle by a few pixels", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Splitter");
    const demo = page.locator("ue-splitter").nth(0).locator(".splitter-demo");
    const handle = demo.locator(".splitter-handle");
    const start = await sizes(demo, "width");
    await handle.focus();
    assert.equal(await bg(handle), await resolve(page, "background-color", "var(--secondary)"), "keyboard focus shows the highlight");
    await page.keyboard.press("ArrowRight");
    let now = await sizes(demo, "width");
    assert.ok(Math.abs(now.before - (start.before + 5)) <= 0.5, "ArrowRight grows the first pane by 5");
    await page.keyboard.press("Shift+ArrowRight");
    now = await sizes(demo, "width");
    assert.ok(Math.abs(now.before - (start.before + 25)) <= 0.5, "Shift+ArrowRight grows it by 20 more");
    await page.keyboard.press("ArrowLeft");
    now = await sizes(demo, "width");
    assert.ok(Math.abs(now.before - (start.before + 20)) <= 0.5);
    assert.equal(await handle.getAttribute("aria-valuenow"), String(Math.round(now.before)));
    await page.keyboard.press("ArrowDown");
    const unchanged = await sizes(demo, "width");
    assert.equal(unchanged.before, now.before, "a horizontal handle ignores the vertical arrows");
    await page.keyboard.press("Home");
    assert.ok(Math.abs((await sizes(demo, "width")).before - 20) <= 0.5);
    await page.keyboard.press("End");
    assert.ok(Math.abs((await sizes(demo, "width")).after - 20) <= 0.5);
    assert.equal(await handle.getAttribute("aria-valuemin"), "20");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("Splitter: the vertical handle answers the up and down arrows", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Splitter");
    const demo = page.locator("ue-splitter").nth(1).locator(".splitter-demo");
    const handle = demo.locator(".splitter-handle");
    const start = await sizes(demo, "height");
    await handle.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    assert.ok(Math.abs((await sizes(demo, "height")).before - (start.before + 10)) <= 0.5);
    await page.keyboard.press("ArrowUp");
    assert.ok(Math.abs((await sizes(demo, "height")).before - (start.before + 5)) <= 0.5);
    await page.keyboard.press("ArrowRight");
    assert.ok(Math.abs((await sizes(demo, "height")).before - (start.before + 5)) <= 0.5, "a vertical handle ignores the horizontal arrows");
    assert.deepEqual(errors, []);
    await page.close();
  });
});
test("Splitter: pinned handles stay pinned", async () => {
  await withBrowser(async (browser) => {
    const { page, errors } = await openPreview(browser, "Splitter");
    const pinned = page.locator(".splitter-handle[data-pinned]").first();
    const demo = page.locator(".splitter-demo").filter({ has: pinned });
    const start = await sizes(demo, "width");
    await pinned.hover();
    assert.equal(await bg(pinned), await resolve(page, "background-color", "var(--background)"));
    await dragHandle(page, pinned, 30, 0);
    assert.deepEqual(await sizes(demo, "width"), start);
    assert.equal(await pinned.evaluate((el) => getComputedStyle(el).cursor), "auto");
    assert.equal(await page.locator("[data-pinned] ue-splitter, ue-splitter [data-pinned]").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZG9ja2luZy50ZXN0LnRzIiwgImxpYi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8vIDxyZWZlcmVuY2UgbGliPVwiZG9tXCIgLz5cbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQvc3RyaWN0JztcbmltcG9ydCB7IHRlc3QgfSBmcm9tICdub2RlOnRlc3QnO1xuaW1wb3J0IHR5cGUgeyBMb2NhdG9yLCBQYWdlIH0gZnJvbSAncGxheXdyaWdodCc7XG5pbXBvcnQgeyBvcGVuUHJldmlldywgd2l0aEJyb3dzZXIgfSBmcm9tICcuL2xpYi50cyc7XG5cbmNvbnN0IFRSQU5TUEFSRU5UID0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4vLyBDb21wdXRlcyBhIENTUyB2YWx1ZSB0aGUgd2F5IHRoZSBwYWdlIGRvZXMsIHNvIGEgdGVzdCBjb21wYXJlcyBhZ2FpbnN0IGEgdG9rZW4gYW5kIG5vdCBhIGhhbmQtY29waWVkIHJnYiBzdHJpbmcuXG5mdW5jdGlvbiByZXNvbHZlKHBhZ2U6IFBhZ2UsIHByb3BlcnR5OiAnYmFja2dyb3VuZC1jb2xvcicgfCAnY29sb3InLCB2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0cmV0dXJuIHBhZ2UuZXZhbHVhdGUoKFtwcm9wLCBjc3NdKSA9PiB7XG5cdFx0Y29uc3QgcHJvYmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRwcm9iZS5zdHlsZS5zZXRQcm9wZXJ0eShwcm9wLCBjc3MpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kKHByb2JlKTtcblx0XHRjb25zdCBjb21wdXRlZCA9IGdldENvbXB1dGVkU3R5bGUocHJvYmUpLmdldFByb3BlcnR5VmFsdWUocHJvcCk7XG5cdFx0cHJvYmUucmVtb3ZlKCk7XG5cdFx0cmV0dXJuIGNvbXB1dGVkO1xuXHR9LCBbcHJvcGVydHksIHZhbHVlXSBhcyBbc3RyaW5nLCBzdHJpbmddKTtcbn1cblxuY29uc3QgYmcgPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmJhY2tncm91bmRDb2xvcik7XG5jb25zdCBmZyA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuY29sb3IpO1xuY29uc3QgdmlzaWJpbGl0eSA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkudmlzaWJpbGl0eSk7XG5jb25zdCBsaW5lQ29udGVudCA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCwgJzo6YmVmb3JlJykuY29udGVudCk7XG5jb25zdCBjbGFzc2VzID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nW10+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwpID0+IEFycmF5LmZyb20oZWwuY2xhc3NMaXN0KSk7XG5jb25zdCBmb2N1c2VkVGFiID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4gPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5kYXRhc2V0LnRhYik7XG5jb25zdCBuYW1lcyA9ICh0YWJzOiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4gdGFicy5ldmFsdWF0ZUFsbCgoZWxzKSA9PiBlbHMubWFwKChlbCkgPT4gKGVsIGFzIEhUTUxFbGVtZW50KS5kYXRhc2V0LnRhYiA/PyAnJykpO1xuXG4vLyAtLS0tLS0tLS0tIERvY2tUYWIgLS0tLS0tLS0tLVxuXG50ZXN0KCdEb2NrVGFiOiBob3ZlciBzaG93cyB0aGUgaG92ZXJlZCBmaWxsLCB0aGUgaG92ZXJlZCB0ZXh0IGNvbG91ciBhbmQgdGhlIGNsb3NlIGJ1dHRvbicsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgd2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRjb25zdCB7IHBhZ2UsIGVycm9ycyB9ID0gYXdhaXQgb3BlblByZXZpZXcoYnJvd3NlciwgJ0RvY2tUYWInKTtcblx0XHRjb25zdCBvdXRsaW5lciA9IHBhZ2UubG9jYXRvcigndWUtZG9jay10YWInKS5udGgoMCkubG9jYXRvcignLmRvY2tUYWJbZGF0YS10YWI9XCJvdXRsaW5lclwiXScpO1xuXHRcdGNvbnN0IGNsb3NlID0gb3V0bGluZXIubG9jYXRvcignLmRvY2tUYWItY2xvc2UnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcob3V0bGluZXIpLCBUUkFOU1BBUkVOVCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHkoY2xvc2UpLCAnaGlkZGVuJyk7XG5cdFx0YXdhaXQgb3V0bGluZXIuaG92ZXIoKTtcblx0XHRjb25zdCBob3ZlcmVkRmlsbCA9IGF3YWl0IHJlc29sdmUocGFnZSwgJ2JhY2tncm91bmQtY29sb3InLCAnY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLXBhbmVsKSA4MCUsIHRyYW5zcGFyZW50KScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZyhvdXRsaW5lciksIGhvdmVyZWRGaWxsKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcocGFnZS5sb2NhdG9yKCcuZG9ja1RhYi0taG92ZXJlZFtkYXRhLXBpbm5lZF0nKS5maXJzdCgpKSwgaG92ZXJlZEZpbGwsICdsaXZlIGhvdmVyIGVxdWFscyB0aGUgcGlubmVkIGhvdmVyZWQgc3BlY2ltZW4nKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZmcob3V0bGluZXIpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdjb2xvcicsICd2YXIoLS1mb3JlZ3JvdW5kLWhvdmVyKScpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdmlzaWJpbGl0eShjbG9zZSksICd2aXNpYmxlJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ0RvY2tUYWI6IHRoZSBjbG9zZSBidXR0b24gc2hvd3MgaXRzIGhvdmVyZWQgYW5kIHByZXNzZWQgY29sb3VycycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgd2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRjb25zdCB7IHBhZ2UsIGVycm9ycyB9ID0gYXdhaXQgb3BlblByZXZpZXcoYnJvd3NlciwgJ0RvY2tUYWInKTtcblx0XHRjb25zdCBkZXRhaWxzID0gcGFnZS5sb2NhdG9yKCd1ZS1kb2NrLXRhYicpLm50aCgwKS5sb2NhdG9yKCcuZG9ja1RhYltkYXRhLXRhYj1cImRldGFpbHNcIl0nKTtcblx0XHRjb25zdCBjbG9zZSA9IGRldGFpbHMubG9jYXRvcignLmRvY2tUYWItY2xvc2UnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZmcoY2xvc2UpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdjb2xvcicsICd2YXIoLS1mb3JlZ3JvdW5kKScpKTtcblx0XHRhd2FpdCBjbG9zZS5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmZyhjbG9zZSksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2NvbG9yJywgJ3ZhcigtLWZvcmVncm91bmQtaG92ZXIpJykpO1xuXHRcdGF3YWl0IHBhZ2UubW91c2UuZG93bigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmZyhjbG9zZSksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2NvbG9yJywgJ3ZhcigtLWZvcmVncm91bmQpJyksICdwcmVzc2VkIGtlZXBzIHRoZSBGb3JlZ3JvdW5kIHRpbnQnKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoMiwgMik7XG5cdFx0YXdhaXQgcGFnZS5tb3VzZS51cCgpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBkZXRhaWxzLmNvdW50KCksIDEsICdyZWxlYXNpbmcgb3V0c2lkZSB0aGUgYnV0dG9uIGRvZXMgbm90IGNsb3NlIHRoZSB0YWInKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGVycm9ycywgW10pO1xuXHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0fSk7XG59KTtcblxudGVzdCgnRG9ja1RhYjogY2xpY2tpbmcgYSB0YWIgbWFrZXMgaXQgdGhlIGZvcmVncm91bmQgdGFiIGFuZCBzd2FwcyB0aGUgcGFuZWwnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdEb2NrVGFiJyk7XG5cdFx0Y29uc3Qgc3RhY2sgPSBwYWdlLmxvY2F0b3IoJ3VlLWRvY2stdGFiJykubnRoKDApO1xuXHRcdGNvbnN0IHRhYiA9IChuYW1lOiBzdHJpbmcpOiBMb2NhdG9yID0+IHN0YWNrLmxvY2F0b3IoJy5kb2NrVGFiW2RhdGEtdGFiPVwiJyArIG5hbWUgKyAnXCJdJyk7XG5cdFx0Y29uc3QgcGFuZWwgPSAobmFtZTogc3RyaW5nKTogTG9jYXRvciA9PiBzdGFjay5sb2NhdG9yKCdbZGF0YS1wYW5lbD1cIicgKyBuYW1lICsgJ1wiXScpO1xuXHRcdGFzc2VydC5vayhhd2FpdCBwYW5lbCgnZGV0YWlscycpLmlzVmlzaWJsZSgpKTtcblx0XHRhc3NlcnQub2soYXdhaXQgcGFuZWwoJ2NvbnRlbnQnKS5pc0hpZGRlbigpKTtcblxuXHRcdGF3YWl0IHRhYignY29udGVudCcpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBjbGFzc2VzKHRhYignY29udGVudCcpKSkuaW5jbHVkZXMoJ2RvY2tUYWItLWZvcmVncm91bmQnKSk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgY2xhc3Nlcyh0YWIoJ2RldGFpbHMnKSkpLmluY2x1ZGVzKCdkb2NrVGFiLS1mb3JlZ3JvdW5kJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0YWIoJ2NvbnRlbnQnKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdGFiKCdkZXRhaWxzJykuZ2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJyksICdmYWxzZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0YWIoJ2NvbnRlbnQnKS5nZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JyksICcwJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRhYignZGV0YWlscycpLmdldEF0dHJpYnV0ZSgndGFiaW5kZXgnKSwgJy0xJyk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHBhbmVsKCdjb250ZW50JykuaXNWaXNpYmxlKCkpO1xuXHRcdGFzc2VydC5vayhhd2FpdCBwYW5lbCgnZGV0YWlscycpLmlzSGlkZGVuKCkpO1xuXHRcdGFzc2VydC5tYXRjaChhd2FpdCBwYW5lbCgnY29udGVudCcpLmlubmVyVGV4dCgpLCAvQ29udGVudCBCcm93c2VyIHBhbmVsLyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKHRhYignY29udGVudCcpKSwgYXdhaXQgcmVzb2x2ZShwYWdlLCAnYmFja2dyb3VuZC1jb2xvcicsICd2YXIoLS1wYW5lbCknKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKHRhYignZGV0YWlscycpKSwgVFJBTlNQQVJFTlQpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdEb2NrVGFiOiB0aGUgYWN0aXZlIHN0YXRlIG1vdmVzIGJldHdlZW4gc3RhY2tzIGFuZCBzaG93cyB0aGUgcHJpbWFyeSBsaW5lIG9ubHkgb24gYSBtaW5vciB0YWInLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdEb2NrVGFiJyk7XG5cdFx0Y29uc3QgbGVmdCA9IHBhZ2UubG9jYXRvcigndWUtZG9jay10YWInKS5udGgoMCkubG9jYXRvcignLmRvY2tUYWJbZGF0YS10YWI9XCJkZXRhaWxzXCJdJyk7XG5cdFx0Y29uc3QgcmlnaHQgPSBwYWdlLmxvY2F0b3IoJ3VlLWRvY2stdGFiJykubnRoKDEpLmxvY2F0b3IoJy5kb2NrVGFiW2RhdGEtdGFiPVwibGF5ZXJzXCJdJyk7XG5cdFx0Y29uc3QgbWFqb3IgPSBwYWdlLmxvY2F0b3IoJ3VlLWRvY2stdGFiJykubnRoKDIpLmxvY2F0b3IoJy5kb2NrVGFiW2RhdGEtdGFiPVwibGV2ZWwyXCJdJyk7XG5cdFx0Y29uc3QgcGlubmVkQWN0aXZlID0gcGFnZS5sb2NhdG9yKCcuZG9ja1RhYi0tYWN0aXZlW2RhdGEtcGlubmVkXScpLmZpcnN0KCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBjbGFzc2VzKGxlZnQpKS5pbmNsdWRlcygnZG9ja1RhYi0tYWN0aXZlJykpO1xuXHRcdGFzc2VydC5ub3RFcXVhbChhd2FpdCBsaW5lQ29udGVudChsZWZ0KSwgJ25vbmUnKTtcblxuXHRcdGF3YWl0IHJpZ2h0LmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBjbGFzc2VzKHJpZ2h0KSkuaW5jbHVkZXMoJ2RvY2tUYWItLWFjdGl2ZScpKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBjbGFzc2VzKGxlZnQpKS5pbmNsdWRlcygnZG9ja1RhYi0tYWN0aXZlJyksICd0aGUgbGVmdCBzdGFjayBsb3N0IHRoZSBhY3RpdmUgc3RhdGUnKTtcblx0XHRhc3NlcnQubm90RXF1YWwoYXdhaXQgbGluZUNvbnRlbnQocmlnaHQpLCAnbm9uZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmZyhyaWdodCksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2NvbG9yJywgJ3ZhcigtLWZvcmVncm91bmQtaG92ZXIpJykpO1xuXG5cdFx0YXdhaXQgbWFqb3IuY2xpY2soKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXMobWFqb3IpKS5pbmNsdWRlcygnZG9ja1RhYi0tYWN0aXZlJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBsaW5lQ29udGVudChtYWpvciksICdub25lJywgJ2EgbWFqb3IgdGFiIG5ldmVyIHNob3dzIHRoZSBhY3RpdmUgbGluZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmZyhtYWpvciksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2NvbG9yJywgJ3ZhcigtLXdoaXRlKScpKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXMocGlubmVkQWN0aXZlKSkuaW5jbHVkZXMoJ2RvY2tUYWItLWFjdGl2ZScpLCAndGhlIHBpbm5lZCBzcGVjaW1lbiBrZWVwcyBpdHMgZm9yY2VkIHN0YXRlJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ0RvY2tUYWI6IGNsb3NpbmcgdGhlIGZvcmVncm91bmQgdGFiIHNlbGVjdHMgaXRzIGxlZnQgbmVpZ2hib3VyLCBhbmQgdGhlIGxhc3QgY2xvc2UgbGVhdmVzIGFuIGVtcHR5IHdlbGwnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdEb2NrVGFiJyk7XG5cdFx0Y29uc3Qgc3RhY2sgPSBwYWdlLmxvY2F0b3IoJ3VlLWRvY2stdGFiJykubnRoKDApO1xuXHRcdGNvbnN0IHRhYnMgPSBzdGFjay5sb2NhdG9yKCcuZG9ja1RhYi13ZWxsID4gLmRvY2tUYWInKTtcblx0XHRjb25zdCB0YWIgPSAobmFtZTogc3RyaW5nKTogTG9jYXRvciA9PiBzdGFjay5sb2NhdG9yKCcuZG9ja1RhYltkYXRhLXRhYj1cIicgKyBuYW1lICsgJ1wiXScpO1xuXG5cdFx0YXdhaXQgdGFiKCdjb250ZW50JykuY2xpY2soKTtcblx0XHRhd2FpdCB0YWIoJ2NvbnRlbnQnKS5sb2NhdG9yKCcuZG9ja1RhYi1jbG9zZScpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBuYW1lcyh0YWJzKSwgWydkZXRhaWxzJywgJ291dGxpbmVyJ10pO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3Nlcyh0YWIoJ291dGxpbmVyJykpKS5pbmNsdWRlcygnZG9ja1RhYi0tZm9yZWdyb3VuZCcpLCAndGhlIGxlZnQgbmVpZ2hib3VyIHRha2VzIG92ZXInKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXModGFiKCdvdXRsaW5lcicpKSkuaW5jbHVkZXMoJ2RvY2tUYWItLWFjdGl2ZScpLCAnYW5kIGtlZXBzIHRoZSBhY3RpdmUgc3RhdGUnKTtcblx0XHRhc3NlcnQub2soYXdhaXQgc3RhY2subG9jYXRvcignW2RhdGEtcGFuZWw9XCJvdXRsaW5lclwiXScpLmlzVmlzaWJsZSgpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhY2subG9jYXRvcignW2RhdGEtcGFuZWw9XCJjb250ZW50XCJdJykuY291bnQoKSwgMCwgJ3RoZSBwYW5lbCBsZWZ0IHdpdGggaXRzIHRhYicpO1xuXG5cdFx0YXdhaXQgdGFiKCdkZXRhaWxzJykuaG92ZXIoKTtcblx0XHRhd2FpdCB0YWIoJ2RldGFpbHMnKS5sb2NhdG9yKCcuZG9ja1RhYi1jbG9zZScpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBuYW1lcyh0YWJzKSwgWydvdXRsaW5lciddLCAnY2xvc2luZyBhIGJhY2tncm91bmQgdGFiIGtlZXBzIHRoZSBmb3JlZ3JvdW5kIHRhYicpO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3Nlcyh0YWIoJ291dGxpbmVyJykpKS5pbmNsdWRlcygnZG9ja1RhYi0tZm9yZWdyb3VuZCcpKTtcblxuXHRcdGF3YWl0IHRhYignb3V0bGluZXInKS5sb2NhdG9yKCcuZG9ja1RhYi1jbG9zZScpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRhYnMuY291bnQoKSwgMCk7XG5cdFx0Y29uc3Qgd2VsbCA9IHN0YWNrLmxvY2F0b3IoJy5kb2NrVGFiLXdlbGwnKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IHdlbGwuYm91bmRpbmdCb3goKSkhLmhlaWdodCA+PSAzMywgJ3RoZSBlbXB0eSB3ZWxsIGtlZXBzIGl0cyBoZWlnaHQnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhY2subG9jYXRvcignW2RhdGEtcGFuZWxdJykuY291bnQoKSwgMCk7XG5cblx0XHRhd2FpdCBzdGFjay5sb2NhdG9yKCcuZG9ja1RhYi1yZXNldCcpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBuYW1lcyh0YWJzKSwgWydkZXRhaWxzJywgJ291dGxpbmVyJywgJ2NvbnRlbnQnXSwgJ1Jlc3RvcmUgdGFicyBicmluZ3MgdGhlIHRhYnMgYmFjaycpO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3Nlcyh0YWIoJ2RldGFpbHMnKSkpLmluY2x1ZGVzKCdkb2NrVGFiLS1mb3JlZ3JvdW5kJykpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdEb2NrVGFiOiBhIG1pZGRsZSBjbGljayBjbG9zZXMgYSB0YWInLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdEb2NrVGFiJyk7XG5cdFx0Y29uc3Qgc3RhY2sgPSBwYWdlLmxvY2F0b3IoJ3VlLWRvY2stdGFiJykubnRoKDEpO1xuXHRcdGF3YWl0IHN0YWNrLmxvY2F0b3IoJy5kb2NrVGFiW2RhdGEtdGFiPVwibGF5ZXJzXCJdJykuY2xpY2soeyBidXR0b246ICdtaWRkbGUnIH0pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgbmFtZXMoc3RhY2subG9jYXRvcignLmRvY2tUYWItd2VsbCA+IC5kb2NrVGFiJykpLCBbJ3BsYWNlJ10pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdEb2NrVGFiOiBhcnJvdyBrZXlzLCBIb21lLCBFbmQsIEVudGVyIGFuZCBEZWxldGUgd29yayBvbiBhIGZvY3VzZWQgdGFiJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnRG9ja1RhYicpO1xuXHRcdGNvbnN0IHN0YWNrID0gcGFnZS5sb2NhdG9yKCd1ZS1kb2NrLXRhYicpLm50aCgwKTtcblx0XHRjb25zdCB0YWIgPSAobmFtZTogc3RyaW5nKTogTG9jYXRvciA9PiBzdGFjay5sb2NhdG9yKCcuZG9ja1RhYltkYXRhLXRhYj1cIicgKyBuYW1lICsgJ1wiXScpO1xuXHRcdGF3YWl0IHRhYignZGV0YWlscycpLmZvY3VzKCk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmb2N1c2VkVGFiKHBhZ2UpLCAnb3V0bGluZXInKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXModGFiKCdvdXRsaW5lcicpKSkuaW5jbHVkZXMoJ2RvY2tUYWItLWZvcmVncm91bmQnKSk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHN0YWNrLmxvY2F0b3IoJ1tkYXRhLXBhbmVsPVwib3V0bGluZXJcIl0nKS5pc1Zpc2libGUoKSk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnRW5kJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZvY3VzZWRUYWIocGFnZSksICdjb250ZW50Jyk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmb2N1c2VkVGFiKHBhZ2UpLCAnZGV0YWlscycsICdhcnJvdyBrZXlzIHdyYXAgYXJvdW5kJyk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnQXJyb3dMZWZ0Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZvY3VzZWRUYWIocGFnZSksICdjb250ZW50Jyk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnSG9tZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmb2N1c2VkVGFiKHBhZ2UpLCAnZGV0YWlscycpO1xuXHRcdGFzc2VydC5vayhhd2FpdCB0YWIoJ2RldGFpbHMnKS5ldmFsdWF0ZSgoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLm91dGxpbmVTdHlsZSAhPT0gJ25vbmUnKSwgJ2EgZm9jdXNlZCB0YWIgc2hvd3MgYSBmb2N1cyByaW5nJyk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnRGVsZXRlJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBuYW1lcyhzdGFjay5sb2NhdG9yKCcuZG9ja1RhYi13ZWxsID4gLmRvY2tUYWInKSksIFsnb3V0bGluZXInLCAnY29udGVudCddKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXModGFiKCdvdXRsaW5lcicpKSkuaW5jbHVkZXMoJ2RvY2tUYWItLWZvcmVncm91bmQnKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZvY3VzZWRUYWIocGFnZSksICdvdXRsaW5lcicsICdmb2N1cyBmb2xsb3dzIHRvIHRoZSBuZXcgZm9yZWdyb3VuZCB0YWInKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGVycm9ycywgW10pO1xuXHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0fSk7XG59KTtcblxudGVzdCgnRG9ja1RhYjogdGhlIG1ham9yIHN0YWNrIHN3aXRjaGVzIHRhYnMgYW5kIHBhbmVscyBsaWtlIHRoZSBtaW5vciBvbmUnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdEb2NrVGFiJyk7XG5cdFx0Y29uc3Qgc3RhY2sgPSBwYWdlLmxvY2F0b3IoJ3VlLWRvY2stdGFiJykubnRoKDIpO1xuXHRcdGNvbnN0IHNlY29uZCA9IHN0YWNrLmxvY2F0b3IoJy5kb2NrVGFiW2RhdGEtdGFiPVwibGV2ZWwyXCJdJyk7XG5cdFx0YXdhaXQgc2Vjb25kLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKHNlY29uZCksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2JhY2tncm91bmQtY29sb3InLCAnY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLXBhbmVsKSA4MCUsIHRyYW5zcGFyZW50KScpKTtcblx0XHRhd2FpdCBzZWNvbmQuY2xpY2soKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXMoc2Vjb25kKSkuaW5jbHVkZXMoJ2RvY2tUYWItLWZvcmVncm91bmQnKSk7XG5cdFx0YXNzZXJ0Lm1hdGNoKGF3YWl0IHN0YWNrLmxvY2F0b3IoJ1tkYXRhLXBhbmVsPVwibGV2ZWwyXCJdJykuaW5uZXJUZXh0KCksIC9TZWNvbmRfTGV2ZWwvKTtcblx0XHRhc3NlcnQub2soYXdhaXQgc3RhY2subG9jYXRvcignW2RhdGEtcGFuZWw9XCJsZXZlbDFcIl0nKS5pc0hpZGRlbigpKTtcblx0XHRhd2FpdCBzZWNvbmQubG9jYXRvcignLmRvY2tUYWItY2xvc2UnKS5jbGljaygpO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3NlcyhzdGFjay5sb2NhdG9yKCcuZG9ja1RhYltkYXRhLXRhYj1cImxldmVsMVwiXScpKSkuaW5jbHVkZXMoJ2RvY2tUYWItLWZvcmVncm91bmQnKSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ0RvY2tUYWI6IHBpbm5lZCBzcGVjaW1lbnMgaWdub3JlIHRoZSBwb2ludGVyJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnRG9ja1RhYicpO1xuXHRcdGNvbnN0IG5vcm1hbCA9IHBhZ2UubG9jYXRvcignLmRvY2tUYWJbZGF0YS1waW5uZWRdJykuZmlyc3QoKTtcblx0XHRjb25zdCBiZWZvcmUgPSBhd2FpdCBjbGFzc2VzKG5vcm1hbCk7XG5cdFx0YXdhaXQgbm9ybWFsLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKG5vcm1hbCksIFRSQU5TUEFSRU5UKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgdmlzaWJpbGl0eShub3JtYWwubG9jYXRvcignLmRvY2tUYWItY2xvc2UnKSksICdoaWRkZW4nKTtcblx0XHRhd2FpdCBub3JtYWwuY2xpY2soKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IGNsYXNzZXMobm9ybWFsKSwgYmVmb3JlKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKCd1ZS1kb2NrLXRhYicpLmNvdW50KCksIDMpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJ1tkYXRhLXBpbm5lZF0gdWUtZG9jay10YWIsIHVlLWRvY2stdGFiIFtkYXRhLXBpbm5lZF0nKS5jb3VudCgpLCAwKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGVycm9ycywgW10pO1xuXHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0fSk7XG59KTtcblxuLy8gLS0tLS0tLS0tLSBUYWJXZWxsIC0tLS0tLS0tLS1cblxudGVzdCgnVGFiV2VsbDogaG92ZXIsIGNsaWNrIGFuZCB0aGUgY29udGVudCBzd2FwIHdvcmsgaW4gdGhlIG1pbm9yIHN0YWNrJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnVGFiV2VsbCcpO1xuXHRcdGNvbnN0IHN0YWNrID0gcGFnZS5sb2NhdG9yKCd1ZS10YWItd2VsbCcpLm50aCgwKTtcblx0XHRjb25zdCB0YWIgPSAobmFtZTogc3RyaW5nKTogTG9jYXRvciA9PiBzdGFjay5sb2NhdG9yKCcudGFiV2VsbC10YWJbZGF0YS10YWI9XCInICsgbmFtZSArICdcIl0nKTtcblx0XHRjb25zdCBvdXRsaW5lciA9IHRhYignb3V0bGluZXInKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcob3V0bGluZXIpLCBUUkFOU1BBUkVOVCk7XG5cdFx0YXdhaXQgb3V0bGluZXIuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcob3V0bGluZXIpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdiYWNrZ3JvdW5kLWNvbG9yJywgJ2NvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1wYW5lbCkgODAlLCB0cmFuc3BhcmVudCknKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHZpc2liaWxpdHkob3V0bGluZXIubG9jYXRvcignLnRhYldlbGwtY2xvc2UnKSksICd2aXNpYmxlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZnKG91dGxpbmVyKSwgYXdhaXQgcmVzb2x2ZShwYWdlLCAnY29sb3InLCAndmFyKC0tZm9yZWdyb3VuZC1ob3ZlciknKSk7XG5cblx0XHRhd2FpdCBvdXRsaW5lci5jbGljaygpO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3NlcyhvdXRsaW5lcikpLmluY2x1ZGVzKCd0YWJXZWxsLXRhYi0tZm9yZWdyb3VuZCcpKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXMob3V0bGluZXIpKS5pbmNsdWRlcygndGFiV2VsbC10YWItLWFjdGl2ZScpKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBjbGFzc2VzKHRhYignZGV0YWlscycpKSkuaW5jbHVkZXMoJ3RhYldlbGwtdGFiLS1mb3JlZ3JvdW5kJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZyhvdXRsaW5lciksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2JhY2tncm91bmQtY29sb3InLCAndmFyKC0tcGFuZWwpJykpO1xuXHRcdGFzc2VydC5vayhhd2FpdCBzdGFjay5sb2NhdG9yKCdbZGF0YS1wYW5lbD1cIm91dGxpbmVyXCJdJykuaXNWaXNpYmxlKCkpO1xuXHRcdGFzc2VydC5vayhhd2FpdCBzdGFjay5sb2NhdG9yKCdbZGF0YS1wYW5lbD1cImRldGFpbHNcIl0nKS5pc0hpZGRlbigpKTtcblx0XHRhc3NlcnQubWF0Y2goYXdhaXQgc3RhY2subG9jYXRvcignLnRhYldlbGwtY29udGVudCcpLmlubmVyVGV4dCgpLCAvT3V0bGluZXIgcGFuZWwvKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGVycm9ycywgW10pO1xuXHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0fSk7XG59KTtcblxudGVzdCgnVGFiV2VsbDogY2xvc2UgcmVtb3ZlcyB0aGUgdGFiLCB0aGUgbGVmdCBuZWlnaGJvdXIgdGFrZXMgb3ZlciwgdGhlIGxhc3QgY2xvc2UgbGVhdmVzIGFuIGVtcHR5IHdlbGwnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdUYWJXZWxsJyk7XG5cdFx0Y29uc3Qgc3RhY2sgPSBwYWdlLmxvY2F0b3IoJ3VlLXRhYi13ZWxsJykubnRoKDApO1xuXHRcdGNvbnN0IHRhYnMgPSBzdGFjay5sb2NhdG9yKCcudGFiV2VsbC13ZWxsID4gLnRhYldlbGwtdGFiJyk7XG5cdFx0Y29uc3QgdGFiID0gKG5hbWU6IHN0cmluZyk6IExvY2F0b3IgPT4gc3RhY2subG9jYXRvcignLnRhYldlbGwtdGFiW2RhdGEtdGFiPVwiJyArIG5hbWUgKyAnXCJdJyk7XG5cdFx0YXdhaXQgdGFiKCdjb250ZW50JykuY2xpY2soKTtcblx0XHRhd2FpdCB0YWIoJ2NvbnRlbnQnKS5sb2NhdG9yKCcudGFiV2VsbC1jbG9zZScpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCBuYW1lcyh0YWJzKSwgWydkZXRhaWxzJywgJ291dGxpbmVyJ10pO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgY2xhc3Nlcyh0YWIoJ291dGxpbmVyJykpKS5pbmNsdWRlcygndGFiV2VsbC10YWItLWZvcmVncm91bmQnKSk7XG5cdFx0YXdhaXQgdGFiKCdvdXRsaW5lcicpLmxvY2F0b3IoJy50YWJXZWxsLWNsb3NlJykuY2xpY2soKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXModGFiKCdkZXRhaWxzJykpKS5pbmNsdWRlcygndGFiV2VsbC10YWItLWZvcmVncm91bmQnKSk7XG5cdFx0YXdhaXQgdGFiKCdkZXRhaWxzJykubG9jYXRvcignLnRhYldlbGwtY2xvc2UnKS5jbGljaygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCB0YWJzLmNvdW50KCksIDApO1xuXHRcdGFzc2VydC5vaygoYXdhaXQgc3RhY2subG9jYXRvcignLnRhYldlbGwtd2VsbCcpLmJvdW5kaW5nQm94KCkpIS5oZWlnaHQgPj0gMjUsICd0aGUgZW1wdHkgd2VsbCBrZWVwcyBpdHMgaGVpZ2h0Jyk7XG5cdFx0YXdhaXQgc3RhY2subG9jYXRvcignLnRhYldlbGwtcmVzZXQnKS5jbGljaygpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgbmFtZXModGFicyksIFsnZGV0YWlscycsICdvdXRsaW5lcicsICdjb250ZW50J10pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdUYWJXZWxsOiB0aGUgbWFqb3Igc3RhY2sgd29ya3Mgb24gaXRzIG93biBhbmQgbmV2ZXIgc2hvd3MgdGhlIGFjdGl2ZSBsaW5lJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnVGFiV2VsbCcpO1xuXHRcdGNvbnN0IG1pbm9yID0gcGFnZS5sb2NhdG9yKCd1ZS10YWItd2VsbCcpLm50aCgwKTtcblx0XHRjb25zdCBtYWpvciA9IHBhZ2UubG9jYXRvcigndWUtdGFiLXdlbGwnKS5udGgoMSk7XG5cdFx0Y29uc3Qgc2Vjb25kID0gbWFqb3IubG9jYXRvcignLnRhYldlbGwtdGFiW2RhdGEtdGFiPVwibGV2ZWwyXCJdJyk7XG5cdFx0YXdhaXQgc2Vjb25kLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKChhd2FpdCBjbGFzc2VzKHNlY29uZCkpLmluY2x1ZGVzKCd0YWJXZWxsLXRhYi0tZm9yZWdyb3VuZCcpKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXMoc2Vjb25kKSkuaW5jbHVkZXMoJ3RhYldlbGwtdGFiLS1hY3RpdmUnKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGxpbmVDb250ZW50KHNlY29uZCksICdub25lJyk7XG5cdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgY2xhc3NlcyhtaW5vci5sb2NhdG9yKCcudGFiV2VsbC10YWJbZGF0YS10YWI9XCJkZXRhaWxzXCJdJykpKS5pbmNsdWRlcygndGFiV2VsbC10YWItLWFjdGl2ZScpLCAndGhlIG1pbm9yIHN0YWNrIGxvc3QgdGhlIGFjdGl2ZSBzdGF0ZScpO1xuXHRcdGFzc2VydC5vayhhd2FpdCBtYWpvci5sb2NhdG9yKCdbZGF0YS1wYW5lbD1cImxldmVsMlwiXScpLmlzVmlzaWJsZSgpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcobWFqb3IubG9jYXRvcignLnRhYldlbGwtY29udGVudCcpKSwgYXdhaXQgcmVzb2x2ZShwYWdlLCAnYmFja2dyb3VuZC1jb2xvcicsICd2YXIoLS1iYWNrZ3JvdW5kKScpKTtcblx0XHRhd2FpdCBtaW5vci5sb2NhdG9yKCcudGFiV2VsbC10YWJbZGF0YS10YWI9XCJvdXRsaW5lclwiXScpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm5vdEVxdWFsKGF3YWl0IGxpbmVDb250ZW50KG1pbm9yLmxvY2F0b3IoJy50YWJXZWxsLXRhYltkYXRhLXRhYj1cIm91dGxpbmVyXCJdJykpLCAnbm9uZScpO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IGNsYXNzZXMoc2Vjb25kKSkuaW5jbHVkZXMoJ3RhYldlbGwtdGFiLS1hY3RpdmUnKSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1RhYldlbGw6IGtleWJvYXJkIG1vdmVzIGJldHdlZW4gdGFicyBhbmQgRGVsZXRlIGNsb3NlcycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgd2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRjb25zdCB7IHBhZ2UsIGVycm9ycyB9ID0gYXdhaXQgb3BlblByZXZpZXcoYnJvd3NlciwgJ1RhYldlbGwnKTtcblx0XHRjb25zdCBzdGFjayA9IHBhZ2UubG9jYXRvcigndWUtdGFiLXdlbGwnKS5udGgoMCk7XG5cdFx0YXdhaXQgc3RhY2subG9jYXRvcignLnRhYldlbGwtdGFiW2RhdGEtdGFiPVwiZGV0YWlsc1wiXScpLmZvY3VzKCk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnQXJyb3dSaWdodCcpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmb2N1c2VkVGFiKHBhZ2UpLCAnb3V0bGluZXInKTtcblx0XHRhc3NlcnQub2soYXdhaXQgc3RhY2subG9jYXRvcignW2RhdGEtcGFuZWw9XCJvdXRsaW5lclwiXScpLmlzVmlzaWJsZSgpKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd0xlZnQnKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd0xlZnQnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZm9jdXNlZFRhYihwYWdlKSwgJ2NvbnRlbnQnLCAnd3JhcHMgdG8gdGhlIGxhc3QgdGFiJyk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnSG9tZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmb2N1c2VkVGFiKHBhZ2UpLCAnZGV0YWlscycpO1xuXHRcdGF3YWl0IHBhZ2Uua2V5Ym9hcmQucHJlc3MoJ0RlbGV0ZScpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgbmFtZXMoc3RhY2subG9jYXRvcignLnRhYldlbGwtd2VsbCA+IC50YWJXZWxsLXRhYicpKSwgWydvdXRsaW5lcicsICdjb250ZW50J10pO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tIFdpbmRvd0Nocm9tZSAtLS0tLS0tLS0tXG5cbnRlc3QoJ1dpbmRvd0Nocm9tZTogdGhlIGJ1dHRvbnMgc2hvdyB0aGVpciBob3ZlciBmaWxscyBhbmQgdGhlIHByZXNzZWQgc3RhdGUgZHJvcHMgdGhlIGZpbGwnLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdXaW5kb3dDaHJvbWUnKTtcblx0XHRjb25zdCBmcmFtZSA9IHBhZ2UubG9jYXRvcignLndpbmRvd0Nocm9tZS1mcmFtZScpO1xuXHRcdGNvbnN0IG1pbmltaXplID0gZnJhbWUubG9jYXRvcignW2RhdGEtYWN0aW9uPVwibWluaW1pemVcIl0nKTtcblx0XHRjb25zdCBjbG9zZSA9IGZyYW1lLmxvY2F0b3IoJ1tkYXRhLWFjdGlvbj1cImNsb3NlXCJdJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKG1pbmltaXplKSwgVFJBTlNQQVJFTlQpO1xuXG5cdFx0YXdhaXQgbWluaW1pemUuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcobWluaW1pemUpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdiYWNrZ3JvdW5kLWNvbG9yJywgJ3JnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNTcpJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmZyhtaW5pbWl6ZSksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2NvbG9yJywgJ3ZhcigtLWZvcmVncm91bmQtaG92ZXIpJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZyhwYWdlLmxvY2F0b3IoJy53aW5kb3dDaHJvbWUtYnRuLS1ob3ZlcltkYXRhLXBpbm5lZF0nKS5maXJzdCgpKSwgYXdhaXQgYmcobWluaW1pemUpLCAnbGl2ZSBob3ZlciBlcXVhbHMgdGhlIHBpbm5lZCBob3ZlciBzcGVjaW1lbicpO1xuXG5cdFx0YXdhaXQgY2xvc2UuaG92ZXIoKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcoY2xvc2UpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdiYWNrZ3JvdW5kLWNvbG9yJywgJ3JnYmEoMjU1LCA3OSwgNzksIDAuNTg4KScpKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcobWluaW1pemUpLCBUUkFOU1BBUkVOVCwgJ3RoZSBmaWxsIGZvbGxvd3MgdGhlIHBvaW50ZXInKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLmRvd24oKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcoY2xvc2UpLCBUUkFOU1BBUkVOVCwgJ3ByZXNzZWQgaGFzIG5vIGZpbGwnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZmcoY2xvc2UpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdjb2xvcicsICd2YXIoLS1mb3JlZ3JvdW5kKScpKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoMiwgMik7XG5cdFx0YXdhaXQgcGFnZS5tb3VzZS51cCgpO1xuXHRcdGFzc2VydC5vayhhd2FpdCBmcmFtZS5pc1Zpc2libGUoKSwgJ3JlbGVhc2luZyBvdXRzaWRlIHRoZSBidXR0b24gZG9lcyBub3QgY2xvc2UgdGhlIHdpbmRvdycpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn0pO1xuXG50ZXN0KCdXaW5kb3dDaHJvbWU6IG1heGltaXplIHRvZ2dsZXMgdG8gdGhlIHJlc3RvcmUgZ2x5cGggYW5kIGJhY2snLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdXaW5kb3dDaHJvbWUnKTtcblx0XHRjb25zdCBmcmFtZSA9IHBhZ2UubG9jYXRvcignLndpbmRvd0Nocm9tZS1mcmFtZScpO1xuXHRcdGNvbnN0IG1heGltaXplID0gZnJhbWUubG9jYXRvcignW2RhdGEtYWN0aW9uPVwibWF4aW1pemVcIl0nKTtcblx0XHRjb25zdCBnbHlwaCA9IG1heGltaXplLmxvY2F0b3IoJ3VzZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBnbHlwaC5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyN3aW5kb3dDaHJvbWUtaS1tYXgnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgbWF4aW1pemUuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksICdNYXhpbWl6ZScpO1xuXHRcdGF3YWl0IG1heGltaXplLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGdseXBoLmdldEF0dHJpYnV0ZSgnaHJlZicpLCAnI3dpbmRvd0Nocm9tZS1pLXJlc3RvcmUnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgbWF4aW1pemUuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksICdSZXN0b3JlIERvd24nKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZnJhbWUuZ2V0QXR0cmlidXRlKCdkYXRhLW1heGltaXplZCcpLCAnJyk7XG5cdFx0YXdhaXQgbWF4aW1pemUuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZ2x5cGguZ2V0QXR0cmlidXRlKCdocmVmJyksICcjd2luZG93Q2hyb21lLWktbWF4Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZyYW1lLmdldEF0dHJpYnV0ZSgnZGF0YS1tYXhpbWl6ZWQnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1dpbmRvd0Nocm9tZTogbWluaW1pemUgYW5kIGNsb3NlIGhpZGUgdGhlIHdpbmRvdyBhbmQgdGhlIHJlc3RvcmUgYnV0dG9uIGJyaW5ncyBpdCBiYWNrJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnV2luZG93Q2hyb21lJyk7XG5cdFx0Y29uc3QgZnJhbWUgPSBwYWdlLmxvY2F0b3IoJy53aW5kb3dDaHJvbWUtZnJhbWUnKTtcblx0XHRjb25zdCByZW9wZW4gPSBwYWdlLmxvY2F0b3IoJy53aW5kb3dDaHJvbWUtcmVvcGVuJyk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHJlb3Blbi5pc0hpZGRlbigpKTtcblx0XHRhd2FpdCBmcmFtZS5sb2NhdG9yKCdbZGF0YS1hY3Rpb249XCJjbG9zZVwiXScpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IGZyYW1lLmlzSGlkZGVuKCkpO1xuXHRcdGFzc2VydC5vayhhd2FpdCByZW9wZW4uaXNWaXNpYmxlKCkpO1xuXHRcdGF3YWl0IHJlb3Blbi5jbGljaygpO1xuXHRcdGFzc2VydC5vayhhd2FpdCBmcmFtZS5pc1Zpc2libGUoKSk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IHJlb3Blbi5pc0hpZGRlbigpKTtcblx0XHRhd2FpdCBmcmFtZS5sb2NhdG9yKCdbZGF0YS1hY3Rpb249XCJtaW5pbWl6ZVwiXScpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IGZyYW1lLmlzSGlkZGVuKCkpO1xuXHRcdGF3YWl0IHBhZ2Uua2V5Ym9hcmQucHJlc3MoJ0VudGVyJyk7XG5cdFx0YXNzZXJ0Lm9rKGF3YWl0IGZyYW1lLmlzVmlzaWJsZSgpLCAndGhlIHJlc3RvcmUgYnV0dG9uIGlzIGtleWJvYXJkIG9wZXJhYmxlJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1dpbmRvd0Nocm9tZTogdGhlIHdpbmRvdyBzdGF0ZSBmb2xsb3dzIGZvY3VzJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnV2luZG93Q2hyb21lJyk7XG5cdFx0Y29uc3QgZnJhbWUgPSBwYWdlLmxvY2F0b3IoJy53aW5kb3dDaHJvbWUtZnJhbWUnKTtcblx0XHRjb25zdCBzdGF0dXMgPSBwYWdlLmxvY2F0b3IoJy53aW5kb3dDaHJvbWUtc3RhdHVzJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZyYW1lLmdldEF0dHJpYnV0ZSgnZGF0YS1hY3RpdmUnKSwgJ2ZhbHNlJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN0YXR1cy5pbm5lclRleHQoKSwgJ1dpbmRvdyBpbmFjdGl2ZScpO1xuXHRcdGF3YWl0IHBhZ2UubG9jYXRvcignLndpbmRvd0Nocm9tZS1jb250ZW50JykuY2xpY2soKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZnJhbWUuZ2V0QXR0cmlidXRlKCdkYXRhLWFjdGl2ZScpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBzdGF0dXMuaW5uZXJUZXh0KCksICdXaW5kb3cgYWN0aXZlJyk7XG5cdFx0YXdhaXQgZnJhbWUubG9jYXRvcignW2RhdGEtYWN0aW9uPVwibWF4aW1pemVcIl0nKS5mb2N1cygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmcmFtZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYWN0aXZlJyksICd0cnVlJywgJ2ZvY3VzIG1vdmluZyBpbnNpZGUgdGhlIHdpbmRvdyBrZWVwcyBpdCBhY3RpdmUnKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLmNsaWNrKDkwMCwgNzAwKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZnJhbWUuZ2V0QXR0cmlidXRlKCdkYXRhLWFjdGl2ZScpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhdHVzLmlubmVyVGV4dCgpLCAnV2luZG93IGluYWN0aXZlJyk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnVGFiJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZyYW1lLmdldEF0dHJpYnV0ZSgnZGF0YS1hY3RpdmUnKSwgJ3RydWUnLCAndGFiYmluZyBpbnRvIHRoZSB3aW5kb3cgYWN0aXZhdGVzIGl0Jyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1dpbmRvd0Nocm9tZTogcGlubmVkIGJ1dHRvbiBzcGVjaW1lbnMgaWdub3JlIHRoZSBwb2ludGVyJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnV2luZG93Q2hyb21lJyk7XG5cdFx0Y29uc3QgcGlubmVkID0gcGFnZS5sb2NhdG9yKCcud2luZG93Q2hyb21lLXN0YXRlcyAud2luZG93Q2hyb21lLWJ0bi0tY2xvc2UnKS5maXJzdCgpO1xuXHRcdGF3YWl0IHBpbm5lZC5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZyhwaW5uZWQpLCBUUkFOU1BBUkVOVCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcigndWUtd2luZG93LWNocm9tZScpLmNvdW50KCksIDEpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJ1tkYXRhLXBpbm5lZF0gdWUtd2luZG93LWNocm9tZSwgdWUtd2luZG93LWNocm9tZSBbZGF0YS1waW5uZWRdJykuY291bnQoKSwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gU3BsaXR0ZXIgLS0tLS0tLS0tLVxuXG5pbnRlcmZhY2UgU2l6ZXMgeyBiZWZvcmU6IG51bWJlcjsgYWZ0ZXI6IG51bWJlciB9XG5cbmFzeW5jIGZ1bmN0aW9uIHNpemVzKGRlbW86IExvY2F0b3IsIGF4aXM6ICd3aWR0aCcgfCAnaGVpZ2h0Jyk6IFByb21pc2U8U2l6ZXM+IHtcblx0Y29uc3QgcGFuZXMgPSBkZW1vLmxvY2F0b3IoJy5zcGxpdHRlci1wYW5lJyk7XG5cdGNvbnN0IGZpcnN0ID0gYXdhaXQgcGFuZXMubnRoKDApLmJvdW5kaW5nQm94KCk7XG5cdGNvbnN0IHNlY29uZCA9IGF3YWl0IHBhbmVzLm50aCgxKS5ib3VuZGluZ0JveCgpO1xuXHRyZXR1cm4geyBiZWZvcmU6IGZpcnN0IVtheGlzXSwgYWZ0ZXI6IHNlY29uZCFbYXhpc10gfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZHJhZ0hhbmRsZShwYWdlOiBQYWdlLCBoYW5kbGU6IExvY2F0b3IsIGR4OiBudW1iZXIsIGR5OiBudW1iZXIsIHJlbGVhc2UgPSB0cnVlKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGJveCA9IChhd2FpdCBoYW5kbGUuYm91bmRpbmdCb3goKSkhO1xuXHRjb25zdCB4ID0gYm94LnggKyBib3gud2lkdGggLyAyO1xuXHRjb25zdCB5ID0gYm94LnkgKyBib3guaGVpZ2h0IC8gMjtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKHgsIHkpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLmRvd24oKTtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKHggKyBkeCAvIDIsIHkgKyBkeSAvIDIsIHsgc3RlcHM6IDQgfSk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZSh4ICsgZHgsIHkgKyBkeSwgeyBzdGVwczogNCB9KTtcblx0aWYgKHJlbGVhc2UpIGF3YWl0IHBhZ2UubW91c2UudXAoKTtcbn1cblxudGVzdCgnU3BsaXR0ZXI6IGhvdmVyIHNob3dzIHRoZSBzZWNvbmRhcnkgZmlsbCBhbmQgdGhlIHJlc2l6ZSBjdXJzb3InLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdTcGxpdHRlcicpO1xuXHRcdGNvbnN0IHJvdyA9IHBhZ2UubG9jYXRvcigndWUtc3BsaXR0ZXInKS5udGgoMCkubG9jYXRvcignLnNwbGl0dGVyLWhhbmRsZScpO1xuXHRcdGNvbnN0IGNvbCA9IHBhZ2UubG9jYXRvcigndWUtc3BsaXR0ZXInKS5udGgoMSkubG9jYXRvcignLnNwbGl0dGVyLWhhbmRsZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZyhyb3cpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdiYWNrZ3JvdW5kLWNvbG9yJywgJ3ZhcigtLWJhY2tncm91bmQpJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCByb3cuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5jdXJzb3IpLCAnY29sLXJlc2l6ZScpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBjb2wuZXZhbHVhdGUoKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5jdXJzb3IpLCAncm93LXJlc2l6ZScpO1xuXHRcdGF3YWl0IHJvdy5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZyhyb3cpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdiYWNrZ3JvdW5kLWNvbG9yJywgJ3ZhcigtLXNlY29uZGFyeSknKSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKHBhZ2UubG9jYXRvcignLnNwbGl0dGVyLWhhbmRsZS0taGlnaGxpZ2h0W2RhdGEtcGlubmVkXScpLmZpcnN0KCkpLCBhd2FpdCBiZyhyb3cpLCAnbGl2ZSBob3ZlciBlcXVhbHMgdGhlIHBpbm5lZCBoaWdobGlnaHQnKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoMiwgMik7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKHJvdyksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2JhY2tncm91bmQtY29sb3InLCAndmFyKC0tYmFja2dyb3VuZCknKSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1NwbGl0dGVyOiBkcmFnZ2luZyB0aGUgaG9yaXpvbnRhbCBoYW5kbGUgcmVzaXplcyBib3RoIHBhbmVzIGFuZCBob2xkcyB0aGUgcHJlc3NlZCBjb2xvdXInLCBhc3luYyAoKSA9PiB7XG5cdGF3YWl0IHdpdGhCcm93c2VyKGFzeW5jIChicm93c2VyKSA9PiB7XG5cdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsICdTcGxpdHRlcicpO1xuXHRcdGNvbnN0IGRlbW8gPSBwYWdlLmxvY2F0b3IoJ3VlLXNwbGl0dGVyJykubnRoKDApLmxvY2F0b3IoJy5zcGxpdHRlci1kZW1vJyk7XG5cdFx0Y29uc3QgaGFuZGxlID0gZGVtby5sb2NhdG9yKCcuc3BsaXR0ZXItaGFuZGxlJyk7XG5cdFx0Y29uc3Qgc3RhcnQgPSBhd2FpdCBzaXplcyhkZW1vLCAnd2lkdGgnKTtcblx0XHRhd2FpdCBkcmFnSGFuZGxlKHBhZ2UsIGhhbmRsZSwgNDAsIDAsIGZhbHNlKTtcblx0XHRhc3NlcnQub2soKGF3YWl0IGNsYXNzZXMoaGFuZGxlKSkuaW5jbHVkZXMoJ3NwbGl0dGVyLWhhbmRsZS0taGlnaGxpZ2h0JyksICdkcmFnZ2luZyBrZWVwcyB0aGUgaGlnaGxpZ2h0Jyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKGhhbmRsZSksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2JhY2tncm91bmQtY29sb3InLCAndmFyKC0tc2Vjb25kYXJ5KScpKTtcblx0XHRhd2FpdCBwYWdlLm1vdXNlLnVwKCk7XG5cdFx0Y29uc3QgZW5kID0gYXdhaXQgc2l6ZXMoZGVtbywgJ3dpZHRoJyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGVuZC5iZWZvcmUgLSAoc3RhcnQuYmVmb3JlICsgNDApKSA8PSAxLCAndGhlIGZpcnN0IHBhbmUgZ3JldyBieSB0aGUgZHJhZyBkaXN0YW5jZTogJyArIHN0YXJ0LmJlZm9yZSArICcgdG8gJyArIGVuZC5iZWZvcmUpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhlbmQuYWZ0ZXIgLSAoc3RhcnQuYWZ0ZXIgLSA0MCkpIDw9IDEsICd0aGUgc2Vjb25kIHBhbmUgc2hyYW5rIGJ5IHRoZSBzYW1lIGRpc3RhbmNlJyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGVuZC5iZWZvcmUgKyBlbmQuYWZ0ZXIgLSAoc3RhcnQuYmVmb3JlICsgc3RhcnQuYWZ0ZXIpKSA8PSAxLCAndGhlIHBhbmVzIHN0aWxsIGZpbGwgdGhlIHNhbWUgc3BhY2UnKTtcblx0XHRhc3NlcnQub2soIShhd2FpdCBjbGFzc2VzKGhhbmRsZSkpLmluY2x1ZGVzKCdzcGxpdHRlci1oYW5kbGUtLWhpZ2hsaWdodCcpLCAndGhlIGhpZ2hsaWdodCBjbGFzcyBsZWF2ZXMgd2l0aCB0aGUgZHJhZycpO1xuXHRcdGF3YWl0IHBhZ2UubW91c2UubW92ZSgyLCAyKTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgYmcoaGFuZGxlKSwgYXdhaXQgcmVzb2x2ZShwYWdlLCAnYmFja2dyb3VuZC1jb2xvcicsICd2YXIoLS1iYWNrZ3JvdW5kKScpKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGVycm9ycywgW10pO1xuXHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0fSk7XG59KTtcblxudGVzdCgnU3BsaXR0ZXI6IG5vIHBhbmUgc2hyaW5rcyBiZWxvdyB0aGUgbWluaW11bSBzaXplJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnU3BsaXR0ZXInKTtcblx0XHRjb25zdCBkZW1vID0gcGFnZS5sb2NhdG9yKCd1ZS1zcGxpdHRlcicpLm50aCgwKS5sb2NhdG9yKCcuc3BsaXR0ZXItZGVtbycpO1xuXHRcdGNvbnN0IGhhbmRsZSA9IGRlbW8ubG9jYXRvcignLnNwbGl0dGVyLWhhbmRsZScpO1xuXHRcdGNvbnN0IHN0YXJ0ID0gYXdhaXQgc2l6ZXMoZGVtbywgJ3dpZHRoJyk7XG5cdFx0Y29uc3QgdG90YWwgPSBzdGFydC5iZWZvcmUgKyBzdGFydC5hZnRlcjtcblx0XHRhd2FpdCBkcmFnSGFuZGxlKHBhZ2UsIGhhbmRsZSwgMzAwMCwgMCk7XG5cdFx0bGV0IGVuZCA9IGF3YWl0IHNpemVzKGRlbW8sICd3aWR0aCcpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhlbmQuYWZ0ZXIgLSAyMCkgPD0gMSwgJ3RoZSBzZWNvbmQgcGFuZSBzdG9wcyBhdCAyMCBidXQgaXMgJyArIGVuZC5hZnRlcik7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGVuZC5iZWZvcmUgLSAodG90YWwgLSAyMCkpIDw9IDEpO1xuXHRcdGF3YWl0IGRyYWdIYW5kbGUocGFnZSwgaGFuZGxlLCAtMzAwMCwgMCk7XG5cdFx0ZW5kID0gYXdhaXQgc2l6ZXMoZGVtbywgJ3dpZHRoJyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGVuZC5iZWZvcmUgLSAyMCkgPD0gMSwgJ3RoZSBmaXJzdCBwYW5lIHN0b3BzIGF0IDIwIGJ1dCBpcyAnICsgZW5kLmJlZm9yZSk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGVuZC5hZnRlciAtICh0b3RhbCAtIDIwKSkgPD0gMSk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1NwbGl0dGVyOiBkcmFnZ2luZyB0aGUgdmVydGljYWwgaGFuZGxlIHJlc2l6ZXMgdGhlIHBhbmUgaGVpZ2h0cycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgd2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRjb25zdCB7IHBhZ2UsIGVycm9ycyB9ID0gYXdhaXQgb3BlblByZXZpZXcoYnJvd3NlciwgJ1NwbGl0dGVyJyk7XG5cdFx0Y29uc3QgZGVtbyA9IHBhZ2UubG9jYXRvcigndWUtc3BsaXR0ZXInKS5udGgoMSkubG9jYXRvcignLnNwbGl0dGVyLWRlbW8nKTtcblx0XHRjb25zdCBoYW5kbGUgPSBkZW1vLmxvY2F0b3IoJy5zcGxpdHRlci1oYW5kbGUnKTtcblx0XHRjb25zdCBzdGFydCA9IGF3YWl0IHNpemVzKGRlbW8sICdoZWlnaHQnKTtcblx0XHRhd2FpdCBkcmFnSGFuZGxlKHBhZ2UsIGhhbmRsZSwgMCwgLTMwKTtcblx0XHRjb25zdCBlbmQgPSBhd2FpdCBzaXplcyhkZW1vLCAnaGVpZ2h0Jyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKGVuZC5iZWZvcmUgLSAoc3RhcnQuYmVmb3JlIC0gMzApKSA8PSAxLCAndGhlIHRvcCBwYW5lIHNocmFuayBieSB0aGUgZHJhZyBkaXN0YW5jZScpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhlbmQuYWZ0ZXIgLSAoc3RhcnQuYWZ0ZXIgKyAzMCkpIDw9IDEpO1xuXHRcdGNvbnN0IHdpZHRocyA9IGF3YWl0IHNpemVzKGRlbW8sICd3aWR0aCcpO1xuXHRcdGFzc2VydC5lcXVhbCh3aWR0aHMuYmVmb3JlLCB3aWR0aHMuYWZ0ZXIsICdhIHZlcnRpY2FsIGRyYWcgbGVhdmVzIHRoZSB3aWR0aHMgYWxvbmUnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGVycm9ycywgW10pO1xuXHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0fSk7XG59KTtcblxudGVzdCgnU3BsaXR0ZXI6IGFycm93IGtleXMgbW92ZSBhIGZvY3VzZWQgaGFuZGxlIGJ5IGEgZmV3IHBpeGVscycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgd2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRjb25zdCB7IHBhZ2UsIGVycm9ycyB9ID0gYXdhaXQgb3BlblByZXZpZXcoYnJvd3NlciwgJ1NwbGl0dGVyJyk7XG5cdFx0Y29uc3QgZGVtbyA9IHBhZ2UubG9jYXRvcigndWUtc3BsaXR0ZXInKS5udGgoMCkubG9jYXRvcignLnNwbGl0dGVyLWRlbW8nKTtcblx0XHRjb25zdCBoYW5kbGUgPSBkZW1vLmxvY2F0b3IoJy5zcGxpdHRlci1oYW5kbGUnKTtcblx0XHRjb25zdCBzdGFydCA9IGF3YWl0IHNpemVzKGRlbW8sICd3aWR0aCcpO1xuXHRcdGF3YWl0IGhhbmRsZS5mb2N1cygpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBiZyhoYW5kbGUpLCBhd2FpdCByZXNvbHZlKHBhZ2UsICdiYWNrZ3JvdW5kLWNvbG9yJywgJ3ZhcigtLXNlY29uZGFyeSknKSwgJ2tleWJvYXJkIGZvY3VzIHNob3dzIHRoZSBoaWdobGlnaHQnKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd1JpZ2h0Jyk7XG5cdFx0bGV0IG5vdyA9IGF3YWl0IHNpemVzKGRlbW8sICd3aWR0aCcpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicyhub3cuYmVmb3JlIC0gKHN0YXJ0LmJlZm9yZSArIDUpKSA8PSAwLjUsICdBcnJvd1JpZ2h0IGdyb3dzIHRoZSBmaXJzdCBwYW5lIGJ5IDUnKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdTaGlmdCtBcnJvd1JpZ2h0Jyk7XG5cdFx0bm93ID0gYXdhaXQgc2l6ZXMoZGVtbywgJ3dpZHRoJyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKG5vdy5iZWZvcmUgLSAoc3RhcnQuYmVmb3JlICsgMjUpKSA8PSAwLjUsICdTaGlmdCtBcnJvd1JpZ2h0IGdyb3dzIGl0IGJ5IDIwIG1vcmUnKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd0xlZnQnKTtcblx0XHRub3cgPSBhd2FpdCBzaXplcyhkZW1vLCAnd2lkdGgnKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMobm93LmJlZm9yZSAtIChzdGFydC5iZWZvcmUgKyAyMCkpIDw9IDAuNSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhhbmRsZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtdmFsdWVub3cnKSwgU3RyaW5nKE1hdGgucm91bmQobm93LmJlZm9yZSkpKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd0Rvd24nKTtcblx0XHRjb25zdCB1bmNoYW5nZWQgPSBhd2FpdCBzaXplcyhkZW1vLCAnd2lkdGgnKTtcblx0XHRhc3NlcnQuZXF1YWwodW5jaGFuZ2VkLmJlZm9yZSwgbm93LmJlZm9yZSwgJ2EgaG9yaXpvbnRhbCBoYW5kbGUgaWdub3JlcyB0aGUgdmVydGljYWwgYXJyb3dzJyk7XG5cdFx0YXdhaXQgcGFnZS5rZXlib2FyZC5wcmVzcygnSG9tZScpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicygoYXdhaXQgc2l6ZXMoZGVtbywgJ3dpZHRoJykpLmJlZm9yZSAtIDIwKSA8PSAwLjUpO1xuXHRcdGF3YWl0IHBhZ2Uua2V5Ym9hcmQucHJlc3MoJ0VuZCcpO1xuXHRcdGFzc2VydC5vayhNYXRoLmFicygoYXdhaXQgc2l6ZXMoZGVtbywgJ3dpZHRoJykpLmFmdGVyIC0gMjApIDw9IDAuNSk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhhbmRsZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtdmFsdWVtaW4nKSwgJzIwJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdKTtcblx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdH0pO1xufSk7XG5cbnRlc3QoJ1NwbGl0dGVyOiB0aGUgdmVydGljYWwgaGFuZGxlIGFuc3dlcnMgdGhlIHVwIGFuZCBkb3duIGFycm93cycsIGFzeW5jICgpID0+IHtcblx0YXdhaXQgd2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRjb25zdCB7IHBhZ2UsIGVycm9ycyB9ID0gYXdhaXQgb3BlblByZXZpZXcoYnJvd3NlciwgJ1NwbGl0dGVyJyk7XG5cdFx0Y29uc3QgZGVtbyA9IHBhZ2UubG9jYXRvcigndWUtc3BsaXR0ZXInKS5udGgoMSkubG9jYXRvcignLnNwbGl0dGVyLWRlbW8nKTtcblx0XHRjb25zdCBoYW5kbGUgPSBkZW1vLmxvY2F0b3IoJy5zcGxpdHRlci1oYW5kbGUnKTtcblx0XHRjb25zdCBzdGFydCA9IGF3YWl0IHNpemVzKGRlbW8sICdoZWlnaHQnKTtcblx0XHRhd2FpdCBoYW5kbGUuZm9jdXMoKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd0Rvd24nKTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd0Rvd24nKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnMoKGF3YWl0IHNpemVzKGRlbW8sICdoZWlnaHQnKSkuYmVmb3JlIC0gKHN0YXJ0LmJlZm9yZSArIDEwKSkgPD0gMC41KTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd1VwJyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKChhd2FpdCBzaXplcyhkZW1vLCAnaGVpZ2h0JykpLmJlZm9yZSAtIChzdGFydC5iZWZvcmUgKyA1KSkgPD0gMC41KTtcblx0XHRhd2FpdCBwYWdlLmtleWJvYXJkLnByZXNzKCdBcnJvd1JpZ2h0Jyk7XG5cdFx0YXNzZXJ0Lm9rKE1hdGguYWJzKChhd2FpdCBzaXplcyhkZW1vLCAnaGVpZ2h0JykpLmJlZm9yZSAtIChzdGFydC5iZWZvcmUgKyA1KSkgPD0gMC41LCAnYSB2ZXJ0aWNhbCBoYW5kbGUgaWdub3JlcyB0aGUgaG9yaXpvbnRhbCBhcnJvd3MnKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGVycm9ycywgW10pO1xuXHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0fSk7XG59KTtcblxudGVzdCgnU3BsaXR0ZXI6IHBpbm5lZCBoYW5kbGVzIHN0YXkgcGlubmVkJywgYXN5bmMgKCkgPT4ge1xuXHRhd2FpdCB3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCAnU3BsaXR0ZXInKTtcblx0XHRjb25zdCBwaW5uZWQgPSBwYWdlLmxvY2F0b3IoJy5zcGxpdHRlci1oYW5kbGVbZGF0YS1waW5uZWRdJykuZmlyc3QoKTtcblx0XHRjb25zdCBkZW1vID0gcGFnZS5sb2NhdG9yKCcuc3BsaXR0ZXItZGVtbycpLmZpbHRlcih7IGhhczogcGlubmVkIH0pO1xuXHRcdGNvbnN0IHN0YXJ0ID0gYXdhaXQgc2l6ZXMoZGVtbywgJ3dpZHRoJyk7XG5cdFx0YXdhaXQgcGlubmVkLmhvdmVyKCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJnKHBpbm5lZCksIGF3YWl0IHJlc29sdmUocGFnZSwgJ2JhY2tncm91bmQtY29sb3InLCAndmFyKC0tYmFja2dyb3VuZCknKSk7XG5cdFx0YXdhaXQgZHJhZ0hhbmRsZShwYWdlLCBwaW5uZWQsIDMwLCAwKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHNpemVzKGRlbW8sICd3aWR0aCcpLCBzdGFydCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBpbm5lZC5ldmFsdWF0ZSgoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmN1cnNvciksICdhdXRvJyk7XG5cdFx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcignW2RhdGEtcGlubmVkXSB1ZS1zcGxpdHRlciwgdWUtc3BsaXR0ZXIgW2RhdGEtcGlubmVkXScpLmNvdW50KCksIDApO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSk7XG5cdFx0YXdhaXQgcGFnZS5jbG9zZSgpO1xuXHR9KTtcbn0pO1xuIiwgIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBTaGFyZWQgaGVscGVycyBmb3IgdGhlIHByZXZpZXcgaW50ZXJhY3Rpb24gdGVzdHMuIFRoZSBET00gbGliIHR5cGVzIHRoZSBjYWxsYmFja3MgdGhhdCBydW4gaW4gdGhlIHBhZ2UuXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgaHR0cCBmcm9tICdub2RlOmh0dHAnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgeyBjaHJvbWl1bSwgdHlwZSBCcm93c2VyLCB0eXBlIFBhZ2UgfSBmcm9tICdwbGF5d3JpZ2h0JztcblxuY29uc3QgaGVyZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpO1xuZXhwb3J0IGNvbnN0IHJvb3QgPSBwYXRoLnJlc29sdmUoaGVyZSwgJy4uJywgJ2Rlc2lnbi1zeXN0ZW0nKTtcblxuaW50ZXJmYWNlIFRva2VuVmFsdWUgeyBbdGhlbWU6IHN0cmluZ106IHN0cmluZyB9XG5pbnRlcmZhY2UgVG9rZW5zIHtcblx0Y29sb3I6IHsgdGhlbWVzOiBBcnJheTx7IGlkOiBzdHJpbmcgfT47IHRva2VuczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfCBUb2tlblZhbHVlIH0+IH07XG5cdHNwYWNpbmc6IHsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9PiB9O1xuXHRyYWRpdXM6IHsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9PiB9O1xuXHR0eXBlOiB7IGZhbWlsaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH07XG59XG5cbi8vIEJ1aWxkcyB0aGUgdG9rZW5zLmNzcyB0aGF0IHRoZSBwcmV2aWV3IGZyYW1lIHByZWxvYWRzLCBmcm9tIHRva2Vucy5qc29uIChmaXJzdCB0aGVtZSkuXG5leHBvcnQgZnVuY3Rpb24gdG9rZW5zQ3NzKCk6IHN0cmluZyB7XG5cdGNvbnN0IHRva2VucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyb290LCAndG9rZW5zLmpzb24nKSwgJ3V0ZjgnKSkgYXMgVG9rZW5zO1xuXHRjb25zdCB0aGVtZSA9IHRva2Vucy5jb2xvci50aGVtZXNbMF0uaWQ7XG5cdGNvbnN0IHZhcnM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0IHJlc29sdmUgPSAodmFsdWU6IHN0cmluZyB8IFRva2VuVmFsdWUpOiBzdHJpbmcgPT4ge1xuXHRcdGNvbnN0IHJhdyA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyB2YWx1ZSA6IHZhbHVlW3RoZW1lXTtcblx0XHRjb25zdCBhbGlhcyA9IC9eXFx7KC4rKVxcfSQvLmV4ZWMocmF3KTtcblx0XHRyZXR1cm4gYWxpYXMgPyAndmFyKC0tJyArIGFsaWFzWzFdICsgJyknIDogcmF3O1xuXHR9O1xuXHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zLmNvbG9yLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgcmVzb2x2ZSh0LnZhbHVlKSArICc7Jyk7XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMuc3BhY2luZy50b2tlbnMpIHZhcnMucHVzaCgnLS0nICsgdC5uYW1lICsgJzogJyArIHQudmFsdWUgKyAnOycpO1xuXHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zLnJhZGl1cy50b2tlbnMpIHZhcnMucHVzaCgnLS0nICsgdC5uYW1lICsgJzogJyArIHQudmFsdWUgKyAnOycpO1xuXHRmb3IgKGNvbnN0IFtrZXksIHN0YWNrXSBvZiBPYmplY3QuZW50cmllcyh0b2tlbnMudHlwZS5mYW1pbGllcykpIHZhcnMucHVzaCgnLS1mb250LScgKyBrZXkgKyAnOiAnICsgc3RhY2sgKyAnOycpO1xuXHRyZXR1cm4gJzpyb290IHsgJyArIHZhcnMuam9pbignICcpICsgJyB9XFxuYm9keSB7IGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQpOyBjb2xvcjogdmFyKC0tZm9yZWdyb3VuZCk7IH0nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXcge1xuXHRwYWdlOiBQYWdlO1xuXHRlcnJvcnM6IHN0cmluZ1tdO1xufVxuXG5jb25zdCBNSU1FOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuXHQnLmh0bWwnOiAndGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04Jyxcblx0Jy5qcyc6ICd0ZXh0L2phdmFzY3JpcHQ7IGNoYXJzZXQ9dXRmLTgnLFxuXHQnLmNzcyc6ICd0ZXh0L2NzczsgY2hhcnNldD11dGYtOCcsXG5cdCcuanNvbic6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0Jy5wbmcnOiAnaW1hZ2UvcG5nJyxcblx0Jy5zdmcnOiAnaW1hZ2Uvc3ZnK3htbCcsXG59O1xuXG5sZXQgYmFzZVVybDogUHJvbWlzZTxzdHJpbmc+IHwgdW5kZWZpbmVkO1xuXG4vLyBTZXJ2ZXMgZGVzaWduLXN5c3RlbSBvdmVyIGh0dHAsIGJlY2F1c2UgQ2hyb21pdW0gYmxvY2tzIG1vZHVsZSBzY3JpcHRzIG9uIGZpbGU6Ly8uIE9uZSBzZXJ2ZXIgcGVyIHByb2Nlc3MuXG5leHBvcnQgZnVuY3Rpb24gc2VydmUoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0YmFzZVVybCA/Pz0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKChyZXEsIHJlcykgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZSA9IHBhdGguam9pbihyb290LCBkZWNvZGVVUklDb21wb25lbnQobmV3IFVSTChyZXEudXJsID8/ICcvJywgJ2h0dHA6Ly94JykucGF0aG5hbWUpKTtcblx0XHRcdGlmICghZmlsZS5zdGFydHNXaXRoKHJvb3QpIHx8ICFmcy5leGlzdHNTeW5jKGZpbGUpIHx8IGZzLnN0YXRTeW5jKGZpbGUpLmlzRGlyZWN0b3J5KCkpIHtcblx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDQpLmVuZCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXMud3JpdGVIZWFkKDIwMCwgeyAnY29udGVudC10eXBlJzogTUlNRVtwYXRoLmV4dG5hbWUoZmlsZSldID8/ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nIH0pO1xuXHRcdFx0ZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlKS5waXBlKHJlcyk7XG5cdFx0fSk7XG5cdFx0c2VydmVyLm9uKCdlcnJvcicsIHJlamVjdCk7XG5cdFx0c2VydmVyLmxpc3RlbigwLCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuXHRcdFx0c2VydmVyLnVucmVmKCk7XG5cdFx0XHRjb25zdCBhZGRyZXNzID0gc2VydmVyLmFkZHJlc3MoKTtcblx0XHRcdHJlc29sdmUoJ2h0dHA6Ly8xMjcuMC4wLjE6JyArICh0eXBlb2YgYWRkcmVzcyA9PT0gJ29iamVjdCcgJiYgYWRkcmVzcyA/IGFkZHJlc3MucG9ydCA6IDApKTtcblx0XHR9KTtcblx0fSk7XG5cdHJldHVybiBiYXNlVXJsO1xufVxuXG4vLyBUaGUgZGVzaWduIHN5c3RlbSBwYWdlIHByZWxvYWRzIGNvbXBvbmVudHMvYnVuZGxlLmpzIGFzIGEgY2xhc3NpYyBzY3JpcHQgYWhlYWQgb2YgdGhlIHByZXZpZXcgbWFya3VwLiBUZXN0cyBkbyB0aGUgc2FtZS5cbmV4cG9ydCBjb25zdCB3aXRoQnVuZGxlID0gKGh0bWw6IHN0cmluZyk6IHN0cmluZyA9PiBodG1sLnJlcGxhY2UoJzwvaGVhZD4nLCAnPHNjcmlwdCBzcmM9XCIvY29tcG9uZW50cy9idW5kbGUuanNcIj48L3NjcmlwdD48L2hlYWQ+Jyk7XG5cbi8vIE9wZW5zIGEgY29tcG9uZW50IHByZXZpZXcgd2l0aCB0aGUgdG9rZW5zIGluamVjdGVkLiBDb25zb2xlIGFuZCBwYWdlIGVycm9ycyBjb2xsZWN0IGluIGBlcnJvcnNgLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5QcmV2aWV3KGJyb3dzZXI6IEJyb3dzZXIsIG5hbWU6IHN0cmluZywgdmlld3BvcnQgPSB7IHdpZHRoOiAxMDAwLCBoZWlnaHQ6IDgwMCB9KTogUHJvbWlzZTxQcmV2aWV3PiB7XG5cdGNvbnN0IHBhZ2UgPSBhd2FpdCBicm93c2VyLm5ld1BhZ2UoeyB2aWV3cG9ydCB9KTtcblx0Y29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXHRwYWdlLm9uKCdwYWdlZXJyb3InLCAoZSkgPT4gZXJyb3JzLnB1c2goU3RyaW5nKGUpKSk7XG5cdHBhZ2Uub24oJ2NvbnNvbGUnLCAobSkgPT4ge1xuXHRcdGlmIChtLnR5cGUoKSA9PT0gJ2Vycm9yJyAmJiAhL2ZvbnRzXFwuZ3xFUlJffEZhaWxlZCB0byBsb2FkIHJlc291cmNlLy50ZXN0KG0udGV4dCgpKSkgZXJyb3JzLnB1c2gobS50ZXh0KCkpO1xuXHR9KTtcblx0YXdhaXQgcGFnZS5yb3V0ZSgnKiovY29tcG9uZW50cy8qL3ByZXZpZXcuaHRtbCcsIGFzeW5jIChyb3V0ZSkgPT4ge1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcm91dGUuZmV0Y2goKTtcblx0XHRhd2FpdCByb3V0ZS5mdWxmaWxsKHsgcmVzcG9uc2UsIGJvZHk6IHdpdGhCdW5kbGUoYXdhaXQgcmVzcG9uc2UudGV4dCgpKSB9KTtcblx0fSk7XG5cdGF3YWl0IHBhZ2UuZ290bygoYXdhaXQgc2VydmUoKSkgKyAnL2NvbXBvbmVudHMvJyArIG5hbWUgKyAnL3ByZXZpZXcuaHRtbCcpO1xuXHRhd2FpdCBwYWdlLmFkZFN0eWxlVGFnKHsgY29udGVudDogdG9rZW5zQ3NzKCkgfSk7XG5cdGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTAwKTtcblx0cmV0dXJuIHsgcGFnZSwgZXJyb3JzIH07XG59XG5cbi8vIFJ1bnMgYSB0ZXN0IGJvZHkgd2l0aCBhIGZyZXNoIGJyb3dzZXIgYW5kIGFsd2F5cyBjbG9zZXMgaXQuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aEJyb3dzZXIoYm9keTogKGJyb3dzZXI6IEJyb3dzZXIpID0+IFByb21pc2U8dm9pZD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgYnJvd3NlciA9IGF3YWl0IGNocm9taXVtLmxhdW5jaCgpO1xuXHR0cnkge1xuXHRcdGF3YWl0IGJvZHkoYnJvd3Nlcik7XG5cdH0gZmluYWxseSB7XG5cdFx0YXdhaXQgYnJvd3Nlci5jbG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBiYWNrZ3JvdW5kID0gKHBhZ2U6IFBhZ2UsIHNlbGVjdG9yOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4gcGFnZS4kZXZhbChzZWxlY3RvciwgKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5iYWNrZ3JvdW5kQ29sb3IpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFlBQVk7OztBQ0FyQixPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFDakIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQXlDO0FBRWxELElBQU0sT0FBTyxLQUFLLFFBQVEsY0FBYyxZQUFZLEdBQUcsQ0FBQztBQUNqRCxJQUFNLE9BQU8sS0FBSyxRQUFRLE1BQU0sTUFBTSxlQUFlO0FBV3JELFNBQVMsWUFBb0I7QUFDbkMsUUFBTSxTQUFTLEtBQUssTUFBTSxH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
