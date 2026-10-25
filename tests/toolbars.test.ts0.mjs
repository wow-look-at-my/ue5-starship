// toolbars.test.ts
import { strict as assert2 } from "node:assert";

// probe.ts
var CLEAR = "rgba(0, 0, 0, 0)";
var token = (page, name) => page.evaluate((n) => {
  const probe = document.createElement("div");
  probe.style.background = "var(--" + n + ")";
  document.body.append(probe);
  const colour = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return colour;
}, name);
var prop = (target, name) => target.evaluate((el, n) => getComputedStyle(el).getPropertyValue(n), name);
var fill = (target) => prop(target, "background-color");
var ink = (target) => prop(target, "color");
var hasClass = (target, name) => target.evaluate((el, n) => el.classList.contains(n), name);
var texts = (page, selector) => page.$$eval(selector, (els) => els.map((el) => el.textContent?.trim() ?? ""));
var focusedText = (page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
var after = (target) => target.locator("xpath=following-sibling::*[1]");
var press = (page, key) => page.keyboard.press(key);
var hold = (page) => page.mouse.down();
var release = (page) => page.mouse.up();
var away = (page) => page.mouse.move(900, 700);
var clickAway = (page) => page.mouse.click(900, 700);

// scenario.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// lib.ts
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
async function openPreview(browser, name, viewport = { width: 1e3, height: 800 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text());
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

// scenario.ts
function scenario(name, component, body) {
  test(
    name,
    () => withBrowser(async (browser) => {
      const { page, errors } = await openPreview(browser, component);
      await body(page);
      assert.deepEqual(errors, [], "the page raised console or page errors");
      await page.close();
    })
  );
}

// toolbars.test.ts
var MB = "ue-menu-bar ";
var item = (page, label) => page.locator(MB + ".menuBar-item").filter({ hasText: new RegExp("^" + label + "$") });
var menuOf = (page, label) => after(item(page, label));
scenario("MenuBar: hovering an item fills Hover with ForegroundHover text", "MenuBar", async (page) => {
  const file = item(page, "File");
  assert2.equal(await fill(file), CLEAR);
  await file.hover();
  assert2.equal(await fill(file), await token(page, "hover"));
  assert2.equal(await ink(file), await token(page, "foreground-hover"));
});
scenario("MenuBar: a click opens the dropdown, Escape closes it", "MenuBar", async (page) => {
  const file = item(page, "File");
  const menu = menuOf(page, "File");
  assert2.equal(await menu.isVisible(), false);
  await file.click();
  assert2.equal(await menu.isVisible(), true);
  assert2.equal(await file.getAttribute("aria-expanded"), "true");
  assert2.equal(await fill(file), await token(page, "primary"));
  assert2.equal(await fill(menu), await token(page, "dropdown"));
  await press(page, "Escape");
  assert2.equal(await menu.isVisible(), false);
  assert2.equal(await file.getAttribute("aria-expanded"), "false");
});
scenario("MenuBar: a click on the open item and a click outside both close the menu", "MenuBar", async (page) => {
  const edit = item(page, "Edit");
  const menu = menuOf(page, "Edit");
  await edit.click();
  assert2.equal(await menu.isVisible(), true);
  await edit.click();
  assert2.equal(await menu.isVisible(), false);
  await edit.click();
  assert2.equal(await menu.isVisible(), true);
  await clickAway(page);
  assert2.equal(await menu.isVisible(), false);
  assert2.equal(await page.locator(MB + ".menuBar-item.is-open").count(), 0);
});
scenario("MenuBar: hovering another item while a menu is open switches to it", "MenuBar", async (page) => {
  await item(page, "File").click();
  await item(page, "Edit").hover();
  assert2.equal(await menuOf(page, "Edit").isVisible(), true);
  assert2.equal(await menuOf(page, "File").isVisible(), false);
  assert2.equal(await page.locator(MB + ".menuBar-item.is-open").count(), 1);
  await item(page, "Help").hover();
  assert2.equal(await menuOf(page, "Help").isVisible(), true);
  assert2.equal(await menuOf(page, "Edit").isVisible(), false);
});
scenario("MenuBar: hovering a dropdown row fills it with Primary; a disabled row does not react", "MenuBar", async (page) => {
  await item(page, "Edit").click();
  const menu = menuOf(page, "Edit");
  const undo = menu.locator(".menuBar-row").filter({ hasText: "Undo" });
  const redo = menu.locator(".menuBar-row").filter({ hasText: "Redo" });
  assert2.equal(await fill(undo), CLEAR);
  await undo.hover();
  assert2.equal(await fill(undo), await token(page, "primary"));
  assert2.equal(await prop(redo, "pointer-events"), "none");
  assert2.equal(await prop(redo, "opacity"), "0.45");
});
scenario("MenuBar: clicking a row closes the menu and reports the label", "MenuBar", async (page) => {
  await page.evaluate(() => {
    const picked = [];
    window.picked = picked;
    document.addEventListener("ue-menu-select", (e) => picked.push(e.detail.label));
  });
  await item(page, "File").click();
  await menuOf(page, "File").locator(".menuBar-row").filter({ hasText: "Save All" }).click();
  assert2.equal(await menuOf(page, "File").isVisible(), false);
  assert2.deepEqual(await page.evaluate(() => window.picked), ["Save All"]);
});
scenario("MenuBar: arrow keys move between items and into the dropdown", "MenuBar", async (page) => {
  await item(page, "File").focus();
  await press(page, "ArrowRight");
  assert2.equal(await focusedText(page), "Edit");
  await press(page, "ArrowDown");
  assert2.equal(await menuOf(page, "Edit").isVisible(), true);
  assert2.ok((await focusedText(page)).startsWith("Undo"));
  await press(page, "ArrowDown");
  assert2.ok((await focusedText(page)).startsWith("Cut"), "the disabled Redo row is skipped");
  await press(page, "ArrowRight");
  assert2.equal(await menuOf(page, "Window").isVisible(), true);
  assert2.equal(await menuOf(page, "Edit").isVisible(), false);
  await press(page, "Escape");
  assert2.equal(await menuOf(page, "Window").isVisible(), false);
  assert2.equal(await focusedText(page), "Window");
});
scenario("MenuBar: pinned specimens ignore clicks and keep their forced states", "MenuBar", async (page) => {
  const pinned = page.locator(".menuBar[data-pinned]");
  assert2.equal(await pinned.count(), 2);
  assert2.equal(await fill(pinned.nth(1).locator(".menuBar-item.is-open")), await token(page, "primary"));
  await pinned.nth(0).locator(".menuBar-item").nth(0).click();
  assert2.equal(await page.locator(".menuBar[data-pinned] .menuBar-item.is-open").count(), 1);
  assert2.equal(await fill(pinned.nth(0).locator(".menuBar-item.is-hover")), await token(page, "hover"));
});
var TB = "ue-tool-bar ";
var openMenus = (page) => page.locator(TB + ".toolBar-menu.is-open").count();
scenario("ToolBar: an icon button shows Dropdown on hover and shifts its padding while pressed", "ToolBar", async (page) => {
  const save = page.locator(TB + '.toolBar-btn[aria-label="Save"]');
  assert2.equal(await fill(save), CLEAR);
  await save.hover();
  assert2.equal(await fill(save), await token(page, "dropdown"));
  assert2.equal(await prop(save, "padding-top"), "4px");
  await hold(page);
  assert2.equal(await prop(save, "padding-top"), "5px");
  assert2.equal(await prop(save, "padding-bottom"), "3px");
  await release(page);
  assert2.equal(await prop(save, "padding-top"), "4px");
});
scenario("ToolBar: toggle buttons toggle checked, by mouse and by keyboard", "ToolBar", async (page) => {
  const select = page.locator(TB + '.toolBar-btn--toggle[aria-label="Select"]');
  const blueprints = page.locator(TB + '.toolBar-btn--toggle[aria-label="Blueprints"]');
  assert2.equal(await select.getAttribute("aria-pressed"), "true");
  await select.click();
  assert2.equal(await select.getAttribute("aria-pressed"), "false");
  assert2.equal(await hasClass(select, "is-checked"), false);
  await blueprints.click();
  assert2.equal(await hasClass(blueprints, "is-checked"), true);
  assert2.equal(await fill(blueprints), await token(page, "primary-hover"), "checked and hovered");
  await away(page);
  assert2.equal(await fill(blueprints), await token(page, "primary"));
  await blueprints.focus();
  await press(page, "Enter");
  assert2.equal(await blueprints.getAttribute("aria-pressed"), "false");
  await press(page, "Space");
  assert2.equal(await blueprints.getAttribute("aria-pressed"), "true");
});
scenario("ToolBar: combo buttons open a menu, Escape and an outside click close it", "ToolBar", async (page) => {
  const add = page.locator(TB + '.toolBar-btn[aria-label="Add"]');
  const menu = after(add);
  assert2.equal(await menu.isVisible(), false);
  await add.click();
  assert2.equal(await menu.isVisible(), true);
  assert2.equal(await add.getAttribute("aria-expanded"), "true");
  assert2.equal(await fill(menu), await token(page, "dropdown"));
  await press(page, "Escape");
  assert2.equal(await menu.isVisible(), false);
  await add.click();
  await clickAway(page);
  assert2.equal(await menu.isVisible(), false);
  assert2.equal(await add.getAttribute("aria-expanded"), "false");
});
scenario("ToolBar: one menu at a time; the mode, overflow and settings menus open and pick", "ToolBar", async (page) => {
  const modes = page.locator(TB + ".toolBar-modes");
  const wrap = page.locator(TB + ".toolBar-wrap");
  const settings = page.locator(TB + ".toolBar-slot--settings .toolBar-btn");
  await modes.click();
  assert2.equal(await openMenus(page), 1);
  assert2.equal(await after(modes).isVisible(), true);
  await wrap.click();
  assert2.equal(await openMenus(page), 1);
  assert2.equal(await after(wrap).isVisible(), true);
  assert2.equal(await after(modes).isVisible(), false);
  await settings.click();
  const menu = after(settings);
  assert2.equal(await menu.isVisible(), true);
  const box = await menu.boundingBox();
  assert2.ok(box && box.x + box.width <= 1e3, "the settings menu stays inside the page");
  await menu.locator(".toolBar-row").filter({ hasText: "World Settings" }).click();
  assert2.equal(await openMenus(page), 0);
});
scenario("ToolBar: Play presses itself and enables Stop; Stop returns to idle", "ToolBar", async (page) => {
  const play = page.locator(TB + ".toolBar-plate--play");
  const stop = page.locator(TB + ".toolBar-plate--stop");
  assert2.equal(await prop(stop, "opacity"), "0.45");
  assert2.equal(await stop.getAttribute("aria-disabled"), "true");
  assert2.equal(await ink(play), await token(page, "accent-green"));
  await play.click();
  assert2.equal(await play.getAttribute("aria-pressed"), "true");
  assert2.equal(await ink(play), "rgb(101, 142, 52)");
  assert2.equal(await prop(stop, "opacity"), "1");
  assert2.equal(await stop.getAttribute("aria-disabled"), "false");
  assert2.equal(await ink(stop), await token(page, "accent-red"));
  await stop.click();
  await away(page);
  assert2.equal(await play.getAttribute("aria-pressed"), "false");
  assert2.equal(await ink(play), await token(page, "accent-green"));
  assert2.equal(await prop(stop, "opacity"), "0.45");
});
scenario("ToolBar: the plates change only their colour on hover and press", "ToolBar", async (page) => {
  const play = page.locator(TB + ".toolBar-plate--play");
  await play.hover();
  assert2.equal(await ink(play), "rgb(169, 194, 150)");
  await hold(page);
  assert2.equal(await ink(play), "rgb(101, 142, 52)");
  await release(page);
  const step = page.locator(TB + ".toolBar-plate--step").first();
  await step.hover();
  assert2.equal(await ink(step), await token(page, "foreground-hover"));
  assert2.equal(await fill(step), await token(page, "dropdown"));
});
scenario("ToolBar: pinned specimens ignore clicks", "ToolBar", async (page) => {
  const pinned = page.locator(".toolBar[data-pinned]");
  assert2.equal(await pinned.count(), 2);
  const toggle = pinned.nth(1).locator(".toolBar-btn--toggle").first();
  await toggle.click();
  assert2.equal(await hasClass(toggle, "is-checked"), false);
  assert2.equal(await prop(pinned.nth(1).locator(".toolBar-btn.is-pressed"), "padding-top"), "5px");
});
var PA = "ue-place-actors-panel ";
var cat = (page, name) => page.locator(PA + '.placeActors-cat[data-category="' + name + '"]');
var visibleRows = (page) => texts(page, PA + ".placeActors-group:not([hidden]) .placeActors-row:not([hidden]) .placeActors-name");
scenario("PlaceActorsPanel: clicking a category activates it and swaps the list and the label", "PlaceActorsPanel", async (page) => {
  assert2.deepEqual(await visibleRows(page), ["Actor", "Character", "Pawn", "Point Light", "Player Start"]);
  await cat(page, "Lights").click();
  assert2.deepEqual(await visibleRows(page), ["Directional Light", "Point Light", "Spot Light", "Rect Light", "Sky Light"]);
  assert2.equal(await page.locator(PA + ".placeActors-header").textContent(), "Lights");
  assert2.equal(await cat(page, "Lights").getAttribute("aria-checked"), "true");
  assert2.equal(await cat(page, "Basic").getAttribute("aria-checked"), "false");
  await away(page);
  assert2.equal(await fill(cat(page, "Lights")), await token(page, "primary"));
  assert2.equal(await fill(cat(page, "Basic")), CLEAR);
  assert2.equal(await page.locator(PA + ".placeActors-cat.is-active").count(), 1);
  await cat(page, "Volumes").click();
  assert2.deepEqual(await visibleRows(page), ["Trigger Volume", "Blocking Volume"]);
});
scenario("PlaceActorsPanel: an inactive category fills Dropdown on hover, the active one PrimaryHover", "PlaceActorsPanel", async (page) => {
  await cat(page, "Shapes").hover();
  assert2.equal(await fill(cat(page, "Shapes")), await token(page, "dropdown"));
  await cat(page, "Basic").hover();
  assert2.equal(await fill(cat(page, "Basic")), await token(page, "primary-hover"));
});
scenario("PlaceActorsPanel: typing filters the rows and shows the clear button", "PlaceActorsPanel", async (page) => {
  const field = page.locator(PA + ".placeActors-field");
  const clear = page.locator(PA + ".placeActors-clear");
  const box = page.locator(PA + ".placeActors-searchbox");
  assert2.equal(await clear.isVisible(), false);
  await field.click();
  assert2.ok((await prop(box, "box-shadow")).includes(await token(page, "primary")), "focus outline is Primary");
  await page.keyboard.type("light");
  assert2.deepEqual(await visibleRows(page), ["Point Light"]);
  assert2.equal(await clear.isVisible(), true);
  await field.fill("PA");
  assert2.deepEqual(await visibleRows(page), ["Pawn"]);
  await field.fill("zzz");
  assert2.deepEqual(await visibleRows(page), []);
  assert2.equal(await page.locator(PA + ".placeActors-empty").isVisible(), true);
  await clear.click();
  assert2.equal(await field.inputValue(), "");
  assert2.equal(await clear.isVisible(), false);
  assert2.equal((await visibleRows(page)).length, 5);
  assert2.equal(await page.locator(PA + ".placeActors-empty").isVisible(), false);
});
scenario("PlaceActorsPanel: the filter follows the category and Escape clears it", "PlaceActorsPanel", async (page) => {
  const field = page.locator(PA + ".placeActors-field");
  await field.fill("light");
  await cat(page, "Lights").click();
  assert2.equal((await visibleRows(page)).length, 5);
  await cat(page, "Shapes").click();
  assert2.deepEqual(await visibleRows(page), []);
  await field.focus();
  await press(page, "Escape");
  assert2.equal(await field.inputValue(), "");
  assert2.equal((await visibleRows(page)).length, 5);
});
scenario("PlaceActorsPanel: rows show hover and pressed outlines, the info button fills on hover", "PlaceActorsPanel", async (page) => {
  const row = page.locator(PA + ".placeActors-row").nth(1);
  const info = row.locator(".placeActors-info");
  assert2.ok((await prop(row, "box-shadow")).includes(await token(page, "dropdown")));
  await row.hover({ position: { x: 60, y: 10 } });
  assert2.ok((await prop(row, "box-shadow")).includes(await token(page, "hover")));
  await hold(page);
  assert2.ok((await prop(row, "box-shadow")).includes(await token(page, "primary")));
  await release(page);
  assert2.equal(await fill(info), CLEAR);
  await info.hover();
  assert2.equal(await fill(info), await token(page, "hover"));
  assert2.equal(await ink(info), await token(page, "foreground-hover"));
});
scenario("PlaceActorsPanel: arrow keys move the category and activate it", "PlaceActorsPanel", async (page) => {
  await cat(page, "Basic").focus();
  await press(page, "ArrowRight");
  assert2.equal(await cat(page, "Lights").getAttribute("aria-checked"), "true");
  assert2.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-category")), "Lights");
  await press(page, "End");
  assert2.equal(await page.locator(PA + ".placeActors-header").textContent(), "All");
});
scenario("PlaceActorsPanel: pinned specimens ignore clicks and keep their forced rows", "PlaceActorsPanel", async (page) => {
  const pinned = page.locator("div[data-pinned]").first();
  await pinned.locator(".placeActors-cat").nth(2).click();
  assert2.equal(await pinned.locator(".placeActors-cat.is-active use").getAttribute("href"), "#placeActors-i-basic");
  assert2.equal(await pinned.locator(".placeActors-header").textContent(), "Basic");
  assert2.equal(await pinned.locator(".placeActors-row.is-hover").count(), 1);
  assert2.equal(await pinned.locator(".placeActors-row.is-pressed").count(), 1);
});
var SB = "ue-status-bar ";
var drawer = (page, label) => page.locator(SB + ".statusBar-btn").filter({ hasText: label });
scenario("StatusBar: the drawer buttons toggle an open look, one at a time", "StatusBar", async (page) => {
  const content = drawer(page, "Content Drawer");
  const log = drawer(page, "Output Log");
  assert2.equal(await ink(content), await token(page, "foreground"));
  await content.click();
  assert2.equal(await content.getAttribute("aria-expanded"), "true");
  await away(page);
  assert2.equal(await ink(content), await token(page, "foreground-hover"));
  assert2.equal(await prop(content, "padding-top"), "3px");
  await log.click();
  assert2.equal(await content.getAttribute("aria-expanded"), "false");
  assert2.equal(await log.getAttribute("aria-expanded"), "true");
  await log.click();
  await away(page);
  assert2.equal(await log.getAttribute("aria-expanded"), "false");
  assert2.equal(await ink(log), await token(page, "foreground"));
});
scenario("StatusBar: a drawer button turns white on hover and shifts down while pressed", "StatusBar", async (page) => {
  const log = drawer(page, "Output Log");
  await log.hover();
  assert2.equal(await ink(log), await token(page, "foreground-hover"));
  assert2.equal(await fill(log), CLEAR, "drawer buttons have no hover fill");
  assert2.equal(await prop(log, "padding-top"), "2px");
  await hold(page);
  assert2.equal(await prop(log, "padding-top"), "3px");
  await release(page);
});
scenario("StatusBar: the Cmd combo opens an upward menu; choosing an entry renames it", "StatusBar", async (page) => {
  const cmd = page.locator(SB + ".statusBar-cmd");
  const menu = page.locator(SB + ".statusBar-menu");
  assert2.equal(await menu.isVisible(), false);
  await cmd.click();
  assert2.equal(await menu.isVisible(), true);
  const menuBox = await menu.boundingBox();
  const cmdBox = await cmd.boundingBox();
  assert2.ok(menuBox && cmdBox && menuBox.y + menuBox.height <= cmdBox.y, "the menu opens above the combo");
  assert2.equal(await fill(cmd), await token(page, "dropdown"));
  await press(page, "Escape");
  assert2.equal(await menu.isVisible(), false);
  await cmd.click();
  await clickAway(page);
  assert2.equal(await menu.isVisible(), false);
  await cmd.click();
  await menu.locator(".statusBar-row").filter({ hasText: "Python" }).click();
  assert2.equal(await menu.isVisible(), false);
  assert2.equal((await cmd.textContent())?.trim(), "Python");
});
scenario("StatusBar: the console box takes focus, Enter logs the command and clears the box", "StatusBar", async (page) => {
  const field = page.locator(SB + ".statusBar-field");
  const box = page.locator(SB + ".statusBar-input");
  const history = SB + ".statusBar-history-line";
  assert2.ok(!(await prop(box, "box-shadow")).includes(await token(page, "primary")));
  await field.click();
  assert2.ok((await prop(box, "box-shadow")).includes(await token(page, "primary")), "focus ring is Primary");
  await page.keyboard.type("stat fps");
  assert2.equal(await field.inputValue(), "stat fps");
  await press(page, "Enter");
  assert2.equal(await field.inputValue(), "");
  await page.keyboard.type("t.MaxFPS 30");
  await press(page, "Enter");
  assert2.deepEqual(await texts(page, history), ["> stat fps", "> t.MaxFPS 30"]);
  await press(page, "ArrowUp");
  assert2.equal(await field.inputValue(), "t.MaxFPS 30");
  await press(page, "ArrowUp");
  assert2.equal(await field.inputValue(), "stat fps");
  await field.fill("   ");
  await press(page, "Enter");
  assert2.equal((await texts(page, history)).length, 2, "a blank line is not a command");
  for (const command of ["a", "b", "c", "d"]) {
    await field.fill(command);
    await press(page, "Enter");
  }
  assert2.deepEqual(await texts(page, history), ["> a", "> b", "> c", "> d"]);
});
scenario("StatusBar: Derived Data and Source Control fill Dropdown on hover", "StatusBar", async (page) => {
  for (const label of ["Derived Data", "Source Control Off"]) {
    const combo = page.locator(SB + ".statusBar-combo--status").filter({ hasText: label });
    assert2.equal(await fill(combo), CLEAR);
    await combo.hover();
    assert2.equal(await fill(combo), await token(page, "dropdown"));
    assert2.equal(await ink(combo), await token(page, "foreground-hover"));
  }
});
scenario("StatusBar: pinned specimens ignore clicks and keep their hover state", "StatusBar", async (page) => {
  const pinned = page.locator(".statusBar[data-pinned]");
  assert2.equal(await pinned.count(), 2);
  await pinned.nth(0).locator(".statusBar-btn").first().click();
  assert2.equal(await page.locator(".statusBar[data-pinned] .statusBar-btn.is-open").count(), 0);
  assert2.equal(await ink(pinned.nth(1).locator(".statusBar-btn.is-hover")), await token(page, "foreground-hover"));
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidG9vbGJhcnMudGVzdC50cyIsICJwcm9iZS50cyIsICJzY2VuYXJpby50cyIsICJsaWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIEludGVyYWN0aW9uIHRlc3RzIGZvciB0aGUgdG9vbGJhciBncm91cDogTWVudUJhciwgVG9vbEJhciwgUGxhY2VBY3RvcnNQYW5lbCwgU3RhdHVzQmFyLlxuaW1wb3J0IHsgc3RyaWN0IGFzIGFzc2VydCB9IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgQ0xFQVIsIHRva2VuLCBwcm9wLCBmaWxsLCBpbmssIGhhc0NsYXNzLCB0ZXh0cywgZm9jdXNlZFRleHQsIGFmdGVyLCBwcmVzcywgaG9sZCwgcmVsZWFzZSwgYXdheSwgY2xpY2tBd2F5IH0gZnJvbSAnLi9wcm9iZS50cyc7XG5pbXBvcnQgeyBzY2VuYXJpbyB9IGZyb20gJy4vc2NlbmFyaW8udHMnO1xuXG4vLyAtLS0tLS0tLS0tIE1lbnVCYXIgLS0tLS0tLS0tLVxuXG5jb25zdCBNQiA9ICd1ZS1tZW51LWJhciAnO1xuY29uc3QgaXRlbSA9IChwYWdlOiBQYWdlLCBsYWJlbDogc3RyaW5nKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoTUIgKyAnLm1lbnVCYXItaXRlbScpLmZpbHRlcih7IGhhc1RleHQ6IG5ldyBSZWdFeHAoJ14nICsgbGFiZWwgKyAnJCcpIH0pO1xuY29uc3QgbWVudU9mID0gKHBhZ2U6IFBhZ2UsIGxhYmVsOiBzdHJpbmcpOiBMb2NhdG9yID0+IGFmdGVyKGl0ZW0ocGFnZSwgbGFiZWwpKTtcblxuc2NlbmFyaW8oJ01lbnVCYXI6IGhvdmVyaW5nIGFuIGl0ZW0gZmlsbHMgSG92ZXIgd2l0aCBGb3JlZ3JvdW5kSG92ZXIgdGV4dCcsICdNZW51QmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZmlsZSA9IGl0ZW0ocGFnZSwgJ0ZpbGUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoZmlsZSksIENMRUFSKTtcblx0YXdhaXQgZmlsZS5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChmaWxlKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2hvdmVyJykpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKGZpbGUpLCBhd2FpdCB0b2tlbihwYWdlLCAnZm9yZWdyb3VuZC1ob3ZlcicpKTtcbn0pO1xuXG5zY2VuYXJpbygnTWVudUJhcjogYSBjbGljayBvcGVucyB0aGUgZHJvcGRvd24sIEVzY2FwZSBjbG9zZXMgaXQnLCAnTWVudUJhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGZpbGUgPSBpdGVtKHBhZ2UsICdGaWxlJyk7XG5cdGNvbnN0IG1lbnUgPSBtZW51T2YocGFnZSwgJ0ZpbGUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCksIGZhbHNlKTtcblx0YXdhaXQgZmlsZS5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudS5pc1Zpc2libGUoKSwgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxlLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAndHJ1ZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChmaWxlKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ3ByaW1hcnknKSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKG1lbnUpLCBhd2FpdCB0b2tlbihwYWdlLCAnZHJvcGRvd24nKSk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdFc2NhcGUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCksIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGUuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICdmYWxzZScpO1xufSk7XG5cbnNjZW5hcmlvKCdNZW51QmFyOiBhIGNsaWNrIG9uIHRoZSBvcGVuIGl0ZW0gYW5kIGEgY2xpY2sgb3V0c2lkZSBib3RoIGNsb3NlIHRoZSBtZW51JywgJ01lbnVCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBlZGl0ID0gaXRlbShwYWdlLCAnRWRpdCcpO1xuXHRjb25zdCBtZW51ID0gbWVudU9mKHBhZ2UsICdFZGl0Jyk7XG5cdGF3YWl0IGVkaXQuY2xpY2soKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCksIHRydWUpO1xuXHRhd2FpdCBlZGl0LmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51LmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGF3YWl0IGVkaXQuY2xpY2soKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCksIHRydWUpO1xuXHRhd2FpdCBjbGlja0F3YXkocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51LmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoTUIgKyAnLm1lbnVCYXItaXRlbS5pcy1vcGVuJykuY291bnQoKSwgMCk7XG59KTtcblxuc2NlbmFyaW8oJ01lbnVCYXI6IGhvdmVyaW5nIGFub3RoZXIgaXRlbSB3aGlsZSBhIG1lbnUgaXMgb3BlbiBzd2l0Y2hlcyB0byBpdCcsICdNZW51QmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXdhaXQgaXRlbShwYWdlLCAnRmlsZScpLmNsaWNrKCk7XG5cdGF3YWl0IGl0ZW0ocGFnZSwgJ0VkaXQnKS5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudU9mKHBhZ2UsICdFZGl0JykuaXNWaXNpYmxlKCksIHRydWUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudU9mKHBhZ2UsICdGaWxlJykuaXNWaXNpYmxlKCksIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihNQiArICcubWVudUJhci1pdGVtLmlzLW9wZW4nKS5jb3VudCgpLCAxKTtcblx0YXdhaXQgaXRlbShwYWdlLCAnSGVscCcpLmhvdmVyKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51T2YocGFnZSwgJ0hlbHAnKS5pc1Zpc2libGUoKSwgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51T2YocGFnZSwgJ0VkaXQnKS5pc1Zpc2libGUoKSwgZmFsc2UpO1xufSk7XG5cbnNjZW5hcmlvKCdNZW51QmFyOiBob3ZlcmluZyBhIGRyb3Bkb3duIHJvdyBmaWxscyBpdCB3aXRoIFByaW1hcnk7IGEgZGlzYWJsZWQgcm93IGRvZXMgbm90IHJlYWN0JywgJ01lbnVCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRhd2FpdCBpdGVtKHBhZ2UsICdFZGl0JykuY2xpY2soKTtcblx0Y29uc3QgbWVudSA9IG1lbnVPZihwYWdlLCAnRWRpdCcpO1xuXHRjb25zdCB1bmRvID0gbWVudS5sb2NhdG9yKCcubWVudUJhci1yb3cnKS5maWx0ZXIoeyBoYXNUZXh0OiAnVW5kbycgfSk7XG5cdGNvbnN0IHJlZG8gPSBtZW51LmxvY2F0b3IoJy5tZW51QmFyLXJvdycpLmZpbHRlcih7IGhhc1RleHQ6ICdSZWRvJyB9KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwodW5kbyksIENMRUFSKTtcblx0YXdhaXQgdW5kby5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbCh1bmRvKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ3ByaW1hcnknKSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKHJlZG8sICdwb2ludGVyLWV2ZW50cycpLCAnbm9uZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChyZWRvLCAnb3BhY2l0eScpLCAnMC40NScpO1xufSk7XG5cbnNjZW5hcmlvKCdNZW51QmFyOiBjbGlja2luZyBhIHJvdyBjbG9zZXMgdGhlIG1lbnUgYW5kIHJlcG9ydHMgdGhlIGxhYmVsJywgJ01lbnVCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRhd2FpdCBwYWdlLmV2YWx1YXRlKCgpID0+IHtcblx0XHRjb25zdCBwaWNrZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0KHdpbmRvdyBhcyB1bmtub3duIGFzIHsgcGlja2VkOiBzdHJpbmdbXSB9KS5waWNrZWQgPSBwaWNrZWQ7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndWUtbWVudS1zZWxlY3QnLCAoZSkgPT4gcGlja2VkLnB1c2goKGUgYXMgQ3VzdG9tRXZlbnQ8eyBsYWJlbDogc3RyaW5nIH0+KS5kZXRhaWwubGFiZWwpKTtcblx0fSk7XG5cdGF3YWl0IGl0ZW0ocGFnZSwgJ0ZpbGUnKS5jbGljaygpO1xuXHRhd2FpdCBtZW51T2YocGFnZSwgJ0ZpbGUnKS5sb2NhdG9yKCcubWVudUJhci1yb3cnKS5maWx0ZXIoeyBoYXNUZXh0OiAnU2F2ZSBBbGwnIH0pLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51T2YocGFnZSwgJ0ZpbGUnKS5pc1Zpc2libGUoKSwgZmFsc2UpO1xuXHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHBhZ2UuZXZhbHVhdGUoKCkgPT4gKHdpbmRvdyBhcyB1bmtub3duIGFzIHsgcGlja2VkOiBzdHJpbmdbXSB9KS5waWNrZWQpLCBbJ1NhdmUgQWxsJ10pO1xufSk7XG5cbnNjZW5hcmlvKCdNZW51QmFyOiBhcnJvdyBrZXlzIG1vdmUgYmV0d2VlbiBpdGVtcyBhbmQgaW50byB0aGUgZHJvcGRvd24nLCAnTWVudUJhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGF3YWl0IGl0ZW0ocGFnZSwgJ0ZpbGUnKS5mb2N1cygpO1xuXHRhd2FpdCBwcmVzcyhwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZm9jdXNlZFRleHQocGFnZSksICdFZGl0Jyk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnVPZihwYWdlLCAnRWRpdCcpLmlzVmlzaWJsZSgpLCB0cnVlKTtcblx0YXNzZXJ0Lm9rKChhd2FpdCBmb2N1c2VkVGV4dChwYWdlKSkuc3RhcnRzV2l0aCgnVW5kbycpKTtcblx0YXdhaXQgcHJlc3MocGFnZSwgJ0Fycm93RG93bicpO1xuXHRhc3NlcnQub2soKGF3YWl0IGZvY3VzZWRUZXh0KHBhZ2UpKS5zdGFydHNXaXRoKCdDdXQnKSwgJ3RoZSBkaXNhYmxlZCBSZWRvIHJvdyBpcyBza2lwcGVkJyk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdBcnJvd1JpZ2h0Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51T2YocGFnZSwgJ1dpbmRvdycpLmlzVmlzaWJsZSgpLCB0cnVlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnVPZihwYWdlLCAnRWRpdCcpLmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdFc2NhcGUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnVPZihwYWdlLCAnV2luZG93JykuaXNWaXNpYmxlKCksIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZvY3VzZWRUZXh0KHBhZ2UpLCAnV2luZG93Jyk7XG59KTtcblxuc2NlbmFyaW8oJ01lbnVCYXI6IHBpbm5lZCBzcGVjaW1lbnMgaWdub3JlIGNsaWNrcyBhbmQga2VlcCB0aGVpciBmb3JjZWQgc3RhdGVzJywgJ01lbnVCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBwaW5uZWQgPSBwYWdlLmxvY2F0b3IoJy5tZW51QmFyW2RhdGEtcGlubmVkXScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGlubmVkLmNvdW50KCksIDIpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChwaW5uZWQubnRoKDEpLmxvY2F0b3IoJy5tZW51QmFyLWl0ZW0uaXMtb3BlbicpKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ3ByaW1hcnknKSk7XG5cdGF3YWl0IHBpbm5lZC5udGgoMCkubG9jYXRvcignLm1lbnVCYXItaXRlbScpLm50aCgwKS5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKCcubWVudUJhcltkYXRhLXBpbm5lZF0gLm1lbnVCYXItaXRlbS5pcy1vcGVuJykuY291bnQoKSwgMSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKHBpbm5lZC5udGgoMCkubG9jYXRvcignLm1lbnVCYXItaXRlbS5pcy1ob3ZlcicpKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2hvdmVyJykpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gVG9vbEJhciAtLS0tLS0tLS0tXG5cbmNvbnN0IFRCID0gJ3VlLXRvb2wtYmFyICc7XG5jb25zdCBvcGVuTWVudXMgPSAocGFnZTogUGFnZSk6IFByb21pc2U8bnVtYmVyPiA9PiBwYWdlLmxvY2F0b3IoVEIgKyAnLnRvb2xCYXItbWVudS5pcy1vcGVuJykuY291bnQoKTtcblxuc2NlbmFyaW8oJ1Rvb2xCYXI6IGFuIGljb24gYnV0dG9uIHNob3dzIERyb3Bkb3duIG9uIGhvdmVyIGFuZCBzaGlmdHMgaXRzIHBhZGRpbmcgd2hpbGUgcHJlc3NlZCcsICdUb29sQmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3Qgc2F2ZSA9IHBhZ2UubG9jYXRvcihUQiArICcudG9vbEJhci1idG5bYXJpYS1sYWJlbD1cIlNhdmVcIl0nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoc2F2ZSksIENMRUFSKTtcblx0YXdhaXQgc2F2ZS5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChzYXZlKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2Ryb3Bkb3duJykpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChzYXZlLCAncGFkZGluZy10b3AnKSwgJzRweCcpO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChzYXZlLCAncGFkZGluZy10b3AnKSwgJzVweCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChzYXZlLCAncGFkZGluZy1ib3R0b20nKSwgJzNweCcpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChzYXZlLCAncGFkZGluZy10b3AnKSwgJzRweCcpO1xufSk7XG5cbnNjZW5hcmlvKCdUb29sQmFyOiB0b2dnbGUgYnV0dG9ucyB0b2dnbGUgY2hlY2tlZCwgYnkgbW91c2UgYW5kIGJ5IGtleWJvYXJkJywgJ1Rvb2xCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBzZWxlY3QgPSBwYWdlLmxvY2F0b3IoVEIgKyAnLnRvb2xCYXItYnRuLS10b2dnbGVbYXJpYS1sYWJlbD1cIlNlbGVjdFwiXScpO1xuXHRjb25zdCBibHVlcHJpbnRzID0gcGFnZS5sb2NhdG9yKFRCICsgJy50b29sQmFyLWJ0bi0tdG9nZ2xlW2FyaWEtbGFiZWw9XCJCbHVlcHJpbnRzXCJdJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnKSwgJ3RydWUnKTtcblx0YXdhaXQgc2VsZWN0LmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnKSwgJ2ZhbHNlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBoYXNDbGFzcyhzZWxlY3QsICdpcy1jaGVja2VkJyksIGZhbHNlKTtcblx0YXdhaXQgYmx1ZXByaW50cy5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaGFzQ2xhc3MoYmx1ZXByaW50cywgJ2lzLWNoZWNrZWQnKSwgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKGJsdWVwcmludHMpLCBhd2FpdCB0b2tlbihwYWdlLCAncHJpbWFyeS1ob3ZlcicpLCAnY2hlY2tlZCBhbmQgaG92ZXJlZCcpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChibHVlcHJpbnRzKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ3ByaW1hcnknKSk7XG5cdGF3YWl0IGJsdWVwcmludHMuZm9jdXMoKTtcblx0YXdhaXQgcHJlc3MocGFnZSwgJ0VudGVyJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBibHVlcHJpbnRzLmdldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJyksICdmYWxzZScpO1xuXHRhd2FpdCBwcmVzcyhwYWdlLCAnU3BhY2UnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJsdWVwcmludHMuZ2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnKSwgJ3RydWUnKTtcbn0pO1xuXG5zY2VuYXJpbygnVG9vbEJhcjogY29tYm8gYnV0dG9ucyBvcGVuIGEgbWVudSwgRXNjYXBlIGFuZCBhbiBvdXRzaWRlIGNsaWNrIGNsb3NlIGl0JywgJ1Rvb2xCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBhZGQgPSBwYWdlLmxvY2F0b3IoVEIgKyAnLnRvb2xCYXItYnRuW2FyaWEtbGFiZWw9XCJBZGRcIl0nKTtcblx0Y29uc3QgbWVudSA9IGFmdGVyKGFkZCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51LmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGF3YWl0IGFkZC5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudS5pc1Zpc2libGUoKSwgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBhZGQuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICd0cnVlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKG1lbnUpLCBhd2FpdCB0b2tlbihwYWdlLCAnZHJvcGRvd24nKSk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdFc2NhcGUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCksIGZhbHNlKTtcblx0YXdhaXQgYWRkLmNsaWNrKCk7XG5cdGF3YWl0IGNsaWNrQXdheShwYWdlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCksIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGFkZC5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSwgJ2ZhbHNlJyk7XG59KTtcblxuc2NlbmFyaW8oJ1Rvb2xCYXI6IG9uZSBtZW51IGF0IGEgdGltZTsgdGhlIG1vZGUsIG92ZXJmbG93IGFuZCBzZXR0aW5ncyBtZW51cyBvcGVuIGFuZCBwaWNrJywgJ1Rvb2xCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBtb2RlcyA9IHBhZ2UubG9jYXRvcihUQiArICcudG9vbEJhci1tb2RlcycpO1xuXHRjb25zdCB3cmFwID0gcGFnZS5sb2NhdG9yKFRCICsgJy50b29sQmFyLXdyYXAnKTtcblx0Y29uc3Qgc2V0dGluZ3MgPSBwYWdlLmxvY2F0b3IoVEIgKyAnLnRvb2xCYXItc2xvdC0tc2V0dGluZ3MgLnRvb2xCYXItYnRuJyk7XG5cdGF3YWl0IG1vZGVzLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBvcGVuTWVudXMocGFnZSksIDEpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgYWZ0ZXIobW9kZXMpLmlzVmlzaWJsZSgpLCB0cnVlKTtcblx0YXdhaXQgd3JhcC5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgb3Blbk1lbnVzKHBhZ2UpLCAxKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGFmdGVyKHdyYXApLmlzVmlzaWJsZSgpLCB0cnVlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGFmdGVyKG1vZGVzKS5pc1Zpc2libGUoKSwgZmFsc2UpO1xuXHRhd2FpdCBzZXR0aW5ncy5jbGljaygpO1xuXHRjb25zdCBtZW51ID0gYWZ0ZXIoc2V0dGluZ3MpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudS5pc1Zpc2libGUoKSwgdHJ1ZSk7XG5cdGNvbnN0IGJveCA9IGF3YWl0IG1lbnUuYm91bmRpbmdCb3goKTtcblx0YXNzZXJ0Lm9rKGJveCAmJiBib3gueCArIGJveC53aWR0aCA8PSAxMDAwLCAndGhlIHNldHRpbmdzIG1lbnUgc3RheXMgaW5zaWRlIHRoZSBwYWdlJyk7XG5cdGF3YWl0IG1lbnUubG9jYXRvcignLnRvb2xCYXItcm93JykuZmlsdGVyKHsgaGFzVGV4dDogJ1dvcmxkIFNldHRpbmdzJyB9KS5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgb3Blbk1lbnVzKHBhZ2UpLCAwKTtcbn0pO1xuXG5zY2VuYXJpbygnVG9vbEJhcjogUGxheSBwcmVzc2VzIGl0c2VsZiBhbmQgZW5hYmxlcyBTdG9wOyBTdG9wIHJldHVybnMgdG8gaWRsZScsICdUb29sQmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgcGxheSA9IHBhZ2UubG9jYXRvcihUQiArICcudG9vbEJhci1wbGF0ZS0tcGxheScpO1xuXHRjb25zdCBzdG9wID0gcGFnZS5sb2NhdG9yKFRCICsgJy50b29sQmFyLXBsYXRlLS1zdG9wJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKHN0b3AsICdvcGFjaXR5JyksICcwLjQ1Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzdG9wLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKHBsYXkpLCBhd2FpdCB0b2tlbihwYWdlLCAnYWNjZW50LWdyZWVuJykpO1xuXHRhd2FpdCBwbGF5LmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwbGF5LmdldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJyksICd0cnVlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpbmsocGxheSksICdyZ2IoMTAxLCAxNDIsIDUyKScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChzdG9wLCAnb3BhY2l0eScpLCAnMScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RvcC5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ2ZhbHNlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpbmsoc3RvcCksIGF3YWl0IHRva2VuKHBhZ2UsICdhY2NlbnQtcmVkJykpO1xuXHRhd2FpdCBzdG9wLmNsaWNrKCk7XG5cdGF3YWl0IGF3YXkocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwbGF5LmdldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJyksICdmYWxzZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKHBsYXkpLCBhd2FpdCB0b2tlbihwYWdlLCAnYWNjZW50LWdyZWVuJykpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChzdG9wLCAnb3BhY2l0eScpLCAnMC40NScpO1xufSk7XG5cbnNjZW5hcmlvKCdUb29sQmFyOiB0aGUgcGxhdGVzIGNoYW5nZSBvbmx5IHRoZWlyIGNvbG91ciBvbiBob3ZlciBhbmQgcHJlc3MnLCAnVG9vbEJhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHBsYXkgPSBwYWdlLmxvY2F0b3IoVEIgKyAnLnRvb2xCYXItcGxhdGUtLXBsYXknKTtcblx0YXdhaXQgcGxheS5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKHBsYXkpLCAncmdiKDE2OSwgMTk0LCAxNTApJyk7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpbmsocGxheSksICdyZ2IoMTAxLCAxNDIsIDUyKScpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRjb25zdCBzdGVwID0gcGFnZS5sb2NhdG9yKFRCICsgJy50b29sQmFyLXBsYXRlLS1zdGVwJykuZmlyc3QoKTtcblx0YXdhaXQgc3RlcC5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKHN0ZXApLCBhd2FpdCB0b2tlbihwYWdlLCAnZm9yZWdyb3VuZC1ob3ZlcicpKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoc3RlcCksIGF3YWl0IHRva2VuKHBhZ2UsICdkcm9wZG93bicpKTtcbn0pO1xuXG5zY2VuYXJpbygnVG9vbEJhcjogcGlubmVkIHNwZWNpbWVucyBpZ25vcmUgY2xpY2tzJywgJ1Rvb2xCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBwaW5uZWQgPSBwYWdlLmxvY2F0b3IoJy50b29sQmFyW2RhdGEtcGlubmVkXScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGlubmVkLmNvdW50KCksIDIpO1xuXHRjb25zdCB0b2dnbGUgPSBwaW5uZWQubnRoKDEpLmxvY2F0b3IoJy50b29sQmFyLWJ0bi0tdG9nZ2xlJykuZmlyc3QoKTtcblx0YXdhaXQgdG9nZ2xlLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBoYXNDbGFzcyh0b2dnbGUsICdpcy1jaGVja2VkJyksIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AocGlubmVkLm50aCgxKS5sb2NhdG9yKCcudG9vbEJhci1idG4uaXMtcHJlc3NlZCcpLCAncGFkZGluZy10b3AnKSwgJzVweCcpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gUGxhY2VBY3RvcnNQYW5lbCAtLS0tLS0tLS0tXG5cbmNvbnN0IFBBID0gJ3VlLXBsYWNlLWFjdG9ycy1wYW5lbCAnO1xuY29uc3QgY2F0ID0gKHBhZ2U6IFBhZ2UsIG5hbWU6IHN0cmluZyk6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKFBBICsgJy5wbGFjZUFjdG9ycy1jYXRbZGF0YS1jYXRlZ29yeT1cIicgKyBuYW1lICsgJ1wiXScpO1xuY29uc3QgdmlzaWJsZVJvd3MgPSAocGFnZTogUGFnZSk6IFByb21pc2U8c3RyaW5nW10+ID0+IHRleHRzKHBhZ2UsIFBBICsgJy5wbGFjZUFjdG9ycy1ncm91cDpub3QoW2hpZGRlbl0pIC5wbGFjZUFjdG9ycy1yb3c6bm90KFtoaWRkZW5dKSAucGxhY2VBY3RvcnMtbmFtZScpO1xuXG5zY2VuYXJpbygnUGxhY2VBY3RvcnNQYW5lbDogY2xpY2tpbmcgYSBjYXRlZ29yeSBhY3RpdmF0ZXMgaXQgYW5kIHN3YXBzIHRoZSBsaXN0IGFuZCB0aGUgbGFiZWwnLCAnUGxhY2VBY3RvcnNQYW5lbCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdmlzaWJsZVJvd3MocGFnZSksIFsnQWN0b3InLCAnQ2hhcmFjdGVyJywgJ1Bhd24nLCAnUG9pbnQgTGlnaHQnLCAnUGxheWVyIFN0YXJ0J10pO1xuXHRhd2FpdCBjYXQocGFnZSwgJ0xpZ2h0cycpLmNsaWNrKCk7XG5cdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdmlzaWJsZVJvd3MocGFnZSksIFsnRGlyZWN0aW9uYWwgTGlnaHQnLCAnUG9pbnQgTGlnaHQnLCAnU3BvdCBMaWdodCcsICdSZWN0IExpZ2h0JywgJ1NreSBMaWdodCddKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihQQSArICcucGxhY2VBY3RvcnMtaGVhZGVyJykudGV4dENvbnRlbnQoKSwgJ0xpZ2h0cycpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY2F0KHBhZ2UsICdMaWdodHMnKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcpLCAndHJ1ZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY2F0KHBhZ2UsICdCYXNpYycpLmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJyksICdmYWxzZScpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChjYXQocGFnZSwgJ0xpZ2h0cycpKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ3ByaW1hcnknKSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKGNhdChwYWdlLCAnQmFzaWMnKSksIENMRUFSKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihQQSArICcucGxhY2VBY3RvcnMtY2F0LmlzLWFjdGl2ZScpLmNvdW50KCksIDEpO1xuXHRhd2FpdCBjYXQocGFnZSwgJ1ZvbHVtZXMnKS5jbGljaygpO1xuXHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHZpc2libGVSb3dzKHBhZ2UpLCBbJ1RyaWdnZXIgVm9sdW1lJywgJ0Jsb2NraW5nIFZvbHVtZSddKTtcbn0pO1xuXG5zY2VuYXJpbygnUGxhY2VBY3RvcnNQYW5lbDogYW4gaW5hY3RpdmUgY2F0ZWdvcnkgZmlsbHMgRHJvcGRvd24gb24gaG92ZXIsIHRoZSBhY3RpdmUgb25lIFByaW1hcnlIb3ZlcicsICdQbGFjZUFjdG9yc1BhbmVsJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXdhaXQgY2F0KHBhZ2UsICdTaGFwZXMnKS5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChjYXQocGFnZSwgJ1NoYXBlcycpKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2Ryb3Bkb3duJykpO1xuXHRhd2FpdCBjYXQocGFnZSwgJ0Jhc2ljJykuaG92ZXIoKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoY2F0KHBhZ2UsICdCYXNpYycpKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ3ByaW1hcnktaG92ZXInKSk7XG59KTtcblxuc2NlbmFyaW8oJ1BsYWNlQWN0b3JzUGFuZWw6IHR5cGluZyBmaWx0ZXJzIHRoZSByb3dzIGFuZCBzaG93cyB0aGUgY2xlYXIgYnV0dG9uJywgJ1BsYWNlQWN0b3JzUGFuZWwnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBmaWVsZCA9IHBhZ2UubG9jYXRvcihQQSArICcucGxhY2VBY3RvcnMtZmllbGQnKTtcblx0Y29uc3QgY2xlYXIgPSBwYWdlLmxvY2F0b3IoUEEgKyAnLnBsYWNlQWN0b3JzLWNsZWFyJyk7XG5cdGNvbnN0IGJveCA9IHBhZ2UubG9jYXRvcihQQSArICcucGxhY2VBY3RvcnMtc2VhcmNoYm94Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjbGVhci5pc1Zpc2libGUoKSwgZmFsc2UpO1xuXHRhd2FpdCBmaWVsZC5jbGljaygpO1xuXHRhc3NlcnQub2soKGF3YWl0IHByb3AoYm94LCAnYm94LXNoYWRvdycpKS5pbmNsdWRlcyhhd2FpdCB0b2tlbihwYWdlLCAncHJpbWFyeScpKSwgJ2ZvY3VzIG91dGxpbmUgaXMgUHJpbWFyeScpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJ2xpZ2h0Jyk7XG5cdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdmlzaWJsZVJvd3MocGFnZSksIFsnUG9pbnQgTGlnaHQnXSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjbGVhci5pc1Zpc2libGUoKSwgdHJ1ZSk7XG5cdGF3YWl0IGZpZWxkLmZpbGwoJ1BBJyk7XG5cdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdmlzaWJsZVJvd3MocGFnZSksIFsnUGF3biddKTtcblx0YXdhaXQgZmllbGQuZmlsbCgnenp6Jyk7XG5cdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdmlzaWJsZVJvd3MocGFnZSksIFtdKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihQQSArICcucGxhY2VBY3RvcnMtZW1wdHknKS5pc1Zpc2libGUoKSwgdHJ1ZSk7XG5cdGF3YWl0IGNsZWFyLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5pbnB1dFZhbHVlKCksICcnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGNsZWFyLmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbCgoYXdhaXQgdmlzaWJsZVJvd3MocGFnZSkpLmxlbmd0aCwgNSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoUEEgKyAnLnBsYWNlQWN0b3JzLWVtcHR5JykuaXNWaXNpYmxlKCksIGZhbHNlKTtcbn0pO1xuXG5zY2VuYXJpbygnUGxhY2VBY3RvcnNQYW5lbDogdGhlIGZpbHRlciBmb2xsb3dzIHRoZSBjYXRlZ29yeSBhbmQgRXNjYXBlIGNsZWFycyBpdCcsICdQbGFjZUFjdG9yc1BhbmVsJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZmllbGQgPSBwYWdlLmxvY2F0b3IoUEEgKyAnLnBsYWNlQWN0b3JzLWZpZWxkJyk7XG5cdGF3YWl0IGZpZWxkLmZpbGwoJ2xpZ2h0Jyk7XG5cdGF3YWl0IGNhdChwYWdlLCAnTGlnaHRzJykuY2xpY2soKTtcblx0YXNzZXJ0LmVxdWFsKChhd2FpdCB2aXNpYmxlUm93cyhwYWdlKSkubGVuZ3RoLCA1KTtcblx0YXdhaXQgY2F0KHBhZ2UsICdTaGFwZXMnKS5jbGljaygpO1xuXHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHZpc2libGVSb3dzKHBhZ2UpLCBbXSk7XG5cdGF3YWl0IGZpZWxkLmZvY3VzKCk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdFc2NhcGUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpZWxkLmlucHV0VmFsdWUoKSwgJycpO1xuXHRhc3NlcnQuZXF1YWwoKGF3YWl0IHZpc2libGVSb3dzKHBhZ2UpKS5sZW5ndGgsIDUpO1xufSk7XG5cbnNjZW5hcmlvKCdQbGFjZUFjdG9yc1BhbmVsOiByb3dzIHNob3cgaG92ZXIgYW5kIHByZXNzZWQgb3V0bGluZXMsIHRoZSBpbmZvIGJ1dHRvbiBmaWxscyBvbiBob3ZlcicsICdQbGFjZUFjdG9yc1BhbmVsJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3Qgcm93ID0gcGFnZS5sb2NhdG9yKFBBICsgJy5wbGFjZUFjdG9ycy1yb3cnKS5udGgoMSk7XG5cdGNvbnN0IGluZm8gPSByb3cubG9jYXRvcignLnBsYWNlQWN0b3JzLWluZm8nKTtcblx0YXNzZXJ0Lm9rKChhd2FpdCBwcm9wKHJvdywgJ2JveC1zaGFkb3cnKSkuaW5jbHVkZXMoYXdhaXQgdG9rZW4ocGFnZSwgJ2Ryb3Bkb3duJykpKTtcblx0YXdhaXQgcm93LmhvdmVyKHsgcG9zaXRpb246IHsgeDogNjAsIHk6IDEwIH0gfSk7XG5cdGFzc2VydC5vaygoYXdhaXQgcHJvcChyb3csICdib3gtc2hhZG93JykpLmluY2x1ZGVzKGF3YWl0IHRva2VuKHBhZ2UsICdob3ZlcicpKSk7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGFzc2VydC5vaygoYXdhaXQgcHJvcChyb3csICdib3gtc2hhZG93JykpLmluY2x1ZGVzKGF3YWl0IHRva2VuKHBhZ2UsICdwcmltYXJ5JykpKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoaW5mbyksIENMRUFSKTtcblx0YXdhaXQgaW5mby5ob3ZlcigpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChpbmZvKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2hvdmVyJykpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKGluZm8pLCBhd2FpdCB0b2tlbihwYWdlLCAnZm9yZWdyb3VuZC1ob3ZlcicpKTtcbn0pO1xuXG5zY2VuYXJpbygnUGxhY2VBY3RvcnNQYW5lbDogYXJyb3cga2V5cyBtb3ZlIHRoZSBjYXRlZ29yeSBhbmQgYWN0aXZhdGUgaXQnLCAnUGxhY2VBY3RvcnNQYW5lbCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGF3YWl0IGNhdChwYWdlLCAnQmFzaWMnKS5mb2N1cygpO1xuXHRhd2FpdCBwcmVzcyhwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY2F0KHBhZ2UsICdMaWdodHMnKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcpLCAndHJ1ZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5ldmFsdWF0ZSgoKSA9PiBkb2N1bWVudC5hY3RpdmVFbGVtZW50Py5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2F0ZWdvcnknKSksICdMaWdodHMnKTtcblx0YXdhaXQgcHJlc3MocGFnZSwgJ0VuZCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKFBBICsgJy5wbGFjZUFjdG9ycy1oZWFkZXInKS50ZXh0Q29udGVudCgpLCAnQWxsJyk7XG59KTtcblxuc2NlbmFyaW8oJ1BsYWNlQWN0b3JzUGFuZWw6IHBpbm5lZCBzcGVjaW1lbnMgaWdub3JlIGNsaWNrcyBhbmQga2VlcCB0aGVpciBmb3JjZWQgcm93cycsICdQbGFjZUFjdG9yc1BhbmVsJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgcGlubmVkID0gcGFnZS5sb2NhdG9yKCdkaXZbZGF0YS1waW5uZWRdJykuZmlyc3QoKTtcblx0YXdhaXQgcGlubmVkLmxvY2F0b3IoJy5wbGFjZUFjdG9ycy1jYXQnKS5udGgoMikuY2xpY2soKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBpbm5lZC5sb2NhdG9yKCcucGxhY2VBY3RvcnMtY2F0LmlzLWFjdGl2ZSB1c2UnKS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSwgJyNwbGFjZUFjdG9ycy1pLWJhc2ljJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwaW5uZWQubG9jYXRvcignLnBsYWNlQWN0b3JzLWhlYWRlcicpLnRleHRDb250ZW50KCksICdCYXNpYycpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGlubmVkLmxvY2F0b3IoJy5wbGFjZUFjdG9ycy1yb3cuaXMtaG92ZXInKS5jb3VudCgpLCAxKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBpbm5lZC5sb2NhdG9yKCcucGxhY2VBY3RvcnMtcm93LmlzLXByZXNzZWQnKS5jb3VudCgpLCAxKTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tIFN0YXR1c0JhciAtLS0tLS0tLS0tXG5cbmNvbnN0IFNCID0gJ3VlLXN0YXR1cy1iYXIgJztcbmNvbnN0IGRyYXdlciA9IChwYWdlOiBQYWdlLCBsYWJlbDogc3RyaW5nKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoU0IgKyAnLnN0YXR1c0Jhci1idG4nKS5maWx0ZXIoeyBoYXNUZXh0OiBsYWJlbCB9KTtcblxuc2NlbmFyaW8oJ1N0YXR1c0JhcjogdGhlIGRyYXdlciBidXR0b25zIHRvZ2dsZSBhbiBvcGVuIGxvb2ssIG9uZSBhdCBhIHRpbWUnLCAnU3RhdHVzQmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgY29udGVudCA9IGRyYXdlcihwYWdlLCAnQ29udGVudCBEcmF3ZXInKTtcblx0Y29uc3QgbG9nID0gZHJhd2VyKHBhZ2UsICdPdXRwdXQgTG9nJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpbmsoY29udGVudCksIGF3YWl0IHRva2VuKHBhZ2UsICdmb3JlZ3JvdW5kJykpO1xuXHRhd2FpdCBjb250ZW50LmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjb250ZW50LmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAndHJ1ZScpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKGNvbnRlbnQpLCBhd2FpdCB0b2tlbihwYWdlLCAnZm9yZWdyb3VuZC1ob3ZlcicpKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AoY29udGVudCwgJ3BhZGRpbmctdG9wJyksICczcHgnKTtcblx0YXdhaXQgbG9nLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjb250ZW50LmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAnZmFsc2UnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGxvZy5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSwgJ3RydWUnKTtcblx0YXdhaXQgbG9nLmNsaWNrKCk7XG5cdGF3YWl0IGF3YXkocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBsb2cuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICdmYWxzZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaW5rKGxvZyksIGF3YWl0IHRva2VuKHBhZ2UsICdmb3JlZ3JvdW5kJykpO1xufSk7XG5cbnNjZW5hcmlvKCdTdGF0dXNCYXI6IGEgZHJhd2VyIGJ1dHRvbiB0dXJucyB3aGl0ZSBvbiBob3ZlciBhbmQgc2hpZnRzIGRvd24gd2hpbGUgcHJlc3NlZCcsICdTdGF0dXNCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBsb2cgPSBkcmF3ZXIocGFnZSwgJ091dHB1dCBMb2cnKTtcblx0YXdhaXQgbG9nLmhvdmVyKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpbmsobG9nKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2ZvcmVncm91bmQtaG92ZXInKSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKGxvZyksIENMRUFSLCAnZHJhd2VyIGJ1dHRvbnMgaGF2ZSBubyBob3ZlciBmaWxsJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGxvZywgJ3BhZGRpbmctdG9wJyksICcycHgnKTtcblx0YXdhaXQgaG9sZChwYWdlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AobG9nLCAncGFkZGluZy10b3AnKSwgJzNweCcpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xufSk7XG5cbnNjZW5hcmlvKCdTdGF0dXNCYXI6IHRoZSBDbWQgY29tYm8gb3BlbnMgYW4gdXB3YXJkIG1lbnU7IGNob29zaW5nIGFuIGVudHJ5IHJlbmFtZXMgaXQnLCAnU3RhdHVzQmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgY21kID0gcGFnZS5sb2NhdG9yKFNCICsgJy5zdGF0dXNCYXItY21kJyk7XG5cdGNvbnN0IG1lbnUgPSBwYWdlLmxvY2F0b3IoU0IgKyAnLnN0YXR1c0Jhci1tZW51Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51LmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGF3YWl0IGNtZC5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudS5pc1Zpc2libGUoKSwgdHJ1ZSk7XG5cdGNvbnN0IG1lbnVCb3ggPSBhd2FpdCBtZW51LmJvdW5kaW5nQm94KCk7XG5cdGNvbnN0IGNtZEJveCA9IGF3YWl0IGNtZC5ib3VuZGluZ0JveCgpO1xuXHRhc3NlcnQub2sobWVudUJveCAmJiBjbWRCb3ggJiYgbWVudUJveC55ICsgbWVudUJveC5oZWlnaHQgPD0gY21kQm94LnksICd0aGUgbWVudSBvcGVucyBhYm92ZSB0aGUgY29tYm8nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoY21kKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2Ryb3Bkb3duJykpO1xuXHRhd2FpdCBwcmVzcyhwYWdlLCAnRXNjYXBlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51LmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGF3YWl0IGNtZC5jbGljaygpO1xuXHRhd2FpdCBjbGlja0F3YXkocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51LmlzVmlzaWJsZSgpLCBmYWxzZSk7XG5cdGF3YWl0IGNtZC5jbGljaygpO1xuXHRhd2FpdCBtZW51LmxvY2F0b3IoJy5zdGF0dXNCYXItcm93JykuZmlsdGVyKHsgaGFzVGV4dDogJ1B5dGhvbicgfSkuY2xpY2soKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnUuaXNWaXNpYmxlKCksIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKChhd2FpdCBjbWQudGV4dENvbnRlbnQoKSk/LnRyaW0oKSwgJ1B5dGhvbicpO1xufSk7XG5cbnNjZW5hcmlvKCdTdGF0dXNCYXI6IHRoZSBjb25zb2xlIGJveCB0YWtlcyBmb2N1cywgRW50ZXIgbG9ncyB0aGUgY29tbWFuZCBhbmQgY2xlYXJzIHRoZSBib3gnLCAnU3RhdHVzQmFyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZmllbGQgPSBwYWdlLmxvY2F0b3IoU0IgKyAnLnN0YXR1c0Jhci1maWVsZCcpO1xuXHRjb25zdCBib3ggPSBwYWdlLmxvY2F0b3IoU0IgKyAnLnN0YXR1c0Jhci1pbnB1dCcpO1xuXHRjb25zdCBoaXN0b3J5ID0gU0IgKyAnLnN0YXR1c0Jhci1oaXN0b3J5LWxpbmUnO1xuXHRhc3NlcnQub2soIShhd2FpdCBwcm9wKGJveCwgJ2JveC1zaGFkb3cnKSkuaW5jbHVkZXMoYXdhaXQgdG9rZW4ocGFnZSwgJ3ByaW1hcnknKSkpO1xuXHRhd2FpdCBmaWVsZC5jbGljaygpO1xuXHRhc3NlcnQub2soKGF3YWl0IHByb3AoYm94LCAnYm94LXNoYWRvdycpKS5pbmNsdWRlcyhhd2FpdCB0b2tlbihwYWdlLCAncHJpbWFyeScpKSwgJ2ZvY3VzIHJpbmcgaXMgUHJpbWFyeScpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJ3N0YXQgZnBzJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5pbnB1dFZhbHVlKCksICdzdGF0IGZwcycpO1xuXHRhd2FpdCBwcmVzcyhwYWdlLCAnRW50ZXInKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpZWxkLmlucHV0VmFsdWUoKSwgJycpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJ3QuTWF4RlBTIDMwJyk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdFbnRlcicpO1xuXHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHRleHRzKHBhZ2UsIGhpc3RvcnkpLCBbJz4gc3RhdCBmcHMnLCAnPiB0Lk1heEZQUyAzMCddKTtcblx0YXdhaXQgcHJlc3MocGFnZSwgJ0Fycm93VXAnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpZWxkLmlucHV0VmFsdWUoKSwgJ3QuTWF4RlBTIDMwJyk7XG5cdGF3YWl0IHByZXNzKHBhZ2UsICdBcnJvd1VwJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5pbnB1dFZhbHVlKCksICdzdGF0IGZwcycpO1xuXHRhd2FpdCBmaWVsZC5maWxsKCcgICAnKTtcblx0YXdhaXQgcHJlc3MocGFnZSwgJ0VudGVyJyk7XG5cdGFzc2VydC5lcXVhbCgoYXdhaXQgdGV4dHMocGFnZSwgaGlzdG9yeSkpLmxlbmd0aCwgMiwgJ2EgYmxhbmsgbGluZSBpcyBub3QgYSBjb21tYW5kJyk7XG5cdGZvciAoY29uc3QgY29tbWFuZCBvZiBbJ2EnLCAnYicsICdjJywgJ2QnXSkge1xuXHRcdGF3YWl0IGZpZWxkLmZpbGwoY29tbWFuZCk7XG5cdFx0YXdhaXQgcHJlc3MocGFnZSwgJ0VudGVyJyk7XG5cdH1cblx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0ZXh0cyhwYWdlLCBoaXN0b3J5KSwgWyc+IGEnLCAnPiBiJywgJz4gYycsICc+IGQnXSk7XG59KTtcblxuc2NlbmFyaW8oJ1N0YXR1c0JhcjogRGVyaXZlZCBEYXRhIGFuZCBTb3VyY2UgQ29udHJvbCBmaWxsIERyb3Bkb3duIG9uIGhvdmVyJywgJ1N0YXR1c0JhcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGZvciAoY29uc3QgbGFiZWwgb2YgWydEZXJpdmVkIERhdGEnLCAnU291cmNlIENvbnRyb2wgT2ZmJ10pIHtcblx0XHRjb25zdCBjb21ibyA9IHBhZ2UubG9jYXRvcihTQiArICcuc3RhdHVzQmFyLWNvbWJvLS1zdGF0dXMnKS5maWx0ZXIoeyBoYXNUZXh0OiBsYWJlbCB9KTtcblx0XHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChjb21ibyksIENMRUFSKTtcblx0XHRhd2FpdCBjb21iby5ob3ZlcigpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKGNvbWJvKSwgYXdhaXQgdG9rZW4ocGFnZSwgJ2Ryb3Bkb3duJykpO1xuXHRcdGFzc2VydC5lcXVhbChhd2FpdCBpbmsoY29tYm8pLCBhd2FpdCB0b2tlbihwYWdlLCAnZm9yZWdyb3VuZC1ob3ZlcicpKTtcblx0fVxufSk7XG5cbnNjZW5hcmlvKCdTdGF0dXNCYXI6IHBpbm5lZCBzcGVjaW1lbnMgaWdub3JlIGNsaWNrcyBhbmQga2VlcCB0aGVpciBob3ZlciBzdGF0ZScsICdTdGF0dXNCYXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBwaW5uZWQgPSBwYWdlLmxvY2F0b3IoJy5zdGF0dXNCYXJbZGF0YS1waW5uZWRdJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwaW5uZWQuY291bnQoKSwgMik7XG5cdGF3YWl0IHBpbm5lZC5udGgoMCkubG9jYXRvcignLnN0YXR1c0Jhci1idG4nKS5maXJzdCgpLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJy5zdGF0dXNCYXJbZGF0YS1waW5uZWRdIC5zdGF0dXNCYXItYnRuLmlzLW9wZW4nKS5jb3VudCgpLCAwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGluayhwaW5uZWQubnRoKDEpLmxvY2F0b3IoJy5zdGF0dXNCYXItYnRuLmlzLWhvdmVyJykpLCBhd2FpdCB0b2tlbihwYWdlLCAnZm9yZWdyb3VuZC1ob3ZlcicpKTtcbn0pO1xuIiwgIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBTbWFsbCBwYWdlIHByb2JlcyBzaGFyZWQgYnkgdGhlIHByZXZpZXcgdGVzdHM6IGNvbXB1dGVkIHN0eWxlcywgdG9rZW5zLCBrZXlzIGFuZCB0aGUgbW91c2UuXG5pbXBvcnQgdHlwZSB7IExvY2F0b3IsIFBhZ2UgfSBmcm9tICdwbGF5d3JpZ2h0JztcblxuZXhwb3J0IGNvbnN0IENMRUFSID0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4vLyBSZXNvbHZlcyBhIGRlc2lnbiB0b2tlbiB0byB0aGUgY29sb3VyIHN0cmluZyB0aGUgYnJvd3NlciBjb21wdXRlcyBmb3IgaXQuXG5leHBvcnQgY29uc3QgdG9rZW4gPSAocGFnZTogUGFnZSwgbmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+XG5cdHBhZ2UuZXZhbHVhdGUoKG4pID0+IHtcblx0XHRjb25zdCBwcm9iZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHByb2JlLnN0eWxlLmJhY2tncm91bmQgPSAndmFyKC0tJyArIG4gKyAnKSc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmQocHJvYmUpO1xuXHRcdGNvbnN0IGNvbG91ciA9IGdldENvbXB1dGVkU3R5bGUocHJvYmUpLmJhY2tncm91bmRDb2xvcjtcblx0XHRwcm9iZS5yZW1vdmUoKTtcblx0XHRyZXR1cm4gY29sb3VyO1xuXHR9LCBuYW1lKTtcblxuZXhwb3J0IGNvbnN0IHByb3AgPSAodGFyZ2V0OiBMb2NhdG9yLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCwgbikgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuZ2V0UHJvcGVydHlWYWx1ZShuKSwgbmFtZSk7XG5leHBvcnQgY29uc3QgZmlsbCA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gcHJvcCh0YXJnZXQsICdiYWNrZ3JvdW5kLWNvbG9yJyk7XG5leHBvcnQgY29uc3QgaW5rID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nPiA9PiBwcm9wKHRhcmdldCwgJ2NvbG9yJyk7XG5leHBvcnQgY29uc3QgaGFzQ2xhc3MgPSAodGFyZ2V0OiBMb2NhdG9yLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwsIG4pID0+IGVsLmNsYXNzTGlzdC5jb250YWlucyhuKSwgbmFtZSk7XG5leHBvcnQgY29uc3QgdGV4dHMgPSAocGFnZTogUGFnZSwgc2VsZWN0b3I6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+ID0+IHBhZ2UuJCRldmFsKHNlbGVjdG9yLCAoZWxzKSA9PiBlbHMubWFwKChlbCkgPT4gZWwudGV4dENvbnRlbnQ/LnRyaW0oKSA/PyAnJykpO1xuZXhwb3J0IGNvbnN0IGZvY3VzZWRUZXh0ID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZz4gPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiBkb2N1bWVudC5hY3RpdmVFbGVtZW50Py50ZXh0Q29udGVudD8udHJpbSgpID8/ICcnKTtcbmV4cG9ydCBjb25zdCBhZnRlciA9ICh0YXJnZXQ6IExvY2F0b3IpOiBMb2NhdG9yID0+IHRhcmdldC5sb2NhdG9yKCd4cGF0aD1mb2xsb3dpbmctc2libGluZzo6KlsxXScpO1xuZXhwb3J0IGNvbnN0IHByZXNzID0gKHBhZ2U6IFBhZ2UsIGtleTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiBwYWdlLmtleWJvYXJkLnByZXNzKGtleSk7XG5leHBvcnQgY29uc3QgaG9sZCA9IChwYWdlOiBQYWdlKTogUHJvbWlzZTx2b2lkPiA9PiBwYWdlLm1vdXNlLmRvd24oKTtcbmV4cG9ydCBjb25zdCByZWxlYXNlID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UudXAoKTtcbmV4cG9ydCBjb25zdCBhd2F5ID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UubW92ZSg5MDAsIDcwMCk7XG5leHBvcnQgY29uc3QgY2xpY2tBd2F5ID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuY2xpY2soOTAwLCA3MDApO1xuIiwgIi8vIERlY2xhcmVzIG9uZSBwcmV2aWV3IHRlc3Q6IG9wZW5zIHRoZSBwcmV2aWV3LCBydW5zIHRoZSBib2R5LCB0aGVuIGFzc2VydHMgdGhlIHBhZ2UgcmFpc2VkIG5vIGVycm9ycy5cbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQvc3RyaWN0JztcbmltcG9ydCB7IHRlc3QgfSBmcm9tICdub2RlOnRlc3QnO1xuaW1wb3J0IHR5cGUgeyBQYWdlIH0gZnJvbSAncGxheXdyaWdodCc7XG5pbXBvcnQgeyBvcGVuUHJldmlldywgd2l0aEJyb3dzZXIgfSBmcm9tICcuL2xpYi50cyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzY2VuYXJpbyhuYW1lOiBzdHJpbmcsIGNvbXBvbmVudDogc3RyaW5nLCBib2R5OiAocGFnZTogUGFnZSkgPT4gUHJvbWlzZTx2b2lkPik6IHZvaWQge1xuXHR0ZXN0KG5hbWUsICgpID0+XG5cdFx0d2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCBjb21wb25lbnQpO1xuXHRcdFx0YXdhaXQgYm9keShwYWdlKTtcblx0XHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSwgJ3RoZSBwYWdlIHJhaXNlZCBjb25zb2xlIG9yIHBhZ2UgZXJyb3JzJyk7XG5cdFx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdFx0fSksXG5cdCk7XG59XG4iLCAiLy8vIDxyZWZlcmVuY2UgbGliPVwiZG9tXCIgLz5cbi8vIFNoYXJlZCBoZWxwZXJzIGZvciB0aGUgcHJldmlldyBpbnRlcmFjdGlvbiB0ZXN0cy4gVGhlIERPTSBsaWIgdHlwZXMgdGhlIGNhbGxiYWNrcyB0aGF0IHJ1biBpbiB0aGUgcGFnZS5cbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCBodHRwIGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IGNocm9taXVtLCB0eXBlIEJyb3dzZXIsIHR5cGUgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuXG5jb25zdCBoZXJlID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG5leHBvcnQgY29uc3Qgcm9vdCA9IHBhdGgucmVzb2x2ZShoZXJlLCAnLi4nLCAnZGVzaWduLXN5c3RlbScpO1xuXG5pbnRlcmZhY2UgVG9rZW5WYWx1ZSB7IFt0aGVtZTogc3RyaW5nXTogc3RyaW5nIH1cbmludGVyZmFjZSBUb2tlbnMge1xuXHRjb2xvcjogeyB0aGVtZXM6IEFycmF5PHsgaWQ6IHN0cmluZyB9PjsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB8IFRva2VuVmFsdWUgfT4gfTtcblx0c3BhY2luZzogeyB0b2tlbnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0+IH07XG5cdHJhZGl1czogeyB0b2tlbnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0+IH07XG5cdHR5cGU6IHsgZmFtaWxpZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfTtcbn1cblxuLy8gQnVpbGRzIHRoZSB0b2tlbnMuY3NzIHRoYXQgdGhlIHByZXZpZXcgZnJhbWUgcHJlbG9hZHMsIGZyb20gdG9rZW5zLmpzb24gKGZpcnN0IHRoZW1lKS5cbmV4cG9ydCBmdW5jdGlvbiB0b2tlbnNDc3MoKTogc3RyaW5nIHtcblx0Y29uc3QgdG9rZW5zID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJvb3QsICd0b2tlbnMuanNvbicpLCAndXRmOCcpKSBhcyBUb2tlbnM7XG5cdGNvbnN0IHRoZW1lID0gdG9rZW5zLmNvbG9yLnRoZW1lc1swXS5pZDtcblx0Y29uc3QgdmFyczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgcmVzb2x2ZSA9ICh2YWx1ZTogc3RyaW5nIHwgVG9rZW5WYWx1ZSk6IHN0cmluZyA9PiB7XG5cdFx0Y29uc3QgcmF3ID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IHZhbHVlIDogdmFsdWVbdGhlbWVdO1xuXHRcdGNvbnN0IGFsaWFzID0gL15cXHsoLispXFx9JC8uZXhlYyhyYXcpO1xuXHRcdHJldHVybiBhbGlhcyA/ICd2YXIoLS0nICsgYWxpYXNbMV0gKyAnKScgOiByYXc7XG5cdH07XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMuY29sb3IudG9rZW5zKSB2YXJzLnB1c2goJy0tJyArIHQubmFtZSArICc6ICcgKyByZXNvbHZlKHQudmFsdWUpICsgJzsnKTtcblx0Zm9yIChjb25zdCB0IG9mIHRva2Vucy5zcGFjaW5nLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgdC52YWx1ZSArICc7Jyk7XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMucmFkaXVzLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgdC52YWx1ZSArICc7Jyk7XG5cdGZvciAoY29uc3QgW2tleSwgc3RhY2tdIG9mIE9iamVjdC5lbnRyaWVzKHRva2Vucy50eXBlLmZhbWlsaWVzKSkgdmFycy5wdXNoKCctLWZvbnQtJyArIGtleSArICc6ICcgKyBzdGFjayArICc7Jyk7XG5cdHJldHVybiAnOnJvb3QgeyAnICsgdmFycy5qb2luKCcgJykgKyAnIH1cXG5ib2R5IHsgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZCk7IGNvbG9yOiB2YXIoLS1mb3JlZ3JvdW5kKTsgfSc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlldyB7XG5cdHBhZ2U6IFBhZ2U7XG5cdGVycm9yczogc3RyaW5nW107XG59XG5cbmNvbnN0IE1JTUU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdCcuaHRtbCc6ICd0ZXh0L2h0bWw7IGNoYXJzZXQ9dXRmLTgnLFxuXHQnLmpzJzogJ3RleHQvamF2YXNjcmlwdDsgY2hhcnNldD11dGYtOCcsXG5cdCcuY3NzJzogJ3RleHQvY3NzOyBjaGFyc2V0PXV0Zi04Jyxcblx0Jy5qc29uJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHQnLnBuZyc6ICdpbWFnZS9wbmcnLFxuXHQnLnN2Zyc6ICdpbWFnZS9zdmcreG1sJyxcbn07XG5cbmxldCBiYXNlVXJsOiBQcm9taXNlPHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cbi8vIFNlcnZlcyBkZXNpZ24tc3lzdGVtIG92ZXIgaHR0cCwgYmVjYXVzZSBDaHJvbWl1bSBibG9ja3MgbW9kdWxlIHNjcmlwdHMgb24gZmlsZTovLy4gT25lIHNlcnZlciBwZXIgcHJvY2Vzcy5cbmZ1bmN0aW9uIHNlcnZlKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdGJhc2VVcmwgPz89IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCBzZXJ2ZXIgPSBodHRwLmNyZWF0ZVNlcnZlcigocmVxLCByZXMpID0+IHtcblx0XHRcdGNvbnN0IGZpbGUgPSBwYXRoLmpvaW4ocm9vdCwgZGVjb2RlVVJJQ29tcG9uZW50KG5ldyBVUkwocmVxLnVybCA/PyAnLycsICdodHRwOi8veCcpLnBhdGhuYW1lKSk7XG5cdFx0XHRpZiAoIWZpbGUuc3RhcnRzV2l0aChyb290KSB8fCAhZnMuZXhpc3RzU3luYyhmaWxlKSB8fCBmcy5zdGF0U3luYyhmaWxlKS5pc0RpcmVjdG9yeSgpKSB7XG5cdFx0XHRcdHJlcy53cml0ZUhlYWQoNDA0KS5lbmQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVzLndyaXRlSGVhZCgyMDAsIHsgJ2NvbnRlbnQtdHlwZSc6IE1JTUVbcGF0aC5leHRuYW1lKGZpbGUpXSA/PyAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyB9KTtcblx0XHRcdGZzLmNyZWF0ZVJlYWRTdHJlYW0oZmlsZSkucGlwZShyZXMpO1xuXHRcdH0pO1xuXHRcdHNlcnZlci5vbignZXJyb3InLCByZWplY3QpO1xuXHRcdHNlcnZlci5saXN0ZW4oMCwgJzEyNy4wLjAuMScsICgpID0+IHtcblx0XHRcdHNlcnZlci51bnJlZigpO1xuXHRcdFx0Y29uc3QgYWRkcmVzcyA9IHNlcnZlci5hZGRyZXNzKCk7XG5cdFx0XHRyZXNvbHZlKCdodHRwOi8vMTI3LjAuMC4xOicgKyAodHlwZW9mIGFkZHJlc3MgPT09ICdvYmplY3QnICYmIGFkZHJlc3MgPyBhZGRyZXNzLnBvcnQgOiAwKSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRyZXR1cm4gYmFzZVVybDtcbn1cblxuLy8gT3BlbnMgYSBjb21wb25lbnQgcHJldmlldyB3aXRoIHRoZSB0b2tlbnMgaW5qZWN0ZWQuIENvbnNvbGUgYW5kIHBhZ2UgZXJyb3JzIGNvbGxlY3QgaW4gYGVycm9yc2AuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlblByZXZpZXcoYnJvd3NlcjogQnJvd3NlciwgbmFtZTogc3RyaW5nLCB2aWV3cG9ydCA9IHsgd2lkdGg6IDEwMDAsIGhlaWdodDogODAwIH0pOiBQcm9taXNlPFByZXZpZXc+IHtcblx0Y29uc3QgcGFnZSA9IGF3YWl0IGJyb3dzZXIubmV3UGFnZSh7IHZpZXdwb3J0IH0pO1xuXHRjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cdHBhZ2Uub24oJ3BhZ2VlcnJvcicsIChlKSA9PiBlcnJvcnMucHVzaChTdHJpbmcoZSkpKTtcblx0cGFnZS5vbignY29uc29sZScsIChtKSA9PiB7XG5cdFx0aWYgKG0udHlwZSgpID09PSAnZXJyb3InICYmICEvZm9udHNcXC5nfEVSUl98RmFpbGVkIHRvIGxvYWQgcmVzb3VyY2UvLnRlc3QobS50ZXh0KCkpKSBlcnJvcnMucHVzaChtLnRleHQoKSk7XG5cdH0pO1xuXHRhd2FpdCBwYWdlLmdvdG8oKGF3YWl0IHNlcnZlKCkpICsgJy9jb21wb25lbnRzLycgKyBuYW1lICsgJy9wcmV2aWV3Lmh0bWwnKTtcblx0YXdhaXQgcGFnZS5hZGRTdHlsZVRhZyh7IGNvbnRlbnQ6IHRva2Vuc0NzcygpIH0pO1xuXHRhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KDEwMCk7XG5cdHJldHVybiB7IHBhZ2UsIGVycm9ycyB9O1xufVxuXG4vLyBSdW5zIGEgdGVzdCBib2R5IHdpdGggYSBmcmVzaCBicm93c2VyIGFuZCBhbHdheXMgY2xvc2VzIGl0LlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhCcm93c2VyKGJvZHk6IChicm93c2VyOiBCcm93c2VyKSA9PiBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGJyb3dzZXIgPSBhd2FpdCBjaHJvbWl1bS5sYXVuY2goKTtcblx0dHJ5IHtcblx0XHRhd2FpdCBib2R5KGJyb3dzZXIpO1xuXHR9IGZpbmFsbHkge1xuXHRcdGF3YWl0IGJyb3dzZXIuY2xvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgYmFja2dyb3VuZCA9IChwYWdlOiBQYWdlLCBzZWxlY3Rvcjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHBhZ2UuJGV2YWwoc2VsZWN0b3IsIChlbCkgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuYmFja2dyb3VuZENvbG9yKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLFVBQVVBLGVBQWM7OztBQ0cxQixJQUFNLFFBQVE7QUFHZCxJQUFNLFFBQVEsQ0FBQyxNQUFZLFNBQ2pDLEtBQUssU0FBUyxDQUFDLE1BQU07QUFDcEIsUUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFFBQU0sTUFBTSxhQUFhLFdBQVcsSUFBSTtBQUN4QyxXQUFTLEtBQUssT0FBTyxLQUFLO0FBQzFCLFFBQU0sU0FBUyxpQkFBaUIsS0FBSyxFQUFFO0FBQ3ZDLFFBQU0sT0FBTztBQUNiLFNBQU87QUFDUixHQUFHLElBQUk7QUFFRCxJQUFNLE9BQU8sQ0FBQyxRQUFpQixTQUFrQyxPQUFPLFNBQVMsQ0FBQyxJQUFJLE1BQU0saUJBQWlCLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxHQUFHLElBQUk7QUFDMUksSUFBTSxPQUFPLENBQUMsV0FBcUMsS0FBSyxRQUFRLGtCQUFrQjtBQUNsRixJQUFNLE1BQU0sQ0FBQyxXQUFx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
