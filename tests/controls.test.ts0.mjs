// tests/controls.test.ts
import assert2 from "node:assert/strict";

// tests/probe.ts
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
var hasClass = (target, name) => target.evaluate((el, n) => el.classList.contains(n), name);
var hold = (page) => page.mouse.down();
var release = (page) => page.mouse.up();
var away = (page) => page.mouse.move(900, 700);

// tests/scenario.ts
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

// tests/scenario.ts
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

// tests/controls.test.ts
var shadow = (target) => prop(target, "box-shadow");
var wait = (page, ms) => page.waitForTimeout(ms);
var tap = (page, ...names) => names.reduce((chain, name) => chain.then(() => page.keyboard.press(name)), Promise.resolve());
var isFocused = (target) => target.evaluate((el) => el === document.activeElement);
async function seen(target, expected) {
  assert2.equal(await target.isVisible(), expected, "visible: expected " + expected);
}
async function attr(target, name, expected) {
  assert2.equal(await target.getAttribute(name), expected, name);
}
async function cls(target, name, expected) {
  assert2.equal(await hasClass(target, name), expected, "class " + name);
}
async function paints(page, target, name) {
  const expected = await token(page, name);
  await settled(() => fill(target), expected);
  assert2.equal(await fill(target), expected, "fill should be " + name);
}
async function settled(read, expected) {
  for (let attempt = 0; attempt < 20 && await read() !== expected; attempt++) await new Promise((done) => setTimeout(done, 50));
}
async function inks(page, target, property, name) {
  const expected = await token(page, name);
  await settled(() => prop(target, property), expected);
  assert2.equal(await prop(target, property), expected, property + " should be " + name);
}
async function outlineIs(page, target, name) {
  assert2.ok((await shadow(target)).startsWith(await token(page, name)), "outline " + await shadow(target) + " should start with " + name);
}
async function centre(target) {
  const box = await target.boundingBox();
  assert2.ok(box, "bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function pointAt(page, target) {
  const c = await centre(target);
  await page.mouse.move(c.x, c.y);
  return c;
}
var BTN = "ue-button .button";
scenario("Button: hover fills Hover, primary hovers to PrimaryHover, simple hovers to Dropdown", "Button", async (page) => {
  const plain = page.locator(BTN).nth(0);
  const primary = page.locator(BTN).nth(1);
  const simple = page.locator(BTN).nth(3);
  await paints(page, plain, "secondary");
  await pointAt(page, plain);
  await paints(page, plain, "hover");
  assert2.equal(await fill(plain), await fill(page.locator(".button--hover").first()));
  await pointAt(page, primary);
  await paints(page, primary, "primary-hover");
  await pointAt(page, simple);
  await paints(page, simple, "dropdown");
  await inks(page, simple, "color", "foreground-hover");
});
scenario("Button: the mouse press uses the pressed fill and drops the label 1px", "Button", async (page) => {
  const plain = page.locator(BTN).nth(0);
  const primary = page.locator(BTN).nth(1);
  assert2.equal(await prop(plain, "padding-top"), "3.5px");
  await pointAt(page, plain);
  await hold(page);
  await paints(page, plain, "header");
  assert2.equal(await prop(plain, "padding-top"), "4.5px");
  assert2.equal(await prop(plain, "padding-bottom"), "2.5px");
  await release(page);
  assert2.equal(await prop(plain, "padding-top"), "3.5px");
  await pointAt(page, primary);
  await hold(page);
  await paints(page, primary, "primary-press");
  await release(page);
});
scenario("Button: clicks register in the counter, a disabled button does not count", "Button", async (page) => {
  const counter = page.locator("ue-button .button-count");
  assert2.equal(await counter.textContent(), "Clicks: 0");
  await page.locator(BTN).nth(0).click();
  await page.locator(BTN).nth(1).click();
  await page.locator(BTN).nth(4).click();
  assert2.match(await counter.textContent() ?? "", /^Clicks: 3 \(last: Settings\)/);
  const disabled = page.locator(BTN).nth(5);
  assert2.equal(await disabled.isDisabled(), true);
  await disabled.click({ force: true });
  assert2.match(await counter.textContent() ?? "", /^Clicks: 3/);
  assert2.equal(await prop(disabled, "opacity"), "0.45");
});
scenario("Button: Space and Enter press the focused button, with the pressed look while held", "Button", async (page) => {
  const counter = page.locator("ue-button .button-count");
  const plain = page.locator(BTN).nth(0);
  await plain.focus();
  await page.keyboard.down(" ");
  await cls(plain, "button--pressed", true);
  await paints(page, plain, "header");
  assert2.equal(await prop(plain, "padding-top"), "4.5px");
  await page.keyboard.up(" ");
  await cls(plain, "button--pressed", false);
  assert2.match(await counter.textContent() ?? "", /^Clicks: 1/);
  await tap(page, "Enter");
  assert2.match(await counter.textContent() ?? "", /^Clicks: 2/);
});
scenario("Button: Tab shows the Primary focus ring", "Button", async (page) => {
  await tap(page, "Tab");
  const first = page.locator(BTN).nth(0);
  assert2.equal(await isFocused(first), true);
  await outlineIs(page, first, "primary");
});
scenario("Button: pinned specimens ignore the pointer and sit outside the element", "Button", async (page) => {
  const pinned = page.locator(".button--hover[data-pinned]").first();
  assert2.equal(await prop(pinned, "pointer-events"), "none");
  assert2.equal(await pinned.evaluate((el) => el.closest("ue-button")), null);
  await paints(page, pinned, "hover");
});
var CB = "ue-combo-button ";
var cbTrigger = (page, index) => page.locator(CB + ".combobutton-anchor").nth(index).locator(".combobutton");
var cbMenu = (page, index) => page.locator(CB + ".combobutton-anchor").nth(index).locator(".combobutton-menu");
var cbLabel = (trigger) => trigger.locator(".combobutton__label").textContent();
scenario("ComboButton: a click opens the popup with the open look, choosing sets the label and closes", "ComboButton", async (page) => {
  const trigger = cbTrigger(page, 0);
  const menu2 = cbMenu(page, 0);
  await seen(menu2, false);
  await trigger.click();
  await seen(menu2, true);
  await attr(trigger, "aria-expanded", "true");
  await cls(trigger, "combobutton--open", true);
  assert2.equal(await prop(trigger, "padding-top"), "2px");
  await outlineIs(page, trigger, "hover");
  await menu2.locator(".combobutton-row-item").nth(2).click();
  await seen(menu2, false);
  assert2.equal(await cbLabel(trigger), "Scale");
  assert2.equal(await page.locator(CB + ".combobutton-status").textContent(), "Picked: Scale");
  await attr(trigger, "aria-expanded", "false");
  assert2.equal(await prop(trigger, "padding-top"), "1px");
});
scenario("ComboButton: hovering a row fills it with Primary, hovering the button lights its outline", "ComboButton", async (page) => {
  const trigger = cbTrigger(page, 0);
  await outlineIs(page, trigger, "input-outline");
  await pointAt(page, trigger);
  await outlineIs(page, trigger, "hover");
  await trigger.click();
  const rows = cbMenu(page, 0).locator(".combobutton-row-item");
  assert2.equal(await fill(rows.nth(1)), CLEAR);
  await pointAt(page, rows.nth(1));
  await paints(page, rows.nth(1), "primary");
  await cls(rows.nth(1), "combobutton-row-item--hover", true);
});
scenario("ComboButton: the keyboard opens with Down, arrows move, Enter picks, Escape cancels", "ComboButton", async (page) => {
  const trigger = cbTrigger(page, 0);
  const menu2 = cbMenu(page, 0);
  const rows = menu2.locator(".combobutton-row-item");
  await trigger.focus();
  await tap(page, "ArrowDown");
  await seen(menu2, true);
  await cls(rows.nth(0), "combobutton-row-item--hover", true);
  await tap(page, "ArrowDown", "ArrowDown");
  await cls(rows.nth(2), "combobutton-row-item--hover", true);
  await cls(rows.nth(2), "combobutton-row-item--focus", true);
  await tap(page, "ArrowDown");
  await cls(rows.nth(0), "combobutton-row-item--hover", true);
  await tap(page, "ArrowUp", "Enter");
  await seen(menu2, false);
  assert2.equal(await cbLabel(trigger), "Scale");
  await tap(page, "Enter");
  await seen(menu2, true);
  await tap(page, "Home", "Escape");
  await seen(menu2, false);
  assert2.equal(await cbLabel(trigger), "Scale");
  assert2.equal(await isFocused(trigger), true);
  await tap(page, "Space");
  await seen(menu2, true);
  await cls(rows.nth(2), "combobutton-row-item--hover", true);
});
scenario("ComboButton: an outside click closes the popup and opening one closes the other", "ComboButton", async (page) => {
  await cbTrigger(page, 0).click();
  await seen(cbMenu(page, 0), true);
  await cbTrigger(page, 1).click();
  await seen(cbMenu(page, 0), false);
  await seen(cbMenu(page, 1), true);
  await page.mouse.click(700, 150);
  await seen(cbMenu(page, 1), false);
});
scenario("ComboButton: the simple variant keeps its label, a disabled one does not open", "ComboButton", async (page) => {
  const simple = cbTrigger(page, 1);
  await simple.click();
  await cbMenu(page, 1).locator(".combobutton-row-item").nth(1).click();
  assert2.equal(await cbLabel(simple), "Settings");
  assert2.equal(await page.locator(CB + ".combobutton-status").textContent(), "Picked: Project Settings");
  const disabled = page.locator(CB + '.combobutton[aria-disabled="true"]');
  assert2.equal(await prop(disabled, "opacity"), "0.45");
  await disabled.click({ force: true });
  assert2.equal(await page.locator(CB + ".combobutton-menu:not([hidden])").count(), 0);
});
var CK = "ue-checkbox ";
var ck = (page, label) => page.locator(CK + '[data-label="' + label + '"]');
scenario("Checkbox: a click toggles and the glyph follows the state", "Checkbox", async (page) => {
  const box = ck(page, "Simulate Physics");
  const glyph = box.locator(".checkbox__glyph--check");
  await attr(box, "aria-checked", "false");
  await seen(glyph, false);
  await box.click();
  await attr(box, "aria-checked", "true");
  await seen(glyph, true);
  await seen(box.locator(".checkbox__glyph--mixed"), false);
  assert2.equal(await page.locator(CK + ".checkbox-status").textContent(), "Last change: Simulate Physics is checked");
  await box.click();
  await attr(box, "aria-checked", "false");
});
scenario("Checkbox: Space and Enter toggle the focused box, with the pressed class while held", "Checkbox", async (page) => {
  const box = ck(page, "Enable Gravity");
  await box.focus();
  await attr(box, "aria-checked", "true");
  await page.keyboard.down(" ");
  await cls(box, "checkbox--pressed", true);
  await attr(box, "aria-checked", "true");
  await page.keyboard.up(" ");
  await attr(box, "aria-checked", "false");
  await tap(page, "Enter");
  await attr(box, "aria-checked", "true");
});
scenario("Checkbox: the tri-state box cycles unchecked, checked, undetermined", "Checkbox", async (page) => {
  const box = ck(page, "Show All");
  const states = [await box.getAttribute("aria-checked")];
  for (let i = 0; i < 4; i++) {
    await box.click();
    states.push(await box.getAttribute("aria-checked"));
  }
  assert2.deepEqual(states, ["mixed", "false", "true", "mixed", "false"]);
  await box.click();
  await box.click();
  await seen(box.locator(".checkbox__glyph--mixed"), true);
  await seen(box.locator(".checkbox__glyph--check"), false);
});
scenario("Checkbox: hover and press outline the box with Hover and tint the glyph PrimaryHover then PrimaryPress", "Checkbox", async (page) => {
  const box = ck(page, "Enable Gravity");
  const square = box.locator(".checkbox__box");
  const glyph = box.locator(".checkbox__glyph--check");
  await outlineIs(page, square, "secondary");
  await inks(page, glyph, "stroke", "primary");
  await pointAt(page, box);
  await outlineIs(page, square, "hover");
  await inks(page, glyph, "stroke", "primary-hover");
  await hold(page);
  await inks(page, glyph, "stroke", "primary-press");
  await release(page);
});
scenario("Checkbox: the toggle-button checkbox toggles its fill and has hover, pressed and disabled looks", "Checkbox", async (page) => {
  const off = ck(page, "Physics");
  const on = ck(page, "Collision");
  assert2.equal(await fill(off), CLEAR);
  await pointAt(page, off);
  await paints(page, off, "dropdown");
  await off.click();
  await attr(off, "aria-pressed", "true");
  await cls(off, "checkbox-toggle--checked", true);
  await paints(page, off, "primary-hover");
  await away(page);
  await paints(page, off, "primary");
  await pointAt(page, on);
  await hold(page);
  await paints(page, on, "dropdown");
  await release(page);
  await attr(on, "aria-pressed", "false");
  const locked = ck(page, "Locked toggle");
  await locked.click({ force: true });
  await attr(locked, "aria-pressed", "false");
  assert2.equal(await prop(locked, "opacity"), "0.45");
  const lockedBox = ck(page, "Locked");
  await lockedBox.click({ force: true });
  await attr(lockedBox, "aria-checked", "true");
});
scenario("Checkbox: Tab shows the Primary focus ring", "Checkbox", async (page) => {
  await tap(page, "Tab");
  const first = ck(page, "Simulate Physics");
  assert2.equal(await isFocused(first), true);
  await inks(page, first, "outline-color", "primary");
  assert2.equal(await prop(first, "outline-style"), "solid");
});
var TI = "ue-text-input ";
var tiBox = (page, index) => page.locator(TI + ".textinput").nth(index);
scenario("TextInput: hover lights the outline, focus turns it Primary with white text", "TextInput", async (page) => {
  const box = tiBox(page, 1);
  await outlineIs(page, box, "input-outline");
  await inks(page, box, "color", "foreground");
  await pointAt(page, box);
  await outlineIs(page, box, "hover");
  await box.locator("input").click();
  await away(page);
  await outlineIs(page, box, "primary");
  await inks(page, box, "color", "foreground-hover");
  await paints(page, box, "input");
});
scenario("TextInput: typing edits the field and the hint shows only while it is empty", "TextInput", async (page) => {
  const field = tiBox(page, 0).locator("input");
  await attr(field, "placeholder", "Enter a name");
  assert2.equal(await field.evaluate((el) => el.matches(":placeholder-shown")), true);
  await field.click();
  await page.keyboard.type("Chair01");
  assert2.equal(await field.inputValue(), "Chair01");
  await tap(page, "Backspace");
  assert2.equal(await field.inputValue(), "Chair0");
  assert2.equal(await field.evaluate((el) => el.matches(":placeholder-shown")), false);
});
scenario("TextInput: the read-only box takes focus but cannot be edited and keeps its Header fill", "TextInput", async (page) => {
  const box = tiBox(page, 2);
  const field = box.locator("input");
  await paints(page, box, "header");
  await field.click();
  await page.keyboard.type("xyz");
  assert2.equal(await field.inputValue(), "StaticMeshActor");
  await paints(page, box, "header");
  await outlineIs(page, box, "input-outline");
});
scenario("TextInput: the search box swaps the glass for a clear button once it has text", "TextInput", async (page) => {
  const box = tiBox(page, 3);
  const field = box.locator("input");
  const glass = box.locator(".textinput__glass");
  const clear = box.locator(".textinput__clear");
  await seen(glass, true);
  await seen(clear, false);
  await field.click();
  await page.keyboard.type("chair");
  await seen(glass, false);
  await seen(clear, true);
  await clear.click();
  assert2.equal(await field.inputValue(), "");
  await seen(glass, true);
  assert2.equal(await isFocused(field), true);
});
scenario("TextInput: Escape clears the search box", "TextInput", async (page) => {
  const box = tiBox(page, 3);
  const field = box.locator("input");
  await field.click();
  await page.keyboard.type("lamp");
  await cls(box, "textinput--filled", true);
  await tap(page, "Escape");
  assert2.equal(await field.inputValue(), "");
  await cls(box, "textinput--filled", false);
});
var SB = "ue-spin-box ";
var sbBox = (page, index) => page.locator(SB + ".spinbox").nth(index);
var sbValue = async (box) => Number(await box.getAttribute("aria-valuenow"));
var sbText = async (box) => (await box.locator(".spinbox__text").textContent() ?? "").trim();
async function dragBy(page, box, dx, keepDown = false) {
  const c = await pointAt(page, box);
  await hold(page);
  await page.mouse.move(c.x + dx / 2, c.y, { steps: 6 });
  await page.mouse.move(c.x + dx, c.y, { steps: 6 });
  if (!keepDown) await release(page);
}
scenario("SpinBox: dragging changes the value, the fill bar tracks it and the active look shows while held", "SpinBox", async (page) => {
  const box = sbBox(page, 1);
  const fillBar = box.locator(".spinbox__fill");
  assert2.equal(await prop(box, "cursor"), "ew-resize");
  assert2.equal(await sbValue(box), 40);
  await dragBy(page, box, 40, true);
  await cls(box, "spinbox--active", true);
  await outlineIs(page, box, "primary");
  await paints(page, fillBar, "primary");
  await release(page);
  await cls(box, "spinbox--active", false);
  await cls(box, "spinbox--text", false);
  const landed = await sbValue(box);
  assert2.ok(landed >= 60 && landed <= 70 && Number.isInteger(landed), "a 40px drag moves 40 to between 60 and 70 after the 5px trigger and the delta snap, got " + landed);
  assert2.equal(await sbText(box), landed.toFixed(1));
  const width = await box.evaluate((el) => el.getBoundingClientRect().width);
  const fillWidth = await fillBar.evaluate((el) => el.getBoundingClientRect().width);
  assert2.ok(Math.abs(fillWidth - (landed / 100 * width - 2)) < 0.6, "fill width " + fillWidth + " of " + width);
});
scenario("SpinBox: the value clamps to the range at both ends", "SpinBox", async (page) => {
  const box = sbBox(page, 1);
  await dragBy(page, box, 900);
  assert2.equal(await sbValue(box), 100);
  assert2.equal(await box.evaluate((el) => el.style.getPropertyValue("--spinbox-fill")), "1");
  await dragBy(page, box, -900);
  assert2.equal(await sbValue(box), 0);
  assert2.equal(await sbText(box), "0.0");
});
scenario("SpinBox: a click without a drag opens text entry, Enter commits and clamps, Escape cancels", "SpinBox", async (page) => {
  const box = sbBox(page, 1);
  await box.click();
  await cls(box, "spinbox--text", true);
  assert2.equal(await box.locator("input").inputValue(), "40.0");
  await seen(box.locator(".spinbox__fill"), false);
  await page.keyboard.type("55");
  await tap(page, "Enter");
  await cls(box, "spinbox--text", false);
  assert2.equal(await sbValue(box), 55);
  assert2.equal(await sbText(box), "55.0");
  await box.click();
  await page.keyboard.type("999");
  await tap(page, "Enter");
  assert2.equal(await sbValue(box), 100);
  await box.click();
  await page.keyboard.type("12");
  await tap(page, "Escape");
  await cls(box, "spinbox--text", false);
  assert2.equal(await sbValue(box), 100);
  assert2.equal(await sbText(box), "100.0");
});
scenario("SpinBox: Up and Down arrows step by the delta and stop at the limit, Enter opens text entry", "SpinBox", async (page) => {
  const box = sbBox(page, 0);
  await box.focus();
  await tap(page, "ArrowUp");
  assert2.equal(Math.round(await sbValue(box) * 100) / 100, 0.41);
  await tap(page, "ArrowDown", "ArrowDown");
  assert2.equal(Math.round(await sbValue(box) * 100) / 100, 0.39);
  for (let i = 0; i < 80; i++) await tap(page, "ArrowUp");
  assert2.equal(await sbValue(box), 1);
  await tap(page, "Enter");
  await cls(box, "spinbox--text", true);
  await tap(page, "Escape");
});
scenario("SpinBox: Escape during a drag restores the value", "SpinBox", async (page) => {
  const box = sbBox(page, 1);
  await dragBy(page, box, 50, true);
  assert2.notEqual(await sbValue(box), 40);
  await tap(page, "Escape");
  assert2.equal(await sbValue(box), 40);
  await cls(box, "spinbox--active", false);
  await release(page);
  assert2.equal(await sbValue(box), 40);
});
scenario("SpinBox: an unbounded box has no fill and drags by a share of its value, a disabled box ignores the pointer", "SpinBox", async (page) => {
  const free = sbBox(page, 2);
  await seen(free.locator(".spinbox__fill"), false);
  await dragBy(page, free, 60);
  assert2.ok(await sbValue(free) > 1300, "value " + await sbValue(free));
  const locked = sbBox(page, 3);
  await dragBy(page, locked, 60);
  assert2.equal(await sbValue(locked), 40);
  assert2.equal(await prop(locked, "opacity"), "0.45");
  await locked.click({ force: true });
  await cls(locked, "spinbox--text", false);
});
scenario("SpinBox: hover outlines Hover and fills Hover, the idle fill is Dropdown", "SpinBox", async (page) => {
  const box = sbBox(page, 1);
  const fillBar = box.locator(".spinbox__fill");
  await paints(page, fillBar, "dropdown");
  await pointAt(page, box);
  await paints(page, fillBar, "hover");
  await outlineIs(page, box, "hover");
  await away(page);
  await paints(page, fillBar, "dropdown");
});
var SL = "ue-slider ";
var slider = (page, index) => page.locator(SL + ".slider").nth(index);
var slValue = async (el) => Number(await el.getAttribute("aria-valuenow"));
scenario("Slider: clicking the bar jumps the thumb there and dragging follows the pointer", "Slider", async (page) => {
  const el = slider(page, 0);
  const box = await el.boundingBox();
  assert2.ok(box);
  await page.mouse.click(box.x + 8 + 0.75 * (box.width - 16), box.y + 4);
  assert2.equal(await slValue(el), 0.75);
  assert2.equal(await page.locator(SL + ".slider-value").nth(0).textContent(), "0.75");
  assert2.equal(await el.evaluate((e) => e.style.getPropertyValue("--slider-value")), "0.75");
  await page.mouse.move(box.x + 100, box.y + 4);
  await hold(page);
  await page.mouse.move(box.x + 30, box.y + 4, { steps: 5 });
  assert2.ok(Math.abs(await slValue(el) - (30 - 8) / (box.width - 16)) < 0.011);
  await page.mouse.move(box.x - 80, box.y + 4, { steps: 5 });
  assert2.equal(await slValue(el), 0);
  await page.mouse.move(box.x + 500, box.y + 4, { steps: 5 });
  assert2.equal(await slValue(el), 1);
  await release(page);
  const thumbBox = await el.locator(".slider__thumb").boundingBox();
  assert2.ok(thumbBox);
  assert2.ok(Math.abs(thumbBox.x + 4 - (box.x + box.width - 8)) < 0.6, "the thumb centre sits 8px from the right end");
});
scenario("Slider: the stepped slider snaps to its step", "Slider", async (page) => {
  const el = slider(page, 1);
  const box = await el.boundingBox();
  assert2.ok(box);
  await page.mouse.click(box.x + 8 + 0.52 * (box.width - 16), box.y + 4);
  assert2.equal(await slValue(el), 50);
  assert2.equal(await page.locator(SL + ".slider-value").nth(1).textContent(), "50");
});
scenario("Slider: arrow keys, Page keys, Home and End move the value and stop at the ends", "Slider", async (page) => {
  const el = slider(page, 0);
  await el.focus();
  await tap(page, "ArrowRight");
  assert2.equal(await slValue(el), 0.51);
  await tap(page, "ArrowLeft", "ArrowLeft");
  assert2.equal(await slValue(el), 0.49);
  await tap(page, "PageUp");
  assert2.equal(await slValue(el), 0.59);
  await tap(page, "End");
  assert2.equal(await slValue(el), 1);
  await tap(page, "ArrowRight");
  assert2.equal(await slValue(el), 1);
  await tap(page, "Home");
  assert2.equal(await slValue(el), 0);
  await tap(page, "ArrowDown");
  assert2.equal(await slValue(el), 0);
  await inks(page, el, "outline-color", "primary");
});
scenario("Slider: the thumb is Foreground and brightens to ForegroundHover on hover and while pressed", "Slider", async (page) => {
  const el = slider(page, 0);
  const thumb = el.locator(".slider__thumb");
  await paints(page, thumb, "foreground");
  await pointAt(page, el);
  await paints(page, thumb, "foreground-hover");
  await away(page);
  await paints(page, thumb, "foreground");
  await pointAt(page, el);
  await hold(page);
  await paints(page, thumb, "foreground-hover");
  await release(page);
});
scenario("Slider: a disabled slider ignores the pointer and stays dimmed", "Slider", async (page) => {
  const el = slider(page, 2);
  const box = await el.boundingBox();
  assert2.ok(box);
  await page.mouse.click(box.x + 20, box.y + 4);
  assert2.equal(await slValue(el), 0.5);
  assert2.equal(await prop(el, "opacity"), "0.45");
  await pointAt(page, el);
  await paints(page, el.locator(".slider__thumb"), "foreground");
});
var TT = "ue-tooltip ";
var popup = (page, index) => page.locator(TT + ".tooltip-popup").nth(index);
scenario("Tooltip: hovering a target shows it after a short delay near the pointer and leaving hides it", "Tooltip", async (page) => {
  const tip = popup(page, 0);
  const c = await pointAt(page, page.locator(TT + ".tooltip-target").nth(0));
  await seen(tip, false);
  await wait(page, 450);
  await seen(tip, true);
  assert2.equal(await prop(tip, "opacity"), "1");
  const box = await tip.boundingBox();
  assert2.ok(box);
  assert2.ok(Math.abs(box.x - (c.x + 12)) < 1.5 && Math.abs(box.y - (c.y + 8)) < 1.5, "offset (12, 8) from the pointer: " + box.x + "," + box.y);
  await paints(page, tip, "dropdown");
  await page.mouse.move(c.x + 20, c.y + 3);
  await wait(page, 60);
  const moved = await tip.boundingBox();
  assert2.ok(moved);
  assert2.ok(Math.abs(moved.x - (c.x + 20 + 12)) < 1.5, "the tooltip follows the pointer");
  await away(page);
  await wait(page, 80);
  await seen(tip, false);
});
scenario("Tooltip: a press and Escape both hide it, and a press keeps it hidden until the pointer leaves", "Tooltip", async (page) => {
  const tip = popup(page, 1);
  const c = await pointAt(page, page.locator(TT + ".tooltip-target").nth(1));
  await wait(page, 400);
  await seen(tip, true);
  await hold(page);
  await release(page);
  await wait(page, 60);
  await seen(tip, false);
  await page.mouse.move(c.x + 4, c.y + 2);
  await wait(page, 350);
  await seen(tip, false);
  await away(page);
  await page.mouse.move(c.x, c.y);
  await wait(page, 400);
  await seen(tip, true);
  await tap(page, "Escape");
  await wait(page, 40);
  await seen(tip, false);
});
scenario("Tooltip: keyboard focus shows it and blur hides it, the text-only form is black on the bright fill", "Tooltip", async (page) => {
  await tap(page, "Tab", "Tab");
  const tip = popup(page, 1);
  await wait(page, 400);
  await seen(tip, true);
  await inks(page, tip, "color", "black");
  await paints(page, tip, "foreground");
  await seen(popup(page, 0), false);
  await tap(page, "Tab");
  await wait(page, 60);
  await seen(tip, false);
});
scenario("Tooltip: pinned specimens stay visible plain HTML and the live tooltip starts hidden", "Tooltip", async (page) => {
  const pinned = page.locator(".tooltip[data-pinned]");
  assert2.equal(await pinned.count(), 2);
  await seen(pinned.first(), true);
  assert2.equal(await pinned.first().evaluate((el) => el.closest("ue-tooltip")), null);
  assert2.equal(await popup(page, 0).evaluate((el) => el.hasAttribute("hidden")), true);
});
var PM = "ue-popup-menu ";
var menu = (page, index) => page.locator(PM + ".popupmenu[tabindex]").nth(index);
var row = (page, label) => page.locator(PM + ".popupmenu__row").filter({ has: page.locator(".popupmenu__label", { hasText: new RegExp("^" + label + "$") }) });
var current = (page, index) => menu(page, index).locator(".popupmenu__row--hover");
var currentLabel = (page, index) => current(page, index).locator(".popupmenu__label").first().textContent();
var menuStatus = (page, index) => page.locator(PM + ".popupmenu-status").nth(index).textContent();
scenario("PopupMenu: hovering a row fills it with Primary and a pressed row drops 1px", "PopupMenu", async (page) => {
  const copy = row(page, "Copy");
  assert2.equal(await fill(copy), CLEAR);
  await pointAt(page, copy);
  await paints(page, copy, "primary");
  assert2.equal(await prop(copy, "padding-top"), "3px");
  await hold(page);
  assert2.equal(await prop(copy, "padding-top"), "4px");
  assert2.equal(await prop(copy, "padding-bottom"), "2px");
  await release(page);
  assert2.equal(await prop(copy, "padding-top"), "3px");
  assert2.equal(await menuStatus(page, 1), "Activated: Copy");
  await away(page);
  assert2.equal(await fill(copy), CLEAR);
});
scenario("PopupMenu: arrow keys highlight, skip the disabled row and wrap, Home and End jump", "PopupMenu", async (page) => {
  await menu(page, 0).focus();
  await tap(page, "ArrowDown");
  assert2.equal(await currentLabel(page, 0), "Show Grid");
  await paints(page, current(page, 0), "primary");
  await tap(page, "End");
  assert2.equal(await currentLabel(page, 0), "Top");
  await tap(page, "ArrowDown");
  assert2.equal(await currentLabel(page, 0), "Show Grid");
  await tap(page, "ArrowUp");
  assert2.equal(await currentLabel(page, 0), "Top");
  assert2.equal(await page.locator(PM + ".popupmenu__row--hover").count(), 1);
  await tap(page, "Home");
  assert2.equal(await currentLabel(page, 0), "Show Grid");
});
scenario("PopupMenu: Enter and Space activate, checkmarks toggle, radios pick one and the caption names the pick", "PopupMenu", async (page) => {
  const grid = row(page, "Show Grid");
  const bounds = row(page, "Show Bounds");
  await menu(page, 0).focus();
  await tap(page, "ArrowDown");
  await attr(grid, "aria-checked", "false");
  await seen(grid.locator(".popupmenu__tick"), false);
  await tap(page, "Enter");
  await attr(grid, "aria-checked", "true");
  await seen(grid.locator(".popupmenu__tick"), true);
  assert2.equal(await menuStatus(page, 0), "Activated: Show Grid (checked)");
  await tap(page, "ArrowDown", "Space");
  await attr(bounds, "aria-checked", "false");
  assert2.equal(await menuStatus(page, 0), "Activated: Show Bounds (unchecked)");
  await tap(page, "End", "Enter");
  await attr(row(page, "Top"), "aria-checked", "true");
  await attr(row(page, "Perspective"), "aria-checked", "false");
  await paints(page, row(page, "Top").locator(".popupmenu__radio"), "white");
  await row(page, "Perspective").click();
  await attr(row(page, "Perspective"), "aria-checked", "true");
  await attr(row(page, "Top"), "aria-checked", "false");
  await row(page, "Reset Layout").click({ force: true });
  assert2.equal(await menuStatus(page, 0), "Activated: Perspective (selected)");
});
scenario("PopupMenu: Right opens the submenu and enters it, Left closes it, separators and disabled rows are skipped", "PopupMenu", async (page) => {
  const saveAs = row(page, "Save As");
  const sub = saveAs.locator(".popupmenu__sub");
  await menu(page, 1).focus();
  await tap(page, "ArrowDown", "ArrowDown", "ArrowDown");
  assert2.equal(await currentLabel(page, 1), "Save As");
  await seen(sub, false);
  await tap(page, "ArrowRight");
  await seen(sub, true);
  await attr(saveAs, "aria-expanded", "true");
  await paints(page, saveAs, "primary");
  assert2.equal(await currentLabel(page, 1), "Asset...");
  await tap(page, "ArrowDown");
  assert2.equal(await currentLabel(page, 1), "Copy Path");
  await tap(page, "ArrowDown");
  assert2.equal(await currentLabel(page, 1), "Asset...");
  await tap(page, "Enter");
  assert2.equal(await menuStatus(page, 1), "Activated: Asset...");
  await tap(page, "ArrowLeft");
  await seen(sub, false);
  assert2.equal(await currentLabel(page, 1), "Save As");
  await tap(page, "ArrowRight");
  await seen(sub, true);
  await tap(page, "Escape");
  await seen(sub, false);
  await tap(page, "ArrowDown");
  assert2.equal(await currentLabel(page, 1), "Delete");
});
scenario("PopupMenu: hovering a submenu row opens its submenu and it stays open while the pointer is inside", "PopupMenu", async (page) => {
  const saveAs = row(page, "Save As");
  const sub = saveAs.locator(".popupmenu__sub");
  await pointAt(page, saveAs.locator(".popupmenu__label").first());
  await seen(sub, true);
  const firstSubRow = sub.locator(".popupmenu__row").first();
  await pointAt(page, firstSubRow);
  await seen(sub, true);
  await paints(page, firstSubRow, "primary");
  await paints(page, saveAs, "primary");
  await pointAt(page, row(page, "Copy"));
  await seen(sub, false);
});
scenario("PopupMenu: pinned menus stay plain HTML and ignore the pointer", "PopupMenu", async (page) => {
  const pinned = page.locator(".popupmenu[data-pinned]");
  assert2.equal(await pinned.count(), 2);
  assert2.equal(await pinned.first().evaluate((el) => el.closest("ue-popup-menu")), null);
  assert2.equal(await prop(pinned.first(), "pointer-events"), "none");
});
var NT = "ue-notification ";
var toastCount = (page) => page.locator(NT + ".notification").count();
var stackHeight = async (page) => (await page.locator(NT + ".notification-stack").boundingBox())?.height ?? 0;
var toastTitles = (page) => page.locator(NT + ".notification__title").allTextContents();
var toastGone = (page, remaining) => page.waitForFunction((n) => document.querySelectorAll("ue-notification .notification").length === n, remaining);
scenario("Notification: Dismiss removes the toast and the stack closes up", "Notification", async (page) => {
  assert2.equal(await toastCount(page), 1);
  assert2.ok(await stackHeight(page) > 60);
  await page.locator(NT + '.notification__btn[data-action="dismiss"]').click();
  await toastGone(page, 0);
  assert2.equal(await stackHeight(page), 0);
});
scenario("Notification: Show notification adds toasts and dismissing one collapses its height out of the stack", "Notification", async (page) => {
  const show = page.locator(NT + '[data-action="show"]');
  await show.click();
  await show.click();
  await wait(page, 350);
  assert2.equal(await toastCount(page), 3);
  assert2.deepEqual(await toastTitles(page), ["Saved 2 assets", "Saved 1 asset", "Import failed"]);
  const full = await stackHeight(page);
  await page.locator(NT + ".notification").nth(0).locator('[data-action="dismiss"]').click();
  await toastGone(page, 2);
  const less = await stackHeight(page);
  assert2.ok(full - less > 40, "the stack shrank from " + full + " to " + less);
  assert2.deepEqual(await toastTitles(page), ["Saved 1 asset", "Import failed"]);
});
scenario("Notification: buttons have hover, pressed and focus looks and Retry edits the sub text", "Notification", async (page) => {
  const retry = page.locator(NT + '[data-action="retry"]');
  const sub = page.locator(NT + ".notification__sub");
  await paints(page, retry, "secondary");
  await pointAt(page, retry);
  await paints(page, retry, "hover");
  await hold(page);
  await paints(page, retry, "header");
  assert2.equal(await prop(retry, "padding-top"), "4.5px");
  await release(page);
  assert2.equal(await sub.textContent(), "Chair.fbx could not be read. Retried 1 time.");
  await away(page);
  await retry.focus();
  await tap(page, "Shift+Tab", "Tab");
  await outlineIs(page, retry, "primary");
  await tap(page, "Enter");
  assert2.equal(await sub.textContent(), "Chair.fbx could not be read. Retried 2 times.");
});
scenario("Notification: a dismissed toast can be brought back with Show notification", "Notification", async (page) => {
  await page.locator(NT + '[data-action="dismiss"]').click();
  await toastGone(page, 0);
  await page.locator(NT + '[data-action="show"]').click();
  await wait(page, 300);
  assert2.equal(await toastCount(page), 1);
  await paints(page, page.locator(NT + ".notification"), "notifications");
  assert2.equal(await page.locator(".notification[data-pinned]").count(), 3);
});
var EA = "ue-expandable-area ";
var area = (page, index) => page.locator(EA + ".expandablearea").nth(index);
scenario("ExpandableArea: a click toggles the body and turns the caret", "ExpandableArea", async (page) => {
  const closed = area(page, 0);
  const header = closed.locator(".expandablearea__header");
  const body = closed.locator(".expandablearea__body");
  const caret = closed.locator(".expandablearea__caret");
  await attr(header, "aria-expanded", "false");
  await seen(body, false);
  assert2.equal(await prop(caret, "transform"), "none");
  await header.click();
  await attr(header, "aria-expanded", "true");
  await seen(body, true);
  await wait(page, 250);
  assert2.equal(await prop(caret, "transform"), "matrix(0, 1, -1, 0, 0, 0)");
  await header.click();
  await seen(body, false);
  await wait(page, 250);
  assert2.equal(await prop(caret, "transform"), "none");
});
scenario("ExpandableArea: Enter and Space toggle the focused header and it shows the focus ring", "ExpandableArea", async (page) => {
  const header = area(page, 1).locator(".expandablearea__header");
  const body = area(page, 1).locator(".expandablearea__body");
  await seen(body, true);
  await tap(page, "Tab", "Tab");
  assert2.equal(await isFocused(header), true);
  await inks(page, header, "outline-color", "primary");
  await tap(page, "Enter");
  await seen(body, false);
  await attr(header, "aria-expanded", "false");
  await tap(page, "Space");
  await seen(body, true);
});
scenario("ExpandableArea: the panel keeps its Panel fill and the header has no hover fill", "ExpandableArea", async (page) => {
  const panel = area(page, 0);
  const header = panel.locator(".expandablearea__header");
  await paints(page, panel, "panel");
  await pointAt(page, header);
  assert2.equal(await fill(header), CLEAR);
  await paints(page, panel, "panel");
  assert2.equal(await page.locator(".expandablearea[data-pinned]").count(), 2);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY29udHJvbHMudGVzdC50cyIsICJwcm9iZS50cyIsICJzY2VuYXJpby50cyIsICJsaWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBJbnRlcmFjdGlvbiB0ZXN0cyBmb3IgdGhlIGNvbnRyb2xzIGdyb3VwOiBCdXR0b24sIENvbWJvQnV0dG9uLCBDaGVja2JveCwgVGV4dElucHV0LCBTcGluQm94LCBTbGlkZXIsIFRvb2x0aXAsIFBvcHVwTWVudSwgTm90aWZpY2F0aW9uLCBFeHBhbmRhYmxlQXJlYS5cbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQvc3RyaWN0JztcbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgQ0xFQVIsIHRva2VuLCBwcm9wLCBmaWxsLCBoYXNDbGFzcywgaG9sZCwgcmVsZWFzZSwgYXdheSB9IGZyb20gJy4vcHJvYmUudHMnO1xuaW1wb3J0IHsgc2NlbmFyaW8gfSBmcm9tICcuL3NjZW5hcmlvLnRzJztcblxuLy8gLS0tLS0tLS0tLSBoZWxwZXJzIGZvciB0aGlzIGZpbGUgLS0tLS0tLS0tLVxuXG5jb25zdCBzaGFkb3cgPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+IHByb3AodGFyZ2V0LCAnYm94LXNoYWRvdycpO1xuY29uc3Qgd2FpdCA9IChwYWdlOiBQYWdlLCBtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiA9PiBwYWdlLndhaXRGb3JUaW1lb3V0KG1zKTtcbmNvbnN0IHRhcCA9IChwYWdlOiBQYWdlLCAuLi5uYW1lczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+ID0+IG5hbWVzLnJlZHVjZSgoY2hhaW4sIG5hbWUpID0+IGNoYWluLnRoZW4oKCkgPT4gcGFnZS5rZXlib2FyZC5wcmVzcyhuYW1lKSksIFByb21pc2UucmVzb2x2ZSgpKTtcbmNvbnN0IGlzRm9jdXNlZCA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwpID0+IGVsID09PSBkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcblxuLy8gQ2hlY2tzIHRoYXQgYW4gZWxlbWVudCBpcyBzaG93biBvciBoaWRkZW4uXG5hc3luYyBmdW5jdGlvbiBzZWVuKHRhcmdldDogTG9jYXRvciwgZXhwZWN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRhcmdldC5pc1Zpc2libGUoKSwgZXhwZWN0ZWQsICd2aXNpYmxlOiBleHBlY3RlZCAnICsgZXhwZWN0ZWQpO1xufVxuXG4vLyBDaGVja3Mgb25lIGF0dHJpYnV0ZSB2YWx1ZS5cbmFzeW5jIGZ1bmN0aW9uIGF0dHIodGFyZ2V0OiBMb2NhdG9yLCBuYW1lOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRhcmdldC5nZXRBdHRyaWJ1dGUobmFtZSksIGV4cGVjdGVkLCBuYW1lKTtcbn1cblxuLy8gQ2hlY2tzIHRoYXQgYSBjbGFzcyBpcyBwcmVzZW50IG9yIGFic2VudC5cbmFzeW5jIGZ1bmN0aW9uIGNscyh0YXJnZXQ6IExvY2F0b3IsIG5hbWU6IHN0cmluZywgZXhwZWN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhhc0NsYXNzKHRhcmdldCwgbmFtZSksIGV4cGVjdGVkLCAnY2xhc3MgJyArIG5hbWUpO1xufVxuXG4vLyBDaGVja3MgdGhhdCB0aGUgZWxlbWVudCdzIGZpbGwgaXMgdGhlIG5hbWVkIHRva2VuLlxuYXN5bmMgZnVuY3Rpb24gcGFpbnRzKHBhZ2U6IFBhZ2UsIHRhcmdldDogTG9jYXRvciwgbmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGV4cGVjdGVkID0gYXdhaXQgdG9rZW4ocGFnZSwgbmFtZSk7XG5cdGF3YWl0IHNldHRsZWQoKCkgPT4gZmlsbCh0YXJnZXQpLCBleHBlY3RlZCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKHRhcmdldCksIGV4cGVjdGVkLCAnZmlsbCBzaG91bGQgYmUgJyArIG5hbWUpO1xufVxuXG4vLyBXYWl0cyB1cCB0byBvbmUgc2Vjb25kIGZvciBhIGNvbXB1dGVkIHN0eWxlIHRvIHJlYWNoIGl0cyB2YWx1ZSwgYmVjYXVzZSBhIGhvdmVyIGNoYW5nZSBsYW5kcyBhIGZyYW1lIGFmdGVyIHRoZSBwb2ludGVyIG1vdmVzLlxuYXN5bmMgZnVuY3Rpb24gc2V0dGxlZChyZWFkOiAoKSA9PiBQcm9taXNlPHN0cmluZz4sIGV4cGVjdGVkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0Zm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCAyMCAmJiAoYXdhaXQgcmVhZCgpKSAhPT0gZXhwZWN0ZWQ7IGF0dGVtcHQrKykgYXdhaXQgbmV3IFByb21pc2UoKGRvbmUpID0+IHNldFRpbWVvdXQoZG9uZSwgNTApKTtcbn1cblxuLy8gQ2hlY2tzIHRoYXQgb25lIGNvbXB1dGVkIHByb3BlcnR5IGlzIHRoZSBuYW1lZCB0b2tlbiBjb2xvdXIuXG5hc3luYyBmdW5jdGlvbiBpbmtzKHBhZ2U6IFBhZ2UsIHRhcmdldDogTG9jYXRvciwgcHJvcGVydHk6IHN0cmluZywgbmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGV4cGVjdGVkID0gYXdhaXQgdG9rZW4ocGFnZSwgbmFtZSk7XG5cdGF3YWl0IHNldHRsZWQoKCkgPT4gcHJvcCh0YXJnZXQsIHByb3BlcnR5KSwgZXhwZWN0ZWQpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcCh0YXJnZXQsIHByb3BlcnR5KSwgZXhwZWN0ZWQsIHByb3BlcnR5ICsgJyBzaG91bGQgYmUgJyArIG5hbWUpO1xufVxuXG4vLyBDaGVja3MgdGhhdCB0aGUgZWxlbWVudCdzIGluc2V0IG91dGxpbmUgaXMgcGFpbnRlZCB3aXRoIHRoZSBuYW1lZCB0b2tlbi5cbmFzeW5jIGZ1bmN0aW9uIG91dGxpbmVJcyhwYWdlOiBQYWdlLCB0YXJnZXQ6IExvY2F0b3IsIG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRhc3NlcnQub2soKGF3YWl0IHNoYWRvdyh0YXJnZXQpKS5zdGFydHNXaXRoKGF3YWl0IHRva2VuKHBhZ2UsIG5hbWUpKSwgJ291dGxpbmUgJyArIChhd2FpdCBzaGFkb3codGFyZ2V0KSkgKyAnIHNob3VsZCBzdGFydCB3aXRoICcgKyBuYW1lKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY2VudHJlKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8eyB4OiBudW1iZXI7IHk6IG51bWJlciB9PiB7XG5cdGNvbnN0IGJveCA9IGF3YWl0IHRhcmdldC5ib3VuZGluZ0JveCgpO1xuXHRhc3NlcnQub2soYm94LCAnYm91bmRpbmcgYm94Jyk7XG5cdHJldHVybiB7IHg6IGJveC54ICsgYm94LndpZHRoIC8gMiwgeTogYm94LnkgKyBib3guaGVpZ2h0IC8gMiB9O1xufVxuXG4vLyBNb3ZlcyB0aGUgcG9pbnRlciBvbnRvIHRoZSBlbGVtZW50IGFuZCByZXR1cm5zIHdoZXJlIGl0IHdlbnQuXG5hc3luYyBmdW5jdGlvbiBwb2ludEF0KHBhZ2U6IFBhZ2UsIHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8eyB4OiBudW1iZXI7IHk6IG51bWJlciB9PiB7XG5cdGNvbnN0IGMgPSBhd2FpdCBjZW50cmUodGFyZ2V0KTtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKGMueCwgYy55KTtcblx0cmV0dXJuIGM7XG59XG5cbi8vIC0tLS0tLS0tLS0gQnV0dG9uIC0tLS0tLS0tLS1cblxuY29uc3QgQlROID0gJ3VlLWJ1dHRvbiAuYnV0dG9uJztcblxuc2NlbmFyaW8oJ0J1dHRvbjogaG92ZXIgZmlsbHMgSG92ZXIsIHByaW1hcnkgaG92ZXJzIHRvIFByaW1hcnlIb3Zlciwgc2ltcGxlIGhvdmVycyB0byBEcm9wZG93bicsICdCdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBwbGFpbiA9IHBhZ2UubG9jYXRvcihCVE4pLm50aCgwKTtcblx0Y29uc3QgcHJpbWFyeSA9IHBhZ2UubG9jYXRvcihCVE4pLm50aCgxKTtcblx0Y29uc3Qgc2ltcGxlID0gcGFnZS5sb2NhdG9yKEJUTikubnRoKDMpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcGxhaW4sICdzZWNvbmRhcnknKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBwbGFpbik7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBwbGFpbiwgJ2hvdmVyJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKHBsYWluKSwgYXdhaXQgZmlsbChwYWdlLmxvY2F0b3IoJy5idXR0b24tLWhvdmVyJykuZmlyc3QoKSkpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIHByaW1hcnkpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcHJpbWFyeSwgJ3ByaW1hcnktaG92ZXInKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBzaW1wbGUpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgc2ltcGxlLCAnZHJvcGRvd24nKTtcblx0YXdhaXQgaW5rcyhwYWdlLCBzaW1wbGUsICdjb2xvcicsICdmb3JlZ3JvdW5kLWhvdmVyJyk7XG59KTtcblxuc2NlbmFyaW8oJ0J1dHRvbjogdGhlIG1vdXNlIHByZXNzIHVzZXMgdGhlIHByZXNzZWQgZmlsbCBhbmQgZHJvcHMgdGhlIGxhYmVsIDFweCcsICdCdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBwbGFpbiA9IHBhZ2UubG9jYXRvcihCVE4pLm50aCgwKTtcblx0Y29uc3QgcHJpbWFyeSA9IHBhZ2UubG9jYXRvcihCVE4pLm50aCgxKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AocGxhaW4sICdwYWRkaW5nLXRvcCcpLCAnMy41cHgnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBwbGFpbik7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBwbGFpbiwgJ2hlYWRlcicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChwbGFpbiwgJ3BhZGRpbmctdG9wJyksICc0LjVweCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChwbGFpbiwgJ3BhZGRpbmctYm90dG9tJyksICcyLjVweCcpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChwbGFpbiwgJ3BhZGRpbmctdG9wJyksICczLjVweCcpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIHByaW1hcnkpO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcHJpbWFyeSwgJ3ByaW1hcnktcHJlc3MnKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcbn0pO1xuXG5zY2VuYXJpbygnQnV0dG9uOiBjbGlja3MgcmVnaXN0ZXIgaW4gdGhlIGNvdW50ZXIsIGEgZGlzYWJsZWQgYnV0dG9uIGRvZXMgbm90IGNvdW50JywgJ0J1dHRvbicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGNvdW50ZXIgPSBwYWdlLmxvY2F0b3IoJ3VlLWJ1dHRvbiAuYnV0dG9uLWNvdW50Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjb3VudGVyLnRleHRDb250ZW50KCksICdDbGlja3M6IDAnKTtcblx0YXdhaXQgcGFnZS5sb2NhdG9yKEJUTikubnRoKDApLmNsaWNrKCk7XG5cdGF3YWl0IHBhZ2UubG9jYXRvcihCVE4pLm50aCgxKS5jbGljaygpO1xuXHRhd2FpdCBwYWdlLmxvY2F0b3IoQlROKS5udGgoNCkuY2xpY2soKTtcblx0YXNzZXJ0Lm1hdGNoKChhd2FpdCBjb3VudGVyLnRleHRDb250ZW50KCkpID8/ICcnLCAvXkNsaWNrczogMyBcXChsYXN0OiBTZXR0aW5nc1xcKS8pO1xuXHRjb25zdCBkaXNhYmxlZCA9IHBhZ2UubG9jYXRvcihCVE4pLm50aCg1KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGRpc2FibGVkLmlzRGlzYWJsZWQoKSwgdHJ1ZSk7XG5cdGF3YWl0IGRpc2FibGVkLmNsaWNrKHsgZm9yY2U6IHRydWUgfSk7XG5cdGFzc2VydC5tYXRjaCgoYXdhaXQgY291bnRlci50ZXh0Q29udGVudCgpKSA/PyAnJywgL15DbGlja3M6IDMvKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AoZGlzYWJsZWQsICdvcGFjaXR5JyksICcwLjQ1Jyk7XG59KTtcblxuc2NlbmFyaW8oJ0J1dHRvbjogU3BhY2UgYW5kIEVudGVyIHByZXNzIHRoZSBmb2N1c2VkIGJ1dHRvbiwgd2l0aCB0aGUgcHJlc3NlZCBsb29rIHdoaWxlIGhlbGQnLCAnQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgY291bnRlciA9IHBhZ2UubG9jYXRvcigndWUtYnV0dG9uIC5idXR0b24tY291bnQnKTtcblx0Y29uc3QgcGxhaW4gPSBwYWdlLmxvY2F0b3IoQlROKS5udGgoMCk7XG5cdGF3YWl0IHBsYWluLmZvY3VzKCk7XG5cdGF3YWl0IHBhZ2Uua2V5Ym9hcmQuZG93bignICcpO1xuXHRhd2FpdCBjbHMocGxhaW4sICdidXR0b24tLXByZXNzZWQnLCB0cnVlKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHBsYWluLCAnaGVhZGVyJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKHBsYWluLCAncGFkZGluZy10b3AnKSwgJzQuNXB4Jyk7XG5cdGF3YWl0IHBhZ2Uua2V5Ym9hcmQudXAoJyAnKTtcblx0YXdhaXQgY2xzKHBsYWluLCAnYnV0dG9uLS1wcmVzc2VkJywgZmFsc2UpO1xuXHRhc3NlcnQubWF0Y2goKGF3YWl0IGNvdW50ZXIudGV4dENvbnRlbnQoKSkgPz8gJycsIC9eQ2xpY2tzOiAxLyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRW50ZXInKTtcblx0YXNzZXJ0Lm1hdGNoKChhd2FpdCBjb3VudGVyLnRleHRDb250ZW50KCkpID8/ICcnLCAvXkNsaWNrczogMi8pO1xufSk7XG5cbnNjZW5hcmlvKCdCdXR0b246IFRhYiBzaG93cyB0aGUgUHJpbWFyeSBmb2N1cyByaW5nJywgJ0J1dHRvbicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGF3YWl0IHRhcChwYWdlLCAnVGFiJyk7XG5cdGNvbnN0IGZpcnN0ID0gcGFnZS5sb2NhdG9yKEJUTikubnRoKDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaXNGb2N1c2VkKGZpcnN0KSwgdHJ1ZSk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCBmaXJzdCwgJ3ByaW1hcnknKTtcbn0pO1xuXG5zY2VuYXJpbygnQnV0dG9uOiBwaW5uZWQgc3BlY2ltZW5zIGlnbm9yZSB0aGUgcG9pbnRlciBhbmQgc2l0IG91dHNpZGUgdGhlIGVsZW1lbnQnLCAnQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgcGlubmVkID0gcGFnZS5sb2NhdG9yKCcuYnV0dG9uLS1ob3ZlcltkYXRhLXBpbm5lZF0nKS5maXJzdCgpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChwaW5uZWQsICdwb2ludGVyLWV2ZW50cycpLCAnbm9uZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGlubmVkLmV2YWx1YXRlKChlbCkgPT4gZWwuY2xvc2VzdCgndWUtYnV0dG9uJykpLCBudWxsKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHBpbm5lZCwgJ2hvdmVyJyk7XG59KTtcblxuLy8gLS0tLS0tLS0tLSBDb21ib0J1dHRvbiAtLS0tLS0tLS0tXG5cbmNvbnN0IENCID0gJ3VlLWNvbWJvLWJ1dHRvbiAnO1xuY29uc3QgY2JUcmlnZ2VyID0gKHBhZ2U6IFBhZ2UsIGluZGV4OiBudW1iZXIpOiBMb2NhdG9yID0+IHBhZ2UubG9jYXRvcihDQiArICcuY29tYm9idXR0b24tYW5jaG9yJykubnRoKGluZGV4KS5sb2NhdG9yKCcuY29tYm9idXR0b24nKTtcbmNvbnN0IGNiTWVudSA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoQ0IgKyAnLmNvbWJvYnV0dG9uLWFuY2hvcicpLm50aChpbmRleCkubG9jYXRvcignLmNvbWJvYnV0dG9uLW1lbnUnKTtcbmNvbnN0IGNiTGFiZWwgPSAodHJpZ2dlcjogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4gPT4gdHJpZ2dlci5sb2NhdG9yKCcuY29tYm9idXR0b25fX2xhYmVsJykudGV4dENvbnRlbnQoKTtcblxuc2NlbmFyaW8oJ0NvbWJvQnV0dG9uOiBhIGNsaWNrIG9wZW5zIHRoZSBwb3B1cCB3aXRoIHRoZSBvcGVuIGxvb2ssIGNob29zaW5nIHNldHMgdGhlIGxhYmVsIGFuZCBjbG9zZXMnLCAnQ29tYm9CdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCB0cmlnZ2VyID0gY2JUcmlnZ2VyKHBhZ2UsIDApO1xuXHRjb25zdCBtZW51ID0gY2JNZW51KHBhZ2UsIDApO1xuXHRhd2FpdCBzZWVuKG1lbnUsIGZhbHNlKTtcblx0YXdhaXQgdHJpZ2dlci5jbGljaygpO1xuXHRhd2FpdCBzZWVuKG1lbnUsIHRydWUpO1xuXHRhd2FpdCBhdHRyKHRyaWdnZXIsICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcblx0YXdhaXQgY2xzKHRyaWdnZXIsICdjb21ib2J1dHRvbi0tb3BlbicsIHRydWUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcCh0cmlnZ2VyLCAncGFkZGluZy10b3AnKSwgJzJweCcpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgdHJpZ2dlciwgJ2hvdmVyJyk7XG5cdGF3YWl0IG1lbnUubG9jYXRvcignLmNvbWJvYnV0dG9uLXJvdy1pdGVtJykubnRoKDIpLmNsaWNrKCk7XG5cdGF3YWl0IHNlZW4obWVudSwgZmFsc2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY2JMYWJlbCh0cmlnZ2VyKSwgJ1NjYWxlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoQ0IgKyAnLmNvbWJvYnV0dG9uLXN0YXR1cycpLnRleHRDb250ZW50KCksICdQaWNrZWQ6IFNjYWxlJyk7XG5cdGF3YWl0IGF0dHIodHJpZ2dlciwgJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AodHJpZ2dlciwgJ3BhZGRpbmctdG9wJyksICcxcHgnKTtcbn0pO1xuXG5zY2VuYXJpbygnQ29tYm9CdXR0b246IGhvdmVyaW5nIGEgcm93IGZpbGxzIGl0IHdpdGggUHJpbWFyeSwgaG92ZXJpbmcgdGhlIGJ1dHRvbiBsaWdodHMgaXRzIG91dGxpbmUnLCAnQ29tYm9CdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCB0cmlnZ2VyID0gY2JUcmlnZ2VyKHBhZ2UsIDApO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgdHJpZ2dlciwgJ2lucHV0LW91dGxpbmUnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCB0cmlnZ2VyKTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIHRyaWdnZXIsICdob3ZlcicpO1xuXHRhd2FpdCB0cmlnZ2VyLmNsaWNrKCk7XG5cdGNvbnN0IHJvd3MgPSBjYk1lbnUocGFnZSwgMCkubG9jYXRvcignLmNvbWJvYnV0dG9uLXJvdy1pdGVtJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKHJvd3MubnRoKDEpKSwgQ0xFQVIpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIHJvd3MubnRoKDEpKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHJvd3MubnRoKDEpLCAncHJpbWFyeScpO1xuXHRhd2FpdCBjbHMocm93cy5udGgoMSksICdjb21ib2J1dHRvbi1yb3ctaXRlbS0taG92ZXInLCB0cnVlKTtcbn0pO1xuXG5zY2VuYXJpbygnQ29tYm9CdXR0b246IHRoZSBrZXlib2FyZCBvcGVucyB3aXRoIERvd24sIGFycm93cyBtb3ZlLCBFbnRlciBwaWNrcywgRXNjYXBlIGNhbmNlbHMnLCAnQ29tYm9CdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCB0cmlnZ2VyID0gY2JUcmlnZ2VyKHBhZ2UsIDApO1xuXHRjb25zdCBtZW51ID0gY2JNZW51KHBhZ2UsIDApO1xuXHRjb25zdCByb3dzID0gbWVudS5sb2NhdG9yKCcuY29tYm9idXR0b24tcm93LWl0ZW0nKTtcblx0YXdhaXQgdHJpZ2dlci5mb2N1cygpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicpO1xuXHRhd2FpdCBzZWVuKG1lbnUsIHRydWUpO1xuXHRhd2FpdCBjbHMocm93cy5udGgoMCksICdjb21ib2J1dHRvbi1yb3ctaXRlbS0taG92ZXInLCB0cnVlKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0Rvd24nLCAnQXJyb3dEb3duJyk7XG5cdGF3YWl0IGNscyhyb3dzLm50aCgyKSwgJ2NvbWJvYnV0dG9uLXJvdy1pdGVtLS1ob3ZlcicsIHRydWUpO1xuXHRhd2FpdCBjbHMocm93cy5udGgoMiksICdjb21ib2J1dHRvbi1yb3ctaXRlbS0tZm9jdXMnLCB0cnVlKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0YXdhaXQgY2xzKHJvd3MubnRoKDApLCAnY29tYm9idXR0b24tcm93LWl0ZW0tLWhvdmVyJywgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dVcCcsICdFbnRlcicpO1xuXHRhd2FpdCBzZWVuKG1lbnUsIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGNiTGFiZWwodHJpZ2dlciksICdTY2FsZScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGF3YWl0IHNlZW4obWVudSwgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnSG9tZScsICdFc2NhcGUnKTtcblx0YXdhaXQgc2VlbihtZW51LCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjYkxhYmVsKHRyaWdnZXIpLCAnU2NhbGUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGlzRm9jdXNlZCh0cmlnZ2VyKSwgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnU3BhY2UnKTtcblx0YXdhaXQgc2VlbihtZW51LCB0cnVlKTtcblx0YXdhaXQgY2xzKHJvd3MubnRoKDIpLCAnY29tYm9idXR0b24tcm93LWl0ZW0tLWhvdmVyJywgdHJ1ZSk7XG59KTtcblxuc2NlbmFyaW8oJ0NvbWJvQnV0dG9uOiBhbiBvdXRzaWRlIGNsaWNrIGNsb3NlcyB0aGUgcG9wdXAgYW5kIG9wZW5pbmcgb25lIGNsb3NlcyB0aGUgb3RoZXInLCAnQ29tYm9CdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRhd2FpdCBjYlRyaWdnZXIocGFnZSwgMCkuY2xpY2soKTtcblx0YXdhaXQgc2VlbihjYk1lbnUocGFnZSwgMCksIHRydWUpO1xuXHRhd2FpdCBjYlRyaWdnZXIocGFnZSwgMSkuY2xpY2soKTtcblx0YXdhaXQgc2VlbihjYk1lbnUocGFnZSwgMCksIGZhbHNlKTtcblx0YXdhaXQgc2VlbihjYk1lbnUocGFnZSwgMSksIHRydWUpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLmNsaWNrKDcwMCwgMTUwKTtcblx0YXdhaXQgc2VlbihjYk1lbnUocGFnZSwgMSksIGZhbHNlKTtcbn0pO1xuXG5zY2VuYXJpbygnQ29tYm9CdXR0b246IHRoZSBzaW1wbGUgdmFyaWFudCBrZWVwcyBpdHMgbGFiZWwsIGEgZGlzYWJsZWQgb25lIGRvZXMgbm90IG9wZW4nLCAnQ29tYm9CdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBzaW1wbGUgPSBjYlRyaWdnZXIocGFnZSwgMSk7XG5cdGF3YWl0IHNpbXBsZS5jbGljaygpO1xuXHRhd2FpdCBjYk1lbnUocGFnZSwgMSkubG9jYXRvcignLmNvbWJvYnV0dG9uLXJvdy1pdGVtJykubnRoKDEpLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjYkxhYmVsKHNpbXBsZSksICdTZXR0aW5ncycpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKENCICsgJy5jb21ib2J1dHRvbi1zdGF0dXMnKS50ZXh0Q29udGVudCgpLCAnUGlja2VkOiBQcm9qZWN0IFNldHRpbmdzJyk7XG5cdGNvbnN0IGRpc2FibGVkID0gcGFnZS5sb2NhdG9yKENCICsgJy5jb21ib2J1dHRvblthcmlhLWRpc2FibGVkPVwidHJ1ZVwiXScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChkaXNhYmxlZCwgJ29wYWNpdHknKSwgJzAuNDUnKTtcblx0YXdhaXQgZGlzYWJsZWQuY2xpY2soeyBmb3JjZTogdHJ1ZSB9KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihDQiArICcuY29tYm9idXR0b24tbWVudTpub3QoW2hpZGRlbl0pJykuY291bnQoKSwgMCk7XG59KTtcblxuLy8gLS0tLS0tLS0tLSBDaGVja2JveCAtLS0tLS0tLS0tXG5cbmNvbnN0IENLID0gJ3VlLWNoZWNrYm94ICc7XG5jb25zdCBjayA9IChwYWdlOiBQYWdlLCBsYWJlbDogc3RyaW5nKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoQ0sgKyAnW2RhdGEtbGFiZWw9XCInICsgbGFiZWwgKyAnXCJdJyk7XG5cbnNjZW5hcmlvKCdDaGVja2JveDogYSBjbGljayB0b2dnbGVzIGFuZCB0aGUgZ2x5cGggZm9sbG93cyB0aGUgc3RhdGUnLCAnQ2hlY2tib3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBjayhwYWdlLCAnU2ltdWxhdGUgUGh5c2ljcycpO1xuXHRjb25zdCBnbHlwaCA9IGJveC5sb2NhdG9yKCcuY2hlY2tib3hfX2dseXBoLS1jaGVjaycpO1xuXHRhd2FpdCBhdHRyKGJveCwgJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpO1xuXHRhd2FpdCBzZWVuKGdseXBoLCBmYWxzZSk7XG5cdGF3YWl0IGJveC5jbGljaygpO1xuXHRhd2FpdCBhdHRyKGJveCwgJ2FyaWEtY2hlY2tlZCcsICd0cnVlJyk7XG5cdGF3YWl0IHNlZW4oZ2x5cGgsIHRydWUpO1xuXHRhd2FpdCBzZWVuKGJveC5sb2NhdG9yKCcuY2hlY2tib3hfX2dseXBoLS1taXhlZCcpLCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoQ0sgKyAnLmNoZWNrYm94LXN0YXR1cycpLnRleHRDb250ZW50KCksICdMYXN0IGNoYW5nZTogU2ltdWxhdGUgUGh5c2ljcyBpcyBjaGVja2VkJyk7XG5cdGF3YWl0IGJveC5jbGljaygpO1xuXHRhd2FpdCBhdHRyKGJveCwgJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpO1xufSk7XG5cbnNjZW5hcmlvKCdDaGVja2JveDogU3BhY2UgYW5kIEVudGVyIHRvZ2dsZSB0aGUgZm9jdXNlZCBib3gsIHdpdGggdGhlIHByZXNzZWQgY2xhc3Mgd2hpbGUgaGVsZCcsICdDaGVja2JveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IGNrKHBhZ2UsICdFbmFibGUgR3Jhdml0eScpO1xuXHRhd2FpdCBib3guZm9jdXMoKTtcblx0YXdhaXQgYXR0cihib3gsICdhcmlhLWNoZWNrZWQnLCAndHJ1ZScpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLmRvd24oJyAnKTtcblx0YXdhaXQgY2xzKGJveCwgJ2NoZWNrYm94LS1wcmVzc2VkJywgdHJ1ZSk7XG5cdGF3YWl0IGF0dHIoYm94LCAnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcblx0YXdhaXQgcGFnZS5rZXlib2FyZC51cCgnICcpO1xuXHRhd2FpdCBhdHRyKGJveCwgJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGF3YWl0IGF0dHIoYm94LCAnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcbn0pO1xuXG5zY2VuYXJpbygnQ2hlY2tib3g6IHRoZSB0cmktc3RhdGUgYm94IGN5Y2xlcyB1bmNoZWNrZWQsIGNoZWNrZWQsIHVuZGV0ZXJtaW5lZCcsICdDaGVja2JveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IGNrKHBhZ2UsICdTaG93IEFsbCcpO1xuXHRjb25zdCBzdGF0ZXM6IEFycmF5PHN0cmluZyB8IG51bGw+ID0gW2F3YWl0IGJveC5nZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcpXTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcblx0XHRhd2FpdCBib3guY2xpY2soKTtcblx0XHRzdGF0ZXMucHVzaChhd2FpdCBib3guZ2V0QXR0cmlidXRlKCdhcmlhLWNoZWNrZWQnKSk7XG5cdH1cblx0YXNzZXJ0LmRlZXBFcXVhbChzdGF0ZXMsIFsnbWl4ZWQnLCAnZmFsc2UnLCAndHJ1ZScsICdtaXhlZCcsICdmYWxzZSddKTtcblx0YXdhaXQgYm94LmNsaWNrKCk7XG5cdGF3YWl0IGJveC5jbGljaygpO1xuXHRhd2FpdCBzZWVuKGJveC5sb2NhdG9yKCcuY2hlY2tib3hfX2dseXBoLS1taXhlZCcpLCB0cnVlKTtcblx0YXdhaXQgc2Vlbihib3gubG9jYXRvcignLmNoZWNrYm94X19nbHlwaC0tY2hlY2snKSwgZmFsc2UpO1xufSk7XG5cbnNjZW5hcmlvKCdDaGVja2JveDogaG92ZXIgYW5kIHByZXNzIG91dGxpbmUgdGhlIGJveCB3aXRoIEhvdmVyIGFuZCB0aW50IHRoZSBnbHlwaCBQcmltYXJ5SG92ZXIgdGhlbiBQcmltYXJ5UHJlc3MnLCAnQ2hlY2tib3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBjayhwYWdlLCAnRW5hYmxlIEdyYXZpdHknKTtcblx0Y29uc3Qgc3F1YXJlID0gYm94LmxvY2F0b3IoJy5jaGVja2JveF9fYm94Jyk7XG5cdGNvbnN0IGdseXBoID0gYm94LmxvY2F0b3IoJy5jaGVja2JveF9fZ2x5cGgtLWNoZWNrJyk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCBzcXVhcmUsICdzZWNvbmRhcnknKTtcblx0YXdhaXQgaW5rcyhwYWdlLCBnbHlwaCwgJ3N0cm9rZScsICdwcmltYXJ5Jyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgYm94KTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIHNxdWFyZSwgJ2hvdmVyJyk7XG5cdGF3YWl0IGlua3MocGFnZSwgZ2x5cGgsICdzdHJva2UnLCAncHJpbWFyeS1ob3ZlcicpO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhd2FpdCBpbmtzKHBhZ2UsIGdseXBoLCAnc3Ryb2tlJywgJ3ByaW1hcnktcHJlc3MnKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcbn0pO1xuXG5zY2VuYXJpbygnQ2hlY2tib3g6IHRoZSB0b2dnbGUtYnV0dG9uIGNoZWNrYm94IHRvZ2dsZXMgaXRzIGZpbGwgYW5kIGhhcyBob3ZlciwgcHJlc3NlZCBhbmQgZGlzYWJsZWQgbG9va3MnLCAnQ2hlY2tib3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBvZmYgPSBjayhwYWdlLCAnUGh5c2ljcycpO1xuXHRjb25zdCBvbiA9IGNrKHBhZ2UsICdDb2xsaXNpb24nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwob2ZmKSwgQ0xFQVIpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIG9mZik7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBvZmYsICdkcm9wZG93bicpO1xuXHRhd2FpdCBvZmYuY2xpY2soKTtcblx0YXdhaXQgYXR0cihvZmYsICdhcmlhLXByZXNzZWQnLCAndHJ1ZScpO1xuXHRhd2FpdCBjbHMob2ZmLCAnY2hlY2tib3gtdG9nZ2xlLS1jaGVja2VkJywgdHJ1ZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBvZmYsICdwcmltYXJ5LWhvdmVyJyk7XG5cdGF3YWl0IGF3YXkocGFnZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBvZmYsICdwcmltYXJ5Jyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgb24pO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgb24sICdkcm9wZG93bicpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRhd2FpdCBhdHRyKG9uLCAnYXJpYS1wcmVzc2VkJywgJ2ZhbHNlJyk7XG5cdGNvbnN0IGxvY2tlZCA9IGNrKHBhZ2UsICdMb2NrZWQgdG9nZ2xlJyk7XG5cdGF3YWl0IGxvY2tlZC5jbGljayh7IGZvcmNlOiB0cnVlIH0pO1xuXHRhd2FpdCBhdHRyKGxvY2tlZCwgJ2FyaWEtcHJlc3NlZCcsICdmYWxzZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChsb2NrZWQsICdvcGFjaXR5JyksICcwLjQ1Jyk7XG5cdGNvbnN0IGxvY2tlZEJveCA9IGNrKHBhZ2UsICdMb2NrZWQnKTtcblx0YXdhaXQgbG9ja2VkQm94LmNsaWNrKHsgZm9yY2U6IHRydWUgfSk7XG5cdGF3YWl0IGF0dHIobG9ja2VkQm94LCAnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcbn0pO1xuXG5zY2VuYXJpbygnQ2hlY2tib3g6IFRhYiBzaG93cyB0aGUgUHJpbWFyeSBmb2N1cyByaW5nJywgJ0NoZWNrYm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXdhaXQgdGFwKHBhZ2UsICdUYWInKTtcblx0Y29uc3QgZmlyc3QgPSBjayhwYWdlLCAnU2ltdWxhdGUgUGh5c2ljcycpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaXNGb2N1c2VkKGZpcnN0KSwgdHJ1ZSk7XG5cdGF3YWl0IGlua3MocGFnZSwgZmlyc3QsICdvdXRsaW5lLWNvbG9yJywgJ3ByaW1hcnknKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AoZmlyc3QsICdvdXRsaW5lLXN0eWxlJyksICdzb2xpZCcpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gVGV4dElucHV0IC0tLS0tLS0tLS1cblxuY29uc3QgVEkgPSAndWUtdGV4dC1pbnB1dCAnO1xuY29uc3QgdGlCb3ggPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKFRJICsgJy50ZXh0aW5wdXQnKS5udGgoaW5kZXgpO1xuXG5zY2VuYXJpbygnVGV4dElucHV0OiBob3ZlciBsaWdodHMgdGhlIG91dGxpbmUsIGZvY3VzIHR1cm5zIGl0IFByaW1hcnkgd2l0aCB3aGl0ZSB0ZXh0JywgJ1RleHRJbnB1dCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHRpQm94KHBhZ2UsIDEpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgYm94LCAnaW5wdXQtb3V0bGluZScpO1xuXHRhd2FpdCBpbmtzKHBhZ2UsIGJveCwgJ2NvbG9yJywgJ2ZvcmVncm91bmQnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBib3gpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgYm94LCAnaG92ZXInKTtcblx0YXdhaXQgYm94LmxvY2F0b3IoJ2lucHV0JykuY2xpY2soKTtcblx0YXdhaXQgYXdheShwYWdlKTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIGJveCwgJ3ByaW1hcnknKTtcblx0YXdhaXQgaW5rcyhwYWdlLCBib3gsICdjb2xvcicsICdmb3JlZ3JvdW5kLWhvdmVyJyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBib3gsICdpbnB1dCcpO1xufSk7XG5cbnNjZW5hcmlvKCdUZXh0SW5wdXQ6IHR5cGluZyBlZGl0cyB0aGUgZmllbGQgYW5kIHRoZSBoaW50IHNob3dzIG9ubHkgd2hpbGUgaXQgaXMgZW1wdHknLCAnVGV4dElucHV0JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZmllbGQgPSB0aUJveChwYWdlLCAwKS5sb2NhdG9yKCdpbnB1dCcpO1xuXHRhd2FpdCBhdHRyKGZpZWxkLCAncGxhY2Vob2xkZXInLCAnRW50ZXIgYSBuYW1lJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5ldmFsdWF0ZSgoZWwpID0+IGVsLm1hdGNoZXMoJzpwbGFjZWhvbGRlci1zaG93bicpKSwgdHJ1ZSk7XG5cdGF3YWl0IGZpZWxkLmNsaWNrKCk7XG5cdGF3YWl0IHBhZ2Uua2V5Ym9hcmQudHlwZSgnQ2hhaXIwMScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmllbGQuaW5wdXRWYWx1ZSgpLCAnQ2hhaXIwMScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0JhY2tzcGFjZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmllbGQuaW5wdXRWYWx1ZSgpLCAnQ2hhaXIwJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5ldmFsdWF0ZSgoZWwpID0+IGVsLm1hdGNoZXMoJzpwbGFjZWhvbGRlci1zaG93bicpKSwgZmFsc2UpO1xufSk7XG5cbnNjZW5hcmlvKCdUZXh0SW5wdXQ6IHRoZSByZWFkLW9ubHkgYm94IHRha2VzIGZvY3VzIGJ1dCBjYW5ub3QgYmUgZWRpdGVkIGFuZCBrZWVwcyBpdHMgSGVhZGVyIGZpbGwnLCAnVGV4dElucHV0JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgYm94ID0gdGlCb3gocGFnZSwgMik7XG5cdGNvbnN0IGZpZWxkID0gYm94LmxvY2F0b3IoJ2lucHV0Jyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBib3gsICdoZWFkZXInKTtcblx0YXdhaXQgZmllbGQuY2xpY2soKTtcblx0YXdhaXQgcGFnZS5rZXlib2FyZC50eXBlKCd4eXonKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpZWxkLmlucHV0VmFsdWUoKSwgJ1N0YXRpY01lc2hBY3RvcicpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgYm94LCAnaGVhZGVyJyk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCBib3gsICdpbnB1dC1vdXRsaW5lJyk7XG59KTtcblxuc2NlbmFyaW8oJ1RleHRJbnB1dDogdGhlIHNlYXJjaCBib3ggc3dhcHMgdGhlIGdsYXNzIGZvciBhIGNsZWFyIGJ1dHRvbiBvbmNlIGl0IGhhcyB0ZXh0JywgJ1RleHRJbnB1dCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHRpQm94KHBhZ2UsIDMpO1xuXHRjb25zdCBmaWVsZCA9IGJveC5sb2NhdG9yKCdpbnB1dCcpO1xuXHRjb25zdCBnbGFzcyA9IGJveC5sb2NhdG9yKCcudGV4dGlucHV0X19nbGFzcycpO1xuXHRjb25zdCBjbGVhciA9IGJveC5sb2NhdG9yKCcudGV4dGlucHV0X19jbGVhcicpO1xuXHRhd2FpdCBzZWVuKGdsYXNzLCB0cnVlKTtcblx0YXdhaXQgc2VlbihjbGVhciwgZmFsc2UpO1xuXHRhd2FpdCBmaWVsZC5jbGljaygpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJ2NoYWlyJyk7XG5cdGF3YWl0IHNlZW4oZ2xhc3MsIGZhbHNlKTtcblx0YXdhaXQgc2VlbihjbGVhciwgdHJ1ZSk7XG5cdGF3YWl0IGNsZWFyLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5pbnB1dFZhbHVlKCksICcnKTtcblx0YXdhaXQgc2VlbihnbGFzcywgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpc0ZvY3VzZWQoZmllbGQpLCB0cnVlKTtcbn0pO1xuXG5zY2VuYXJpbygnVGV4dElucHV0OiBFc2NhcGUgY2xlYXJzIHRoZSBzZWFyY2ggYm94JywgJ1RleHRJbnB1dCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHRpQm94KHBhZ2UsIDMpO1xuXHRjb25zdCBmaWVsZCA9IGJveC5sb2NhdG9yKCdpbnB1dCcpO1xuXHRhd2FpdCBmaWVsZC5jbGljaygpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJ2xhbXAnKTtcblx0YXdhaXQgY2xzKGJveCwgJ3RleHRpbnB1dC0tZmlsbGVkJywgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRXNjYXBlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5pbnB1dFZhbHVlKCksICcnKTtcblx0YXdhaXQgY2xzKGJveCwgJ3RleHRpbnB1dC0tZmlsbGVkJywgZmFsc2UpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gU3BpbkJveCAtLS0tLS0tLS0tXG5cbmNvbnN0IFNCID0gJ3VlLXNwaW4tYm94ICc7XG5jb25zdCBzYkJveCA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoU0IgKyAnLnNwaW5ib3gnKS5udGgoaW5kZXgpO1xuY29uc3Qgc2JWYWx1ZSA9IGFzeW5jIChib3g6IExvY2F0b3IpOiBQcm9taXNlPG51bWJlcj4gPT4gTnVtYmVyKGF3YWl0IGJveC5nZXRBdHRyaWJ1dGUoJ2FyaWEtdmFsdWVub3cnKSk7XG5jb25zdCBzYlRleHQgPSBhc3luYyAoYm94OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+ICgoYXdhaXQgYm94LmxvY2F0b3IoJy5zcGluYm94X190ZXh0JykudGV4dENvbnRlbnQoKSkgPz8gJycpLnRyaW0oKTtcblxuLy8gUHJlc3NlcyBvbiB0aGUgYm94LCBtb3ZlcyBzaWRld2F5cyBhbmQgb3B0aW9uYWxseSBrZWVwcyB0aGUgYnV0dG9uIGRvd24uXG5hc3luYyBmdW5jdGlvbiBkcmFnQnkocGFnZTogUGFnZSwgYm94OiBMb2NhdG9yLCBkeDogbnVtYmVyLCBrZWVwRG93biA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGMgPSBhd2FpdCBwb2ludEF0KHBhZ2UsIGJveCk7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZShjLnggKyBkeCAvIDIsIGMueSwgeyBzdGVwczogNiB9KTtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKGMueCArIGR4LCBjLnksIHsgc3RlcHM6IDYgfSk7XG5cdGlmICgha2VlcERvd24pIGF3YWl0IHJlbGVhc2UocGFnZSk7XG59XG5cbnNjZW5hcmlvKCdTcGluQm94OiBkcmFnZ2luZyBjaGFuZ2VzIHRoZSB2YWx1ZSwgdGhlIGZpbGwgYmFyIHRyYWNrcyBpdCBhbmQgdGhlIGFjdGl2ZSBsb29rIHNob3dzIHdoaWxlIGhlbGQnLCAnU3BpbkJveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHNiQm94KHBhZ2UsIDEpO1xuXHRjb25zdCBmaWxsQmFyID0gYm94LmxvY2F0b3IoJy5zcGluYm94X19maWxsJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGJveCwgJ2N1cnNvcicpLCAnZXctcmVzaXplJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlZhbHVlKGJveCksIDQwKTtcblx0YXdhaXQgZHJhZ0J5KHBhZ2UsIGJveCwgNDAsIHRydWUpO1xuXHRhd2FpdCBjbHMoYm94LCAnc3BpbmJveC0tYWN0aXZlJywgdHJ1ZSk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCBib3gsICdwcmltYXJ5Jyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBmaWxsQmFyLCAncHJpbWFyeScpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRhd2FpdCBjbHMoYm94LCAnc3BpbmJveC0tYWN0aXZlJywgZmFsc2UpO1xuXHRhd2FpdCBjbHMoYm94LCAnc3BpbmJveC0tdGV4dCcsIGZhbHNlKTtcblx0Y29uc3QgbGFuZGVkID0gYXdhaXQgc2JWYWx1ZShib3gpO1xuXHRhc3NlcnQub2sobGFuZGVkID49IDYwICYmIGxhbmRlZCA8PSA3MCAmJiBOdW1iZXIuaXNJbnRlZ2VyKGxhbmRlZCksICdhIDQwcHggZHJhZyBtb3ZlcyA0MCB0byBiZXR3ZWVuIDYwIGFuZCA3MCBhZnRlciB0aGUgNXB4IHRyaWdnZXIgYW5kIHRoZSBkZWx0YSBzbmFwLCBnb3QgJyArIGxhbmRlZCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlRleHQoYm94KSwgbGFuZGVkLnRvRml4ZWQoMSkpO1xuXHRjb25zdCB3aWR0aCA9IGF3YWl0IGJveC5ldmFsdWF0ZSgoZWwpID0+IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoKTtcblx0Y29uc3QgZmlsbFdpZHRoID0gYXdhaXQgZmlsbEJhci5ldmFsdWF0ZSgoZWwpID0+IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoKTtcblx0YXNzZXJ0Lm9rKE1hdGguYWJzKGZpbGxXaWR0aCAtIChsYW5kZWQgLyAxMDAgKiB3aWR0aCAtIDIpKSA8IDAuNiwgJ2ZpbGwgd2lkdGggJyArIGZpbGxXaWR0aCArICcgb2YgJyArIHdpZHRoKTtcbn0pO1xuXG5zY2VuYXJpbygnU3BpbkJveDogdGhlIHZhbHVlIGNsYW1wcyB0byB0aGUgcmFuZ2UgYXQgYm90aCBlbmRzJywgJ1NwaW5Cb3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBzYkJveChwYWdlLCAxKTtcblx0YXdhaXQgZHJhZ0J5KHBhZ2UsIGJveCwgOTAwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVmFsdWUoYm94KSwgMTAwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJveC5ldmFsdWF0ZSgoZWwpID0+IGVsLnN0eWxlLmdldFByb3BlcnR5VmFsdWUoJy0tc3BpbmJveC1maWxsJykpLCAnMScpO1xuXHRhd2FpdCBkcmFnQnkocGFnZSwgYm94LCAtOTAwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVmFsdWUoYm94KSwgMCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlRleHQoYm94KSwgJzAuMCcpO1xufSk7XG5cbnNjZW5hcmlvKCdTcGluQm94OiBhIGNsaWNrIHdpdGhvdXQgYSBkcmFnIG9wZW5zIHRleHQgZW50cnksIEVudGVyIGNvbW1pdHMgYW5kIGNsYW1wcywgRXNjYXBlIGNhbmNlbHMnLCAnU3BpbkJveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHNiQm94KHBhZ2UsIDEpO1xuXHRhd2FpdCBib3guY2xpY2soKTtcblx0YXdhaXQgY2xzKGJveCwgJ3NwaW5ib3gtLXRleHQnLCB0cnVlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGJveC5sb2NhdG9yKCdpbnB1dCcpLmlucHV0VmFsdWUoKSwgJzQwLjAnKTtcblx0YXdhaXQgc2Vlbihib3gubG9jYXRvcignLnNwaW5ib3hfX2ZpbGwnKSwgZmFsc2UpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJzU1Jyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRW50ZXInKTtcblx0YXdhaXQgY2xzKGJveCwgJ3NwaW5ib3gtLXRleHQnLCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlZhbHVlKGJveCksIDU1KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVGV4dChib3gpLCAnNTUuMCcpO1xuXHRhd2FpdCBib3guY2xpY2soKTtcblx0YXdhaXQgcGFnZS5rZXlib2FyZC50eXBlKCc5OTknKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbnRlcicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JWYWx1ZShib3gpLCAxMDApO1xuXHRhd2FpdCBib3guY2xpY2soKTtcblx0YXdhaXQgcGFnZS5rZXlib2FyZC50eXBlKCcxMicpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VzY2FwZScpO1xuXHRhd2FpdCBjbHMoYm94LCAnc3BpbmJveC0tdGV4dCcsIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVmFsdWUoYm94KSwgMTAwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVGV4dChib3gpLCAnMTAwLjAnKTtcbn0pO1xuXG5zY2VuYXJpbygnU3BpbkJveDogVXAgYW5kIERvd24gYXJyb3dzIHN0ZXAgYnkgdGhlIGRlbHRhIGFuZCBzdG9wIGF0IHRoZSBsaW1pdCwgRW50ZXIgb3BlbnMgdGV4dCBlbnRyeScsICdTcGluQm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgYm94ID0gc2JCb3gocGFnZSwgMCk7XG5cdGF3YWl0IGJveC5mb2N1cygpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93VXAnKTtcblx0YXNzZXJ0LmVxdWFsKE1hdGgucm91bmQoKGF3YWl0IHNiVmFsdWUoYm94KSkgKiAxMDApIC8gMTAwLCAwLjQxKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0Rvd24nLCAnQXJyb3dEb3duJyk7XG5cdGFzc2VydC5lcXVhbChNYXRoLnJvdW5kKChhd2FpdCBzYlZhbHVlKGJveCkpICogMTAwKSAvIDEwMCwgMC4zOSk7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgODA7IGkrKykgYXdhaXQgdGFwKHBhZ2UsICdBcnJvd1VwJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlZhbHVlKGJveCksIDEpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGF3YWl0IGNscyhib3gsICdzcGluYm94LS10ZXh0JywgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRXNjYXBlJyk7XG59KTtcblxuc2NlbmFyaW8oJ1NwaW5Cb3g6IEVzY2FwZSBkdXJpbmcgYSBkcmFnIHJlc3RvcmVzIHRoZSB2YWx1ZScsICdTcGluQm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgYm94ID0gc2JCb3gocGFnZSwgMSk7XG5cdGF3YWl0IGRyYWdCeShwYWdlLCBib3gsIDUwLCB0cnVlKTtcblx0YXNzZXJ0Lm5vdEVxdWFsKGF3YWl0IHNiVmFsdWUoYm94KSwgNDApO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VzY2FwZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JWYWx1ZShib3gpLCA0MCk7XG5cdGF3YWl0IGNscyhib3gsICdzcGluYm94LS1hY3RpdmUnLCBmYWxzZSk7XG5cdGF3YWl0IHJlbGVhc2UocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlZhbHVlKGJveCksIDQwKTtcbn0pO1xuXG5zY2VuYXJpbygnU3BpbkJveDogYW4gdW5ib3VuZGVkIGJveCBoYXMgbm8gZmlsbCBhbmQgZHJhZ3MgYnkgYSBzaGFyZSBvZiBpdHMgdmFsdWUsIGEgZGlzYWJsZWQgYm94IGlnbm9yZXMgdGhlIHBvaW50ZXInLCAnU3BpbkJveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGZyZWUgPSBzYkJveChwYWdlLCAyKTtcblx0YXdhaXQgc2VlbihmcmVlLmxvY2F0b3IoJy5zcGluYm94X19maWxsJyksIGZhbHNlKTtcblx0YXdhaXQgZHJhZ0J5KHBhZ2UsIGZyZWUsIDYwKTtcblx0YXNzZXJ0Lm9rKChhd2FpdCBzYlZhbHVlKGZyZWUpKSA+IDEzMDAsICd2YWx1ZSAnICsgKGF3YWl0IHNiVmFsdWUoZnJlZSkpKTtcblx0Y29uc3QgbG9ja2VkID0gc2JCb3gocGFnZSwgMyk7XG5cdGF3YWl0IGRyYWdCeShwYWdlLCBsb2NrZWQsIDYwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVmFsdWUobG9ja2VkKSwgNDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChsb2NrZWQsICdvcGFjaXR5JyksICcwLjQ1Jyk7XG5cdGF3YWl0IGxvY2tlZC5jbGljayh7IGZvcmNlOiB0cnVlIH0pO1xuXHRhd2FpdCBjbHMobG9ja2VkLCAnc3BpbmJveC0tdGV4dCcsIGZhbHNlKTtcbn0pO1xuXG5zY2VuYXJpbygnU3BpbkJveDogaG92ZXIgb3V0bGluZXMgSG92ZXIgYW5kIGZpbGxzIEhvdmVyLCB0aGUgaWRsZSBmaWxsIGlzIERyb3Bkb3duJywgJ1NwaW5Cb3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBzYkJveChwYWdlLCAxKTtcblx0Y29uc3QgZmlsbEJhciA9IGJveC5sb2NhdG9yKCcuc3BpbmJveF9fZmlsbCcpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgZmlsbEJhciwgJ2Ryb3Bkb3duJyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgYm94KTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIGZpbGxCYXIsICdob3ZlcicpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgYm94LCAnaG92ZXInKTtcblx0YXdhaXQgYXdheShwYWdlKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIGZpbGxCYXIsICdkcm9wZG93bicpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gU2xpZGVyIC0tLS0tLS0tLS1cblxuY29uc3QgU0wgPSAndWUtc2xpZGVyICc7XG5jb25zdCBzbGlkZXIgPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKFNMICsgJy5zbGlkZXInKS5udGgoaW5kZXgpO1xuY29uc3Qgc2xWYWx1ZSA9IGFzeW5jIChlbDogTG9jYXRvcik6IFByb21pc2U8bnVtYmVyPiA9PiBOdW1iZXIoYXdhaXQgZWwuZ2V0QXR0cmlidXRlKCdhcmlhLXZhbHVlbm93JykpO1xuXG5zY2VuYXJpbygnU2xpZGVyOiBjbGlja2luZyB0aGUgYmFyIGp1bXBzIHRoZSB0aHVtYiB0aGVyZSBhbmQgZHJhZ2dpbmcgZm9sbG93cyB0aGUgcG9pbnRlcicsICdTbGlkZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBlbCA9IHNsaWRlcihwYWdlLCAwKTtcblx0Y29uc3QgYm94ID0gYXdhaXQgZWwuYm91bmRpbmdCb3goKTtcblx0YXNzZXJ0Lm9rKGJveCk7XG5cdGF3YWl0IHBhZ2UubW91c2UuY2xpY2soYm94LnggKyA4ICsgMC43NSAqIChib3gud2lkdGggLSAxNiksIGJveC55ICsgNCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMC43NSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoU0wgKyAnLnNsaWRlci12YWx1ZScpLm50aCgwKS50ZXh0Q29udGVudCgpLCAnMC43NScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZWwuZXZhbHVhdGUoKGUpID0+IGUuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1zbGlkZXItdmFsdWUnKSksICcwLjc1Jyk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZShib3gueCArIDEwMCwgYm94LnkgKyA0KTtcblx0YXdhaXQgaG9sZChwYWdlKTtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKGJveC54ICsgMzAsIGJveC55ICsgNCwgeyBzdGVwczogNSB9KTtcblx0YXNzZXJ0Lm9rKE1hdGguYWJzKChhd2FpdCBzbFZhbHVlKGVsKSkgLSAoMzAgLSA4KSAvIChib3gud2lkdGggLSAxNikpIDwgMC4wMTEpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoYm94LnggLSA4MCwgYm94LnkgKyA0LCB7IHN0ZXBzOiA1IH0pO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2xWYWx1ZShlbCksIDApO1xuXHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoYm94LnggKyA1MDAsIGJveC55ICsgNCwgeyBzdGVwczogNSB9KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCAxKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0Y29uc3QgdGh1bWJCb3ggPSBhd2FpdCBlbC5sb2NhdG9yKCcuc2xpZGVyX190aHVtYicpLmJvdW5kaW5nQm94KCk7XG5cdGFzc2VydC5vayh0aHVtYkJveCk7XG5cdGFzc2VydC5vayhNYXRoLmFicyh0aHVtYkJveC54ICsgNCAtIChib3gueCArIGJveC53aWR0aCAtIDgpKSA8IDAuNiwgJ3RoZSB0aHVtYiBjZW50cmUgc2l0cyA4cHggZnJvbSB0aGUgcmlnaHQgZW5kJyk7XG59KTtcblxuc2NlbmFyaW8oJ1NsaWRlcjogdGhlIHN0ZXBwZWQgc2xpZGVyIHNuYXBzIHRvIGl0cyBzdGVwJywgJ1NsaWRlcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGVsID0gc2xpZGVyKHBhZ2UsIDEpO1xuXHRjb25zdCBib3ggPSBhd2FpdCBlbC5ib3VuZGluZ0JveCgpO1xuXHRhc3NlcnQub2soYm94KTtcblx0YXdhaXQgcGFnZS5tb3VzZS5jbGljayhib3gueCArIDggKyAwLjUyICogKGJveC53aWR0aCAtIDE2KSwgYm94LnkgKyA0KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCA1MCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoU0wgKyAnLnNsaWRlci12YWx1ZScpLm50aCgxKS50ZXh0Q29udGVudCgpLCAnNTAnKTtcbn0pO1xuXG5zY2VuYXJpbygnU2xpZGVyOiBhcnJvdyBrZXlzLCBQYWdlIGtleXMsIEhvbWUgYW5kIEVuZCBtb3ZlIHRoZSB2YWx1ZSBhbmQgc3RvcCBhdCB0aGUgZW5kcycsICdTbGlkZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBlbCA9IHNsaWRlcihwYWdlLCAwKTtcblx0YXdhaXQgZWwuZm9jdXMoKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd1JpZ2h0Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMC41MSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dMZWZ0JywgJ0Fycm93TGVmdCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2xWYWx1ZShlbCksIDAuNDkpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ1BhZ2VVcCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2xWYWx1ZShlbCksIDAuNTkpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VuZCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2xWYWx1ZShlbCksIDEpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93UmlnaHQnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCAxKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdIb21lJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMCk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMCk7XG5cdGF3YWl0IGlua3MocGFnZSwgZWwsICdvdXRsaW5lLWNvbG9yJywgJ3ByaW1hcnknKTtcbn0pO1xuXG5zY2VuYXJpbygnU2xpZGVyOiB0aGUgdGh1bWIgaXMgRm9yZWdyb3VuZCBhbmQgYnJpZ2h0ZW5zIHRvIEZvcmVncm91bmRIb3ZlciBvbiBob3ZlciBhbmQgd2hpbGUgcHJlc3NlZCcsICdTbGlkZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBlbCA9IHNsaWRlcihwYWdlLCAwKTtcblx0Y29uc3QgdGh1bWIgPSBlbC5sb2NhdG9yKCcuc2xpZGVyX190aHVtYicpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgdGh1bWIsICdmb3JlZ3JvdW5kJyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgZWwpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgdGh1bWIsICdmb3JlZ3JvdW5kLWhvdmVyJyk7XG5cdGF3YWl0IGF3YXkocGFnZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCB0aHVtYiwgJ2ZvcmVncm91bmQnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBlbCk7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCB0aHVtYiwgJ2ZvcmVncm91bmQtaG92ZXInKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcbn0pO1xuXG5zY2VuYXJpbygnU2xpZGVyOiBhIGRpc2FibGVkIHNsaWRlciBpZ25vcmVzIHRoZSBwb2ludGVyIGFuZCBzdGF5cyBkaW1tZWQnLCAnU2xpZGVyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZWwgPSBzbGlkZXIocGFnZSwgMik7XG5cdGNvbnN0IGJveCA9IGF3YWl0IGVsLmJvdW5kaW5nQm94KCk7XG5cdGFzc2VydC5vayhib3gpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLmNsaWNrKGJveC54ICsgMjAsIGJveC55ICsgNCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMC41KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AoZWwsICdvcGFjaXR5JyksICcwLjQ1Jyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgZWwpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgZWwubG9jYXRvcignLnNsaWRlcl9fdGh1bWInKSwgJ2ZvcmVncm91bmQnKTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tIFRvb2x0aXAgLS0tLS0tLS0tLVxuXG5jb25zdCBUVCA9ICd1ZS10b29sdGlwICc7XG5jb25zdCBwb3B1cCA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoVFQgKyAnLnRvb2x0aXAtcG9wdXAnKS5udGgoaW5kZXgpO1xuXG5zY2VuYXJpbygnVG9vbHRpcDogaG92ZXJpbmcgYSB0YXJnZXQgc2hvd3MgaXQgYWZ0ZXIgYSBzaG9ydCBkZWxheSBuZWFyIHRoZSBwb2ludGVyIGFuZCBsZWF2aW5nIGhpZGVzIGl0JywgJ1Rvb2x0aXAnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCB0aXAgPSBwb3B1cChwYWdlLCAwKTtcblx0Y29uc3QgYyA9IGF3YWl0IHBvaW50QXQocGFnZSwgcGFnZS5sb2NhdG9yKFRUICsgJy50b29sdGlwLXRhcmdldCcpLm50aCgwKSk7XG5cdGF3YWl0IHNlZW4odGlwLCBmYWxzZSk7XG5cdGF3YWl0IHdhaXQocGFnZSwgNDUwKTtcblx0YXdhaXQgc2Vlbih0aXAsIHRydWUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcCh0aXAsICdvcGFjaXR5JyksICcxJyk7XG5cdGNvbnN0IGJveCA9IGF3YWl0IHRpcC5ib3VuZGluZ0JveCgpO1xuXHRhc3NlcnQub2soYm94KTtcblx0YXNzZXJ0Lm9rKE1hdGguYWJzKGJveC54IC0gKGMueCArIDEyKSkgPCAxLjUgJiYgTWF0aC5hYnMoYm94LnkgLSAoYy55ICsgOCkpIDwgMS41LCAnb2Zmc2V0ICgxMiwgOCkgZnJvbSB0aGUgcG9pbnRlcjogJyArIGJveC54ICsgJywnICsgYm94LnkpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgdGlwLCAnZHJvcGRvd24nKTtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKGMueCArIDIwLCBjLnkgKyAzKTtcblx0YXdhaXQgd2FpdChwYWdlLCA2MCk7XG5cdGNvbnN0IG1vdmVkID0gYXdhaXQgdGlwLmJvdW5kaW5nQm94KCk7XG5cdGFzc2VydC5vayhtb3ZlZCk7XG5cdGFzc2VydC5vayhNYXRoLmFicyhtb3ZlZC54IC0gKGMueCArIDIwICsgMTIpKSA8IDEuNSwgJ3RoZSB0b29sdGlwIGZvbGxvd3MgdGhlIHBvaW50ZXInKTtcblx0YXdhaXQgYXdheShwYWdlKTtcblx0YXdhaXQgd2FpdChwYWdlLCA4MCk7XG5cdGF3YWl0IHNlZW4odGlwLCBmYWxzZSk7XG59KTtcblxuc2NlbmFyaW8oJ1Rvb2x0aXA6IGEgcHJlc3MgYW5kIEVzY2FwZSBib3RoIGhpZGUgaXQsIGFuZCBhIHByZXNzIGtlZXBzIGl0IGhpZGRlbiB1bnRpbCB0aGUgcG9pbnRlciBsZWF2ZXMnLCAnVG9vbHRpcCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHRpcCA9IHBvcHVwKHBhZ2UsIDEpO1xuXHRjb25zdCBjID0gYXdhaXQgcG9pbnRBdChwYWdlLCBwYWdlLmxvY2F0b3IoVFQgKyAnLnRvb2x0aXAtdGFyZ2V0JykubnRoKDEpKTtcblx0YXdhaXQgd2FpdChwYWdlLCA0MDApO1xuXHRhd2FpdCBzZWVuKHRpcCwgdHJ1ZSk7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGF3YWl0IHJlbGVhc2UocGFnZSk7XG5cdGF3YWl0IHdhaXQocGFnZSwgNjApO1xuXHRhd2FpdCBzZWVuKHRpcCwgZmFsc2UpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoYy54ICsgNCwgYy55ICsgMik7XG5cdGF3YWl0IHdhaXQocGFnZSwgMzUwKTtcblx0YXdhaXQgc2Vlbih0aXAsIGZhbHNlKTtcblx0YXdhaXQgYXdheShwYWdlKTtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKGMueCwgYy55KTtcblx0YXdhaXQgd2FpdChwYWdlLCA0MDApO1xuXHRhd2FpdCBzZWVuKHRpcCwgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRXNjYXBlJyk7XG5cdGF3YWl0IHdhaXQocGFnZSwgNDApO1xuXHRhd2FpdCBzZWVuKHRpcCwgZmFsc2UpO1xufSk7XG5cbnNjZW5hcmlvKCdUb29sdGlwOiBrZXlib2FyZCBmb2N1cyBzaG93cyBpdCBhbmQgYmx1ciBoaWRlcyBpdCwgdGhlIHRleHQtb25seSBmb3JtIGlzIGJsYWNrIG9uIHRoZSBicmlnaHQgZmlsbCcsICdUb29sdGlwJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXdhaXQgdGFwKHBhZ2UsICdUYWInLCAnVGFiJyk7XG5cdGNvbnN0IHRpcCA9IHBvcHVwKHBhZ2UsIDEpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDQwMCk7XG5cdGF3YWl0IHNlZW4odGlwLCB0cnVlKTtcblx0YXdhaXQgaW5rcyhwYWdlLCB0aXAsICdjb2xvcicsICdibGFjaycpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgdGlwLCAnZm9yZWdyb3VuZCcpO1xuXHRhd2FpdCBzZWVuKHBvcHVwKHBhZ2UsIDApLCBmYWxzZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnVGFiJyk7XG5cdGF3YWl0IHdhaXQocGFnZSwgNjApO1xuXHRhd2FpdCBzZWVuKHRpcCwgZmFsc2UpO1xufSk7XG5cbnNjZW5hcmlvKCdUb29sdGlwOiBwaW5uZWQgc3BlY2ltZW5zIHN0YXkgdmlzaWJsZSBwbGFpbiBIVE1MIGFuZCB0aGUgbGl2ZSB0b29sdGlwIHN0YXJ0cyBoaWRkZW4nLCAnVG9vbHRpcCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHBpbm5lZCA9IHBhZ2UubG9jYXRvcignLnRvb2x0aXBbZGF0YS1waW5uZWRdJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwaW5uZWQuY291bnQoKSwgMik7XG5cdGF3YWl0IHNlZW4ocGlubmVkLmZpcnN0KCksIHRydWUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGlubmVkLmZpcnN0KCkuZXZhbHVhdGUoKGVsKSA9PiBlbC5jbG9zZXN0KCd1ZS10b29sdGlwJykpLCBudWxsKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBvcHVwKHBhZ2UsIDApLmV2YWx1YXRlKChlbCkgPT4gZWwuaGFzQXR0cmlidXRlKCdoaWRkZW4nKSksIHRydWUpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gUG9wdXBNZW51IC0tLS0tLS0tLS1cblxuY29uc3QgUE0gPSAndWUtcG9wdXAtbWVudSAnO1xuY29uc3QgbWVudSA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoUE0gKyAnLnBvcHVwbWVudVt0YWJpbmRleF0nKS5udGgoaW5kZXgpO1xuY29uc3Qgcm93ID0gKHBhZ2U6IFBhZ2UsIGxhYmVsOiBzdHJpbmcpOiBMb2NhdG9yID0+IHBhZ2UubG9jYXRvcihQTSArICcucG9wdXBtZW51X19yb3cnKS5maWx0ZXIoeyBoYXM6IHBhZ2UubG9jYXRvcignLnBvcHVwbWVudV9fbGFiZWwnLCB7IGhhc1RleHQ6IG5ldyBSZWdFeHAoJ14nICsgbGFiZWwgKyAnJCcpIH0pIH0pO1xuY29uc3QgY3VycmVudCA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBtZW51KHBhZ2UsIGluZGV4KS5sb2NhdG9yKCcucG9wdXBtZW51X19yb3ctLWhvdmVyJyk7XG5jb25zdCBjdXJyZW50TGFiZWwgPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4gPT4gY3VycmVudChwYWdlLCBpbmRleCkubG9jYXRvcignLnBvcHVwbWVudV9fbGFiZWwnKS5maXJzdCgpLnRleHRDb250ZW50KCk7XG5jb25zdCBtZW51U3RhdHVzID0gKHBhZ2U6IFBhZ2UsIGluZGV4OiBudW1iZXIpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+ID0+IHBhZ2UubG9jYXRvcihQTSArICcucG9wdXBtZW51LXN0YXR1cycpLm50aChpbmRleCkudGV4dENvbnRlbnQoKTtcblxuc2NlbmFyaW8oJ1BvcHVwTWVudTogaG92ZXJpbmcgYSByb3cgZmlsbHMgaXQgd2l0aCBQcmltYXJ5IGFuZCBhIHByZXNzZWQgcm93IGRyb3BzIDFweCcsICdQb3B1cE1lbnUnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBjb3B5ID0gcm93KHBhZ2UsICdDb3B5Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKGNvcHkpLCBDTEVBUik7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgY29weSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBjb3B5LCAncHJpbWFyeScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChjb3B5LCAncGFkZGluZy10b3AnKSwgJzNweCcpO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChjb3B5LCAncGFkZGluZy10b3AnKSwgJzRweCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChjb3B5LCAncGFkZGluZy1ib3R0b20nKSwgJzJweCcpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChjb3B5LCAncGFkZGluZy10b3AnKSwgJzNweCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudVN0YXR1cyhwYWdlLCAxKSwgJ0FjdGl2YXRlZDogQ29weScpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChjb3B5KSwgQ0xFQVIpO1xufSk7XG5cbnNjZW5hcmlvKCdQb3B1cE1lbnU6IGFycm93IGtleXMgaGlnaGxpZ2h0LCBza2lwIHRoZSBkaXNhYmxlZCByb3cgYW5kIHdyYXAsIEhvbWUgYW5kIEVuZCBqdW1wJywgJ1BvcHVwTWVudScsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGF3YWl0IG1lbnUocGFnZSwgMCkuZm9jdXMoKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGN1cnJlbnRMYWJlbChwYWdlLCAwKSwgJ1Nob3cgR3JpZCcpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgY3VycmVudChwYWdlLCAwKSwgJ3ByaW1hcnknKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbmQnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGN1cnJlbnRMYWJlbChwYWdlLCAwKSwgJ1RvcCcpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDApLCAnU2hvdyBHcmlkJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dVcCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDApLCAnVG9wJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoUE0gKyAnLnBvcHVwbWVudV9fcm93LS1ob3ZlcicpLmNvdW50KCksIDEpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0hvbWUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGN1cnJlbnRMYWJlbChwYWdlLCAwKSwgJ1Nob3cgR3JpZCcpO1xufSk7XG5cbnNjZW5hcmlvKCdQb3B1cE1lbnU6IEVudGVyIGFuZCBTcGFjZSBhY3RpdmF0ZSwgY2hlY2ttYXJrcyB0b2dnbGUsIHJhZGlvcyBwaWNrIG9uZSBhbmQgdGhlIGNhcHRpb24gbmFtZXMgdGhlIHBpY2snLCAnUG9wdXBNZW51JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZ3JpZCA9IHJvdyhwYWdlLCAnU2hvdyBHcmlkJyk7XG5cdGNvbnN0IGJvdW5kcyA9IHJvdyhwYWdlLCAnU2hvdyBCb3VuZHMnKTtcblx0YXdhaXQgbWVudShwYWdlLCAwKS5mb2N1cygpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicpO1xuXHRhd2FpdCBhdHRyKGdyaWQsICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnKTtcblx0YXdhaXQgc2VlbihncmlkLmxvY2F0b3IoJy5wb3B1cG1lbnVfX3RpY2snKSwgZmFsc2UpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGF3YWl0IGF0dHIoZ3JpZCwgJ2FyaWEtY2hlY2tlZCcsICd0cnVlJyk7XG5cdGF3YWl0IHNlZW4oZ3JpZC5sb2NhdG9yKCcucG9wdXBtZW51X190aWNrJyksIHRydWUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudVN0YXR1cyhwYWdlLCAwKSwgJ0FjdGl2YXRlZDogU2hvdyBHcmlkIChjaGVja2VkKScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicsICdTcGFjZScpO1xuXHRhd2FpdCBhdHRyKGJvdW5kcywgJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgbWVudVN0YXR1cyhwYWdlLCAwKSwgJ0FjdGl2YXRlZDogU2hvdyBCb3VuZHMgKHVuY2hlY2tlZCknKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbmQnLCAnRW50ZXInKTtcblx0YXdhaXQgYXR0cihyb3cocGFnZSwgJ1RvcCcpLCAnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcblx0YXdhaXQgYXR0cihyb3cocGFnZSwgJ1BlcnNwZWN0aXZlJyksICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHJvdyhwYWdlLCAnVG9wJykubG9jYXRvcignLnBvcHVwbWVudV9fcmFkaW8nKSwgJ3doaXRlJyk7XG5cdGF3YWl0IHJvdyhwYWdlLCAnUGVyc3BlY3RpdmUnKS5jbGljaygpO1xuXHRhd2FpdCBhdHRyKHJvdyhwYWdlLCAnUGVyc3BlY3RpdmUnKSwgJ2FyaWEtY2hlY2tlZCcsICd0cnVlJyk7XG5cdGF3YWl0IGF0dHIocm93KHBhZ2UsICdUb3AnKSwgJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpO1xuXHRhd2FpdCByb3cocGFnZSwgJ1Jlc2V0IExheW91dCcpLmNsaWNrKHsgZm9yY2U6IHRydWUgfSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51U3RhdHVzKHBhZ2UsIDApLCAnQWN0aXZhdGVkOiBQZXJzcGVjdGl2ZSAoc2VsZWN0ZWQpJyk7XG59KTtcblxuc2NlbmFyaW8oJ1BvcHVwTWVudTogUmlnaHQgb3BlbnMgdGhlIHN1Ym1lbnUgYW5kIGVudGVycyBpdCwgTGVmdCBjbG9zZXMgaXQsIHNlcGFyYXRvcnMgYW5kIGRpc2FibGVkIHJvd3MgYXJlIHNraXBwZWQnLCAnUG9wdXBNZW51JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3Qgc2F2ZUFzID0gcm93KHBhZ2UsICdTYXZlIEFzJyk7XG5cdGNvbnN0IHN1YiA9IHNhdmVBcy5sb2NhdG9yKCcucG9wdXBtZW51X19zdWInKTtcblx0YXdhaXQgbWVudShwYWdlLCAxKS5mb2N1cygpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicsICdBcnJvd0Rvd24nLCAnQXJyb3dEb3duJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMSksICdTYXZlIEFzJyk7XG5cdGF3YWl0IHNlZW4oc3ViLCBmYWxzZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRhd2FpdCBzZWVuKHN1YiwgdHJ1ZSk7XG5cdGF3YWl0IGF0dHIoc2F2ZUFzLCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBzYXZlQXMsICdwcmltYXJ5Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMSksICdBc3NldC4uLicpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDEpLCAnQ29weSBQYXRoJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMSksICdBc3NldC4uLicpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51U3RhdHVzKHBhZ2UsIDEpLCAnQWN0aXZhdGVkOiBBc3NldC4uLicpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93TGVmdCcpO1xuXHRhd2FpdCBzZWVuKHN1YiwgZmFsc2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDEpLCAnU2F2ZSBBcycpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93UmlnaHQnKTtcblx0YXdhaXQgc2VlbihzdWIsIHRydWUpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VzY2FwZScpO1xuXHRhd2FpdCBzZWVuKHN1YiwgZmFsc2UpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDEpLCAnRGVsZXRlJyk7XG59KTtcblxuc2NlbmFyaW8oJ1BvcHVwTWVudTogaG92ZXJpbmcgYSBzdWJtZW51IHJvdyBvcGVucyBpdHMgc3VibWVudSBhbmQgaXQgc3RheXMgb3BlbiB3aGlsZSB0aGUgcG9pbnRlciBpcyBpbnNpZGUnLCAnUG9wdXBNZW51JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3Qgc2F2ZUFzID0gcm93KHBhZ2UsICdTYXZlIEFzJyk7XG5cdGNvbnN0IHN1YiA9IHNhdmVBcy5sb2NhdG9yKCcucG9wdXBtZW51X19zdWInKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBzYXZlQXMubG9jYXRvcignLnBvcHVwbWVudV9fbGFiZWwnKS5maXJzdCgpKTtcblx0YXdhaXQgc2VlbihzdWIsIHRydWUpO1xuXHRjb25zdCBmaXJzdFN1YlJvdyA9IHN1Yi5sb2NhdG9yKCcucG9wdXBtZW51X19yb3cnKS5maXJzdCgpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIGZpcnN0U3ViUm93KTtcblx0YXdhaXQgc2VlbihzdWIsIHRydWUpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgZmlyc3RTdWJSb3csICdwcmltYXJ5Jyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBzYXZlQXMsICdwcmltYXJ5Jyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgcm93KHBhZ2UsICdDb3B5JykpO1xuXHRhd2FpdCBzZWVuKHN1YiwgZmFsc2UpO1xufSk7XG5cbnNjZW5hcmlvKCdQb3B1cE1lbnU6IHBpbm5lZCBtZW51cyBzdGF5IHBsYWluIEhUTUwgYW5kIGlnbm9yZSB0aGUgcG9pbnRlcicsICdQb3B1cE1lbnUnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBwaW5uZWQgPSBwYWdlLmxvY2F0b3IoJy5wb3B1cG1lbnVbZGF0YS1waW5uZWRdJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwaW5uZWQuY291bnQoKSwgMik7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwaW5uZWQuZmlyc3QoKS5ldmFsdWF0ZSgoZWwpID0+IGVsLmNsb3Nlc3QoJ3VlLXBvcHVwLW1lbnUnKSksIG51bGwpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChwaW5uZWQuZmlyc3QoKSwgJ3BvaW50ZXItZXZlbnRzJyksICdub25lJyk7XG59KTtcblxuLy8gLS0tLS0tLS0tLSBOb3RpZmljYXRpb24gLS0tLS0tLS0tLVxuXG5jb25zdCBOVCA9ICd1ZS1ub3RpZmljYXRpb24gJztcbmNvbnN0IHRvYXN0Q291bnQgPSAocGFnZTogUGFnZSk6IFByb21pc2U8bnVtYmVyPiA9PiBwYWdlLmxvY2F0b3IoTlQgKyAnLm5vdGlmaWNhdGlvbicpLmNvdW50KCk7XG5jb25zdCBzdGFja0hlaWdodCA9IGFzeW5jIChwYWdlOiBQYWdlKTogUHJvbWlzZTxudW1iZXI+ID0+IChhd2FpdCBwYWdlLmxvY2F0b3IoTlQgKyAnLm5vdGlmaWNhdGlvbi1zdGFjaycpLmJvdW5kaW5nQm94KCkpPy5oZWlnaHQgPz8gMDtcbmNvbnN0IHRvYXN0VGl0bGVzID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZ1tdPiA9PiBwYWdlLmxvY2F0b3IoTlQgKyAnLm5vdGlmaWNhdGlvbl9fdGl0bGUnKS5hbGxUZXh0Q29udGVudHMoKTtcbmNvbnN0IHRvYXN0R29uZSA9IChwYWdlOiBQYWdlLCByZW1haW5pbmc6IG51bWJlcik6IFByb21pc2U8dW5rbm93bj4gPT4gcGFnZS53YWl0Rm9yRnVuY3Rpb24oKG4pID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3VlLW5vdGlmaWNhdGlvbiAubm90aWZpY2F0aW9uJykubGVuZ3RoID09PSBuLCByZW1haW5pbmcpO1xuXG5zY2VuYXJpbygnTm90aWZpY2F0aW9uOiBEaXNtaXNzIHJlbW92ZXMgdGhlIHRvYXN0IGFuZCB0aGUgc3RhY2sgY2xvc2VzIHVwJywgJ05vdGlmaWNhdGlvbicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGFzc2VydC5lcXVhbChhd2FpdCB0b2FzdENvdW50KHBhZ2UpLCAxKTtcblx0YXNzZXJ0Lm9rKChhd2FpdCBzdGFja0hlaWdodChwYWdlKSkgPiA2MCk7XG5cdGF3YWl0IHBhZ2UubG9jYXRvcihOVCArICcubm90aWZpY2F0aW9uX19idG5bZGF0YS1hY3Rpb249XCJkaXNtaXNzXCJdJykuY2xpY2soKTtcblx0YXdhaXQgdG9hc3RHb25lKHBhZ2UsIDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc3RhY2tIZWlnaHQocGFnZSksIDApO1xufSk7XG5cbnNjZW5hcmlvKCdOb3RpZmljYXRpb246IFNob3cgbm90aWZpY2F0aW9uIGFkZHMgdG9hc3RzIGFuZCBkaXNtaXNzaW5nIG9uZSBjb2xsYXBzZXMgaXRzIGhlaWdodCBvdXQgb2YgdGhlIHN0YWNrJywgJ05vdGlmaWNhdGlvbicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHNob3cgPSBwYWdlLmxvY2F0b3IoTlQgKyAnW2RhdGEtYWN0aW9uPVwic2hvd1wiXScpO1xuXHRhd2FpdCBzaG93LmNsaWNrKCk7XG5cdGF3YWl0IHNob3cuY2xpY2soKTtcblx0YXdhaXQgd2FpdChwYWdlLCAzNTApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgdG9hc3RDb3VudChwYWdlKSwgMyk7XG5cdGFzc2VydC5kZWVwRXF1YWwoYXdhaXQgdG9hc3RUaXRsZXMocGFnZSksIFsnU2F2ZWQgMiBhc3NldHMnLCAnU2F2ZWQgMSBhc3NldCcsICdJbXBvcnQgZmFpbGVkJ10pO1xuXHRjb25zdCBmdWxsID0gYXdhaXQgc3RhY2tIZWlnaHQocGFnZSk7XG5cdGF3YWl0IHBhZ2UubG9jYXRvcihOVCArICcubm90aWZpY2F0aW9uJykubnRoKDApLmxvY2F0b3IoJ1tkYXRhLWFjdGlvbj1cImRpc21pc3NcIl0nKS5jbGljaygpO1xuXHRhd2FpdCB0b2FzdEdvbmUocGFnZSwgMik7XG5cdGNvbnN0IGxlc3MgPSBhd2FpdCBzdGFja0hlaWdodChwYWdlKTtcblx0YXNzZXJ0Lm9rKGZ1bGwgLSBsZXNzID4gNDAsICd0aGUgc3RhY2sgc2hyYW5rIGZyb20gJyArIGZ1bGwgKyAnIHRvICcgKyBsZXNzKTtcblx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0b2FzdFRpdGxlcyhwYWdlKSwgWydTYXZlZCAxIGFzc2V0JywgJ0ltcG9ydCBmYWlsZWQnXSk7XG59KTtcblxuc2NlbmFyaW8oJ05vdGlmaWNhdGlvbjogYnV0dG9ucyBoYXZlIGhvdmVyLCBwcmVzc2VkIGFuZCBmb2N1cyBsb29rcyBhbmQgUmV0cnkgZWRpdHMgdGhlIHN1YiB0ZXh0JywgJ05vdGlmaWNhdGlvbicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHJldHJ5ID0gcGFnZS5sb2NhdG9yKE5UICsgJ1tkYXRhLWFjdGlvbj1cInJldHJ5XCJdJyk7XG5cdGNvbnN0IHN1YiA9IHBhZ2UubG9jYXRvcihOVCArICcubm90aWZpY2F0aW9uX19zdWInKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHJldHJ5LCAnc2Vjb25kYXJ5Jyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgcmV0cnkpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcmV0cnksICdob3ZlcicpO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcmV0cnksICdoZWFkZXInKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AocmV0cnksICdwYWRkaW5nLXRvcCcpLCAnNC41cHgnKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHN1Yi50ZXh0Q29udGVudCgpLCAnQ2hhaXIuZmJ4IGNvdWxkIG5vdCBiZSByZWFkLiBSZXRyaWVkIDEgdGltZS4nKTtcblx0YXdhaXQgYXdheShwYWdlKTtcblx0YXdhaXQgcmV0cnkuZm9jdXMoKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdTaGlmdCtUYWInLCAnVGFiJyk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCByZXRyeSwgJ3ByaW1hcnknKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbnRlcicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc3ViLnRleHRDb250ZW50KCksICdDaGFpci5mYnggY291bGQgbm90IGJlIHJlYWQuIFJldHJpZWQgMiB0aW1lcy4nKTtcbn0pO1xuXG5zY2VuYXJpbygnTm90aWZpY2F0aW9uOiBhIGRpc21pc3NlZCB0b2FzdCBjYW4gYmUgYnJvdWdodCBiYWNrIHdpdGggU2hvdyBub3RpZmljYXRpb24nLCAnTm90aWZpY2F0aW9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXdhaXQgcGFnZS5sb2NhdG9yKE5UICsgJ1tkYXRhLWFjdGlvbj1cImRpc21pc3NcIl0nKS5jbGljaygpO1xuXHRhd2FpdCB0b2FzdEdvbmUocGFnZSwgMCk7XG5cdGF3YWl0IHBhZ2UubG9jYXRvcihOVCArICdbZGF0YS1hY3Rpb249XCJzaG93XCJdJykuY2xpY2soKTtcblx0YXdhaXQgd2FpdChwYWdlLCAzMDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgdG9hc3RDb3VudChwYWdlKSwgMSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBwYWdlLmxvY2F0b3IoTlQgKyAnLm5vdGlmaWNhdGlvbicpLCAnbm90aWZpY2F0aW9ucycpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKCcubm90aWZpY2F0aW9uW2RhdGEtcGlubmVkXScpLmNvdW50KCksIDMpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gRXhwYW5kYWJsZUFyZWEgLS0tLS0tLS0tLVxuXG5jb25zdCBFQSA9ICd1ZS1leHBhbmRhYmxlLWFyZWEgJztcbmNvbnN0IGFyZWEgPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKEVBICsgJy5leHBhbmRhYmxlYXJlYScpLm50aChpbmRleCk7XG5cbnNjZW5hcmlvKCdFeHBhbmRhYmxlQXJlYTogYSBjbGljayB0b2dnbGVzIHRoZSBib2R5IGFuZCB0dXJucyB0aGUgY2FyZXQnLCAnRXhwYW5kYWJsZUFyZWEnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBjbG9zZWQgPSBhcmVhKHBhZ2UsIDApO1xuXHRjb25zdCBoZWFkZXIgPSBjbG9zZWQubG9jYXRvcignLmV4cGFuZGFibGVhcmVhX19oZWFkZXInKTtcblx0Y29uc3QgYm9keSA9IGNsb3NlZC5sb2NhdG9yKCcuZXhwYW5kYWJsZWFyZWFfX2JvZHknKTtcblx0Y29uc3QgY2FyZXQgPSBjbG9zZWQubG9jYXRvcignLmV4cGFuZGFibGVhcmVhX19jYXJldCcpO1xuXHRhd2FpdCBhdHRyKGhlYWRlciwgJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcblx0YXdhaXQgc2Vlbihib2R5LCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGNhcmV0LCAndHJhbnNmb3JtJyksICdub25lJyk7XG5cdGF3YWl0IGhlYWRlci5jbGljaygpO1xuXHRhd2FpdCBhdHRyKGhlYWRlciwgJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXHRhd2FpdCBzZWVuKGJvZHksIHRydWUpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDI1MCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGNhcmV0LCAndHJhbnNmb3JtJyksICdtYXRyaXgoMCwgMSwgLTEsIDAsIDAsIDApJyk7XG5cdGF3YWl0IGhlYWRlci5jbGljaygpO1xuXHRhd2FpdCBzZWVuKGJvZHksIGZhbHNlKTtcblx0YXdhaXQgd2FpdChwYWdlLCAyNTApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChjYXJldCwgJ3RyYW5zZm9ybScpLCAnbm9uZScpO1xufSk7XG5cbnNjZW5hcmlvKCdFeHBhbmRhYmxlQXJlYTogRW50ZXIgYW5kIFNwYWNlIHRvZ2dsZSB0aGUgZm9jdXNlZCBoZWFkZXIgYW5kIGl0IHNob3dzIHRoZSBmb2N1cyByaW5nJywgJ0V4cGFuZGFibGVBcmVhJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgaGVhZGVyID0gYXJlYShwYWdlLCAxKS5sb2NhdG9yKCcuZXhwYW5kYWJsZWFyZWFfX2hlYWRlcicpO1xuXHRjb25zdCBib2R5ID0gYXJlYShwYWdlLCAxKS5sb2NhdG9yKCcuZXhwYW5kYWJsZWFyZWFfX2JvZHknKTtcblx0YXdhaXQgc2Vlbihib2R5LCB0cnVlKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdUYWInLCAnVGFiJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpc0ZvY3VzZWQoaGVhZGVyKSwgdHJ1ZSk7XG5cdGF3YWl0IGlua3MocGFnZSwgaGVhZGVyLCAnb3V0bGluZS1jb2xvcicsICdwcmltYXJ5Jyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRW50ZXInKTtcblx0YXdhaXQgc2Vlbihib2R5LCBmYWxzZSk7XG5cdGF3YWl0IGF0dHIoaGVhZGVyLCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ1NwYWNlJyk7XG5cdGF3YWl0IHNlZW4oYm9keSwgdHJ1ZSk7XG59KTtcblxuc2NlbmFyaW8oJ0V4cGFuZGFibGVBcmVhOiB0aGUgcGFuZWwga2VlcHMgaXRzIFBhbmVsIGZpbGwgYW5kIHRoZSBoZWFkZXIgaGFzIG5vIGhvdmVyIGZpbGwnLCAnRXhwYW5kYWJsZUFyZWEnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBwYW5lbCA9IGFyZWEocGFnZSwgMCk7XG5cdGNvbnN0IGhlYWRlciA9IHBhbmVsLmxvY2F0b3IoJy5leHBhbmRhYmxlYXJlYV9faGVhZGVyJyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBwYW5lbCwgJ3BhbmVsJyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgaGVhZGVyKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoaGVhZGVyKSwgQ0xFQVIpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcGFuZWwsICdwYW5lbCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKCcuZXhwYW5kYWJsZWFyZWFbZGF0YS1waW5uZWRdJykuY291bnQoKSwgMik7XG59KTtcblxuIiwgIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBTbWFsbCBwYWdlIHByb2JlcyBzaGFyZWQgYnkgdGhlIHByZXZpZXcgdGVzdHM6IGNvbXB1dGVkIHN0eWxlcywgdG9rZW5zLCBrZXlzIGFuZCB0aGUgbW91c2UuXG5pbXBvcnQgdHlwZSB7IExvY2F0b3IsIFBhZ2UgfSBmcm9tICdwbGF5d3JpZ2h0JztcblxuZXhwb3J0IGNvbnN0IENMRUFSID0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4vLyBSZXNvbHZlcyBhIGRlc2lnbiB0b2tlbiB0byB0aGUgY29sb3VyIHN0cmluZyB0aGUgYnJvd3NlciBjb21wdXRlcyBmb3IgaXQuXG5leHBvcnQgY29uc3QgdG9rZW4gPSAocGFnZTogUGFnZSwgbmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+XG5cdHBhZ2UuZXZhbHVhdGUoKG4pID0+IHtcblx0XHRjb25zdCBwcm9iZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHByb2JlLnN0eWxlLmJhY2tncm91bmQgPSAndmFyKC0tJyArIG4gKyAnKSc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmQocHJvYmUpO1xuXHRcdGNvbnN0IGNvbG91ciA9IGdldENvbXB1dGVkU3R5bGUocHJvYmUpLmJhY2tncm91bmRDb2xvcjtcblx0XHRwcm9iZS5yZW1vdmUoKTtcblx0XHRyZXR1cm4gY29sb3VyO1xuXHR9LCBuYW1lKTtcblxuZXhwb3J0IGNvbnN0IHByb3AgPSAodGFyZ2V0OiBMb2NhdG9yLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCwgbikgPT4gZ2V0Q29tcHV0ZWRTdHlsZShlbCkuZ2V0UHJvcGVydHlWYWx1ZShuKSwgbmFtZSk7XG5leHBvcnQgY29uc3QgZmlsbCA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZz4gPT4gcHJvcCh0YXJnZXQsICdiYWNrZ3JvdW5kLWNvbG9yJyk7XG5leHBvcnQgY29uc3QgaW5rID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nPiA9PiBwcm9wKHRhcmdldCwgJ2NvbG9yJyk7XG5leHBvcnQgY29uc3QgaGFzQ2xhc3MgPSAodGFyZ2V0OiBMb2NhdG9yLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwsIG4pID0+IGVsLmNsYXNzTGlzdC5jb250YWlucyhuKSwgbmFtZSk7XG5leHBvcnQgY29uc3QgdGV4dHMgPSAocGFnZTogUGFnZSwgc2VsZWN0b3I6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+ID0+IHBhZ2UuJCRldmFsKHNlbGVjdG9yLCAoZWxzKSA9PiBlbHMubWFwKChlbCkgPT4gZWwudGV4dENvbnRlbnQ/LnRyaW0oKSA/PyAnJykpO1xuZXhwb3J0IGNvbnN0IGZvY3VzZWRUZXh0ID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHN0cmluZz4gPT4gcGFnZS5ldmFsdWF0ZSgoKSA9PiBkb2N1bWVudC5hY3RpdmVFbGVtZW50Py50ZXh0Q29udGVudD8udHJpbSgpID8/ICcnKTtcbmV4cG9ydCBjb25zdCBhZnRlciA9ICh0YXJnZXQ6IExvY2F0b3IpOiBMb2NhdG9yID0+IHRhcmdldC5sb2NhdG9yKCd4cGF0aD1mb2xsb3dpbmctc2libGluZzo6KlsxXScpO1xuZXhwb3J0IGNvbnN0IHByZXNzID0gKHBhZ2U6IFBhZ2UsIGtleTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiBwYWdlLmtleWJvYXJkLnByZXNzKGtleSk7XG5leHBvcnQgY29uc3QgaG9sZCA9IChwYWdlOiBQYWdlKTogUHJvbWlzZTx2b2lkPiA9PiBwYWdlLm1vdXNlLmRvd24oKTtcbmV4cG9ydCBjb25zdCByZWxlYXNlID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UudXAoKTtcbmV4cG9ydCBjb25zdCBhd2F5ID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UubW92ZSg5MDAsIDcwMCk7XG5leHBvcnQgY29uc3QgY2xpY2tBd2F5ID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuY2xpY2soOTAwLCA3MDApO1xuIiwgIi8vIERlY2xhcmVzIG9uZSBwcmV2aWV3IHRlc3Q6IG9wZW5zIHRoZSBwcmV2aWV3LCBydW5zIHRoZSBib2R5LCB0aGVuIGFzc2VydHMgdGhlIHBhZ2UgcmFpc2VkIG5vIGVycm9ycy5cbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQvc3RyaWN0JztcbmltcG9ydCB7IHRlc3QgfSBmcm9tICdub2RlOnRlc3QnO1xuaW1wb3J0IHR5cGUgeyBQYWdlIH0gZnJvbSAncGxheXdyaWdodCc7XG5pbXBvcnQgeyBvcGVuUHJldmlldywgd2l0aEJyb3dzZXIgfSBmcm9tICcuL2xpYi50cyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzY2VuYXJpbyhuYW1lOiBzdHJpbmcsIGNvbXBvbmVudDogc3RyaW5nLCBib2R5OiAocGFnZTogUGFnZSkgPT4gUHJvbWlzZTx2b2lkPik6IHZvaWQge1xuXHR0ZXN0KG5hbWUsICgpID0+XG5cdFx0d2l0aEJyb3dzZXIoYXN5bmMgKGJyb3dzZXIpID0+IHtcblx0XHRcdGNvbnN0IHsgcGFnZSwgZXJyb3JzIH0gPSBhd2FpdCBvcGVuUHJldmlldyhicm93c2VyLCBjb21wb25lbnQpO1xuXHRcdFx0YXdhaXQgYm9keShwYWdlKTtcblx0XHRcdGFzc2VydC5kZWVwRXF1YWwoZXJyb3JzLCBbXSwgJ3RoZSBwYWdlIHJhaXNlZCBjb25zb2xlIG9yIHBhZ2UgZXJyb3JzJyk7XG5cdFx0XHRhd2FpdCBwYWdlLmNsb3NlKCk7XG5cdFx0fSksXG5cdCk7XG59XG4iLCAiLy8vIDxyZWZlcmVuY2UgbGliPVwiZG9tXCIgLz5cbi8vIFNoYXJlZCBoZWxwZXJzIGZvciB0aGUgcHJldmlldyBpbnRlcmFjdGlvbiB0ZXN0cy4gVGhlIERPTSBsaWIgdHlwZXMgdGhlIGNhbGxiYWNrcyB0aGF0IHJ1biBpbiB0aGUgcGFnZS5cbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCBodHRwIGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IGNocm9taXVtLCB0eXBlIEJyb3dzZXIsIHR5cGUgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuXG5jb25zdCBoZXJlID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG5leHBvcnQgY29uc3Qgcm9vdCA9IHBhdGgucmVzb2x2ZShoZXJlLCAnLi4nLCAnZGVzaWduLXN5c3RlbScpO1xuXG5pbnRlcmZhY2UgVG9rZW5WYWx1ZSB7IFt0aGVtZTogc3RyaW5nXTogc3RyaW5nIH1cbmludGVyZmFjZSBUb2tlbnMge1xuXHRjb2xvcjogeyB0aGVtZXM6IEFycmF5PHsgaWQ6IHN0cmluZyB9PjsgdG9rZW5zOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB8IFRva2VuVmFsdWUgfT4gfTtcblx0c3BhY2luZzogeyB0b2tlbnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0+IH07XG5cdHJhZGl1czogeyB0b2tlbnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0+IH07XG5cdHR5cGU6IHsgZmFtaWxpZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfTtcbn1cblxuLy8gQnVpbGRzIHRoZSB0b2tlbnMuY3NzIHRoYXQgdGhlIHByZXZpZXcgZnJhbWUgcHJlbG9hZHMsIGZyb20gdG9rZW5zLmpzb24gKGZpcnN0IHRoZW1lKS5cbmV4cG9ydCBmdW5jdGlvbiB0b2tlbnNDc3MoKTogc3RyaW5nIHtcblx0Y29uc3QgdG9rZW5zID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJvb3QsICd0b2tlbnMuanNvbicpLCAndXRmOCcpKSBhcyBUb2tlbnM7XG5cdGNvbnN0IHRoZW1lID0gdG9rZW5zLmNvbG9yLnRoZW1lc1swXS5pZDtcblx0Y29uc3QgdmFyczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgcmVzb2x2ZSA9ICh2YWx1ZTogc3RyaW5nIHwgVG9rZW5WYWx1ZSk6IHN0cmluZyA9PiB7XG5cdFx0Y29uc3QgcmF3ID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IHZhbHVlIDogdmFsdWVbdGhlbWVdO1xuXHRcdGNvbnN0IGFsaWFzID0gL15cXHsoLispXFx9JC8uZXhlYyhyYXcpO1xuXHRcdHJldHVybiBhbGlhcyA/ICd2YXIoLS0nICsgYWxpYXNbMV0gKyAnKScgOiByYXc7XG5cdH07XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMuY29sb3IudG9rZW5zKSB2YXJzLnB1c2goJy0tJyArIHQubmFtZSArICc6ICcgKyByZXNvbHZlKHQudmFsdWUpICsgJzsnKTtcblx0Zm9yIChjb25zdCB0IG9mIHRva2Vucy5zcGFjaW5nLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgdC52YWx1ZSArICc7Jyk7XG5cdGZvciAoY29uc3QgdCBvZiB0b2tlbnMucmFkaXVzLnRva2VucykgdmFycy5wdXNoKCctLScgKyB0Lm5hbWUgKyAnOiAnICsgdC52YWx1ZSArICc7Jyk7XG5cdGZvciAoY29uc3QgW2tleSwgc3RhY2tdIG9mIE9iamVjdC5lbnRyaWVzKHRva2Vucy50eXBlLmZhbWlsaWVzKSkgdmFycy5wdXNoKCctLWZvbnQtJyArIGtleSArICc6ICcgKyBzdGFjayArICc7Jyk7XG5cdHJldHVybiAnOnJvb3QgeyAnICsgdmFycy5qb2luKCcgJykgKyAnIH1cXG5ib2R5IHsgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZCk7IGNvbG9yOiB2YXIoLS1mb3JlZ3JvdW5kKTsgfSc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlldyB7XG5cdHBhZ2U6IFBhZ2U7XG5cdGVycm9yczogc3RyaW5nW107XG59XG5cbmNvbnN0IE1JTUU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdCcuaHRtbCc6ICd0ZXh0L2h0bWw7IGNoYXJzZXQ9dXRmLTgnLFxuXHQnLmpzJzogJ3RleHQvamF2YXNjcmlwdDsgY2hhcnNldD11dGYtOCcsXG5cdCcuY3NzJzogJ3RleHQvY3NzOyBjaGFyc2V0PXV0Zi04Jyxcblx0Jy5qc29uJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHQnLnBuZyc6ICdpbWFnZS9wbmcnLFxuXHQnLnN2Zyc6ICdpbWFnZS9zdmcreG1sJyxcbn07XG5cbmxldCBiYXNlVXJsOiBQcm9taXNlPHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cbi8vIFNlcnZlcyBkZXNpZ24tc3lzdGVtIG92ZXIgaHR0cCwgYmVjYXVzZSBDaHJvbWl1bSBibG9ja3MgbW9kdWxlIHNjcmlwdHMgb24gZmlsZTovLy4gT25lIHNlcnZlciBwZXIgcHJvY2Vzcy5cbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZSgpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRiYXNlVXJsID8/PSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Y29uc3Qgc2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIoKHJlcSwgcmVzKSA9PiB7XG5cdFx0XHRjb25zdCBmaWxlID0gcGF0aC5qb2luKHJvb3QsIGRlY29kZVVSSUNvbXBvbmVudChuZXcgVVJMKHJlcS51cmwgPz8gJy8nLCAnaHR0cDovL3gnKS5wYXRobmFtZSkpO1xuXHRcdFx0aWYgKCFmaWxlLnN0YXJ0c1dpdGgocm9vdCkgfHwgIWZzLmV4aXN0c1N5bmMoZmlsZSkgfHwgZnMuc3RhdFN5bmMoZmlsZSkuaXNEaXJlY3RvcnkoKSkge1xuXHRcdFx0XHRyZXMud3JpdGVIZWFkKDQwNCkuZW5kKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlcy53cml0ZUhlYWQoMjAwLCB7ICdjb250ZW50LXR5cGUnOiBNSU1FW3BhdGguZXh0bmFtZShmaWxlKV0gPz8gJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScgfSk7XG5cdFx0XHRmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGUpLnBpcGUocmVzKTtcblx0XHR9KTtcblx0XHRzZXJ2ZXIub24oJ2Vycm9yJywgcmVqZWN0KTtcblx0XHRzZXJ2ZXIubGlzdGVuKDAsICcxMjcuMC4wLjEnLCAoKSA9PiB7XG5cdFx0XHRzZXJ2ZXIudW5yZWYoKTtcblx0XHRcdGNvbnN0IGFkZHJlc3MgPSBzZXJ2ZXIuYWRkcmVzcygpO1xuXHRcdFx0cmVzb2x2ZSgnaHR0cDovLzEyNy4wLjAuMTonICsgKHR5cGVvZiBhZGRyZXNzID09PSAnb2JqZWN0JyAmJiBhZGRyZXNzID8gYWRkcmVzcy5wb3J0IDogMCkpO1xuXHRcdH0pO1xuXHR9KTtcblx0cmV0dXJuIGJhc2VVcmw7XG59XG5cbi8vIFRoZSBkZXNpZ24gc3lzdGVtIHBhZ2UgcHJlbG9hZHMgY29tcG9uZW50cy9idW5kbGUuanMgYXMgYSBjbGFzc2ljIHNjcmlwdCBhaGVhZCBvZiB0aGUgcHJldmlldyBtYXJrdXAuIFRlc3RzIGRvIHRoZSBzYW1lLlxuZXhwb3J0IGNvbnN0IHdpdGhCdW5kbGUgPSAoaHRtbDogc3RyaW5nKTogc3RyaW5nID0+IGh0bWwucmVwbGFjZSgnPC9oZWFkPicsICc8c2NyaXB0IHNyYz1cIi9jb21wb25lbnRzL2J1bmRsZS5qc1wiPjwvc2NyaXB0PjwvaGVhZD4nKTtcblxuLy8gT3BlbnMgYSBjb21wb25lbnQgcHJldmlldyB3aXRoIHRoZSB0b2tlbnMgaW5qZWN0ZWQuIENvbnNvbGUgYW5kIHBhZ2UgZXJyb3JzIGNvbGxlY3QgaW4gYGVycm9yc2AuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlblByZXZpZXcoYnJvd3NlcjogQnJvd3NlciwgbmFtZTogc3RyaW5nLCB2aWV3cG9ydCA9IHsgd2lkdGg6IDEwMDAsIGhlaWdodDogODAwIH0pOiBQcm9taXNlPFByZXZpZXc+IHtcblx0Y29uc3QgcGFnZSA9IGF3YWl0IGJyb3dzZXIubmV3UGFnZSh7IHZpZXdwb3J0IH0pO1xuXHRjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cdHBhZ2Uub24oJ3BhZ2VlcnJvcicsIChlKSA9PiBlcnJvcnMucHVzaChTdHJpbmcoZSkpKTtcblx0cGFnZS5vbignY29uc29sZScsIChtKSA9PiB7XG5cdFx0aWYgKG0udHlwZSgpID09PSAnZXJyb3InICYmICEvZm9udHNcXC5nfEVSUl98RmFpbGVkIHRvIGxvYWQgcmVzb3VyY2UvLnRlc3QobS50ZXh0KCkpKSBlcnJvcnMucHVzaChtLnRleHQoKSk7XG5cdH0pO1xuXHRhd2FpdCBwYWdlLnJvdXRlKCcqKi9jb21wb25lbnRzLyovcHJldmlldy5odG1sJywgYXN5bmMgKHJvdXRlKSA9PiB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCByb3V0ZS5mZXRjaCgpO1xuXHRcdGF3YWl0IHJvdXRlLmZ1bGZpbGwoeyByZXNwb25zZSwgYm9keTogd2l0aEJ1bmRsZShhd2FpdCByZXNwb25zZS50ZXh0KCkpIH0pO1xuXHR9KTtcblx0YXdhaXQgcGFnZS5nb3RvKChhd2FpdCBzZXJ2ZSgpKSArICcvY29tcG9uZW50cy8nICsgbmFtZSArICcvcHJldmlldy5odG1sJyk7XG5cdGF3YWl0IHBhZ2UuYWRkU3R5bGVUYWcoeyBjb250ZW50OiB0b2tlbnNDc3MoKSB9KTtcblx0YXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxMDApO1xuXHRyZXR1cm4geyBwYWdlLCBlcnJvcnMgfTtcbn1cblxuLy8gUnVucyBhIHRlc3QgYm9keSB3aXRoIGEgZnJlc2ggYnJvd3NlciBhbmQgYWx3YXlzIGNsb3NlcyBpdC5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoQnJvd3Nlcihib2R5OiAoYnJvd3NlcjogQnJvd3NlcikgPT4gUHJvbWlzZTx2b2lkPik6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBicm93c2VyID0gYXdhaXQgY2hyb21pdW0ubGF1bmNoKCk7XG5cdHRyeSB7XG5cdFx0YXdhaXQgYm9keShicm93c2VyKTtcblx0fSBmaW5hbGx5IHtcblx0XHRhd2FpdCBicm93c2VyLmNsb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGJhY2tncm91bmQgPSAocGFnZTogUGFnZSwgc2VsZWN0b3I6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiBwYWdlLiRldmFsKHNlbGVjdG9yLCAoZWwpID0+IGdldENvbXB1dGVkU3R5bGUoZWwpLmJhY2tncm91bmRDb2xvcik7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBRUEsT0FBT0EsYUFBWTs7O0FDRVosSUFBTSxRQUFRO0FBR2QsSUFBTSxRQUFRLENBQUMsTUFBWSxTQUNqQyxLQUFLLFNBQVMsQ0FBQyxNQUFNO0FBQ3BCLFFBQU0sUUFBUSxTQUFTLGNBQWMsS0FBSztBQUMxQyxRQUFNLE1BQU0sYUFBYSxX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
