// controls.test.ts
import assert2 from "node:assert/strict";

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
var hasClass = (target, name) => target.evaluate((el, n) => el.classList.contains(n), name);
var hold = (page) => page.mouse.down();
var release = (page) => page.mouse.up();
var away = (page) => page.mouse.move(900, 700);

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

// controls.test.ts
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
  assert2.equal(await fill(target), await token(page, name), "fill should be " + name);
}
async function inks(page, target, property, name) {
  assert2.equal(await prop(target, property), await token(page, name), property + " should be " + name);
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
  await disabled.click();
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
  await locked.click();
  await attr(locked, "aria-pressed", "false");
  assert2.equal(await prop(locked, "opacity"), "0.45");
  const lockedBox = ck(page, "Locked");
  await lockedBox.click();
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
  assert2.equal(await sbValue(box), 70, "a 40px drag on a 132px wide 0 to 100 box lands on 70 after the delta snap");
  assert2.equal(await sbText(box), "70.0");
  const width = await box.evaluate((el) => el.getBoundingClientRect().width);
  const fillWidth = await fillBar.evaluate((el) => el.getBoundingClientRect().width);
  assert2.ok(Math.abs(fillWidth - (0.7 * width - 2)) < 0.6, "fill width " + fillWidth + " of " + width);
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
  await locked.click();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY29udHJvbHMudGVzdC50cyIsICJwcm9iZS50cyIsICJzY2VuYXJpby50cyIsICJsaWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vLyA8cmVmZXJlbmNlIGxpYj1cImRvbVwiIC8+XG4vLyBJbnRlcmFjdGlvbiB0ZXN0cyBmb3IgdGhlIGNvbnRyb2xzIGdyb3VwOiBCdXR0b24sIENvbWJvQnV0dG9uLCBDaGVja2JveCwgVGV4dElucHV0LCBTcGluQm94LCBTbGlkZXIsIFRvb2x0aXAsIFBvcHVwTWVudSwgTm90aWZpY2F0aW9uLCBFeHBhbmRhYmxlQXJlYS5cbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQvc3RyaWN0JztcbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgQ0xFQVIsIHRva2VuLCBwcm9wLCBmaWxsLCBoYXNDbGFzcywgaG9sZCwgcmVsZWFzZSwgYXdheSB9IGZyb20gJy4vcHJvYmUudHMnO1xuaW1wb3J0IHsgc2NlbmFyaW8gfSBmcm9tICcuL3NjZW5hcmlvLnRzJztcblxuLy8gLS0tLS0tLS0tLSBoZWxwZXJzIGZvciB0aGlzIGZpbGUgLS0tLS0tLS0tLVxuXG5jb25zdCBzaGFkb3cgPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+IHByb3AodGFyZ2V0LCAnYm94LXNoYWRvdycpO1xuY29uc3Qgd2FpdCA9IChwYWdlOiBQYWdlLCBtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiA9PiBwYWdlLndhaXRGb3JUaW1lb3V0KG1zKTtcbmNvbnN0IHRhcCA9IChwYWdlOiBQYWdlLCAuLi5uYW1lczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+ID0+IG5hbWVzLnJlZHVjZSgoY2hhaW4sIG5hbWUpID0+IGNoYWluLnRoZW4oKCkgPT4gcGFnZS5rZXlib2FyZC5wcmVzcyhuYW1lKSksIFByb21pc2UucmVzb2x2ZSgpKTtcbmNvbnN0IGlzRm9jdXNlZCA9ICh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHRhcmdldC5ldmFsdWF0ZSgoZWwpID0+IGVsID09PSBkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcblxuLy8gQ2hlY2tzIHRoYXQgYW4gZWxlbWVudCBpcyBzaG93biBvciBoaWRkZW4uXG5hc3luYyBmdW5jdGlvbiBzZWVuKHRhcmdldDogTG9jYXRvciwgZXhwZWN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRhcmdldC5pc1Zpc2libGUoKSwgZXhwZWN0ZWQsICd2aXNpYmxlOiBleHBlY3RlZCAnICsgZXhwZWN0ZWQpO1xufVxuXG4vLyBDaGVja3Mgb25lIGF0dHJpYnV0ZSB2YWx1ZS5cbmFzeW5jIGZ1bmN0aW9uIGF0dHIodGFyZ2V0OiBMb2NhdG9yLCBuYW1lOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRhcmdldC5nZXRBdHRyaWJ1dGUobmFtZSksIGV4cGVjdGVkLCBuYW1lKTtcbn1cblxuLy8gQ2hlY2tzIHRoYXQgYSBjbGFzcyBpcyBwcmVzZW50IG9yIGFic2VudC5cbmFzeW5jIGZ1bmN0aW9uIGNscyh0YXJnZXQ6IExvY2F0b3IsIG5hbWU6IHN0cmluZywgZXhwZWN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGhhc0NsYXNzKHRhcmdldCwgbmFtZSksIGV4cGVjdGVkLCAnY2xhc3MgJyArIG5hbWUpO1xufVxuXG4vLyBDaGVja3MgdGhhdCB0aGUgZWxlbWVudCdzIGZpbGwgaXMgdGhlIG5hbWVkIHRva2VuLlxuYXN5bmMgZnVuY3Rpb24gcGFpbnRzKHBhZ2U6IFBhZ2UsIHRhcmdldDogTG9jYXRvciwgbmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKHRhcmdldCksIGF3YWl0IHRva2VuKHBhZ2UsIG5hbWUpLCAnZmlsbCBzaG91bGQgYmUgJyArIG5hbWUpO1xufVxuXG4vLyBDaGVja3MgdGhhdCBvbmUgY29tcHV0ZWQgcHJvcGVydHkgaXMgdGhlIG5hbWVkIHRva2VuIGNvbG91ci5cbmFzeW5jIGZ1bmN0aW9uIGlua3MocGFnZTogUGFnZSwgdGFyZ2V0OiBMb2NhdG9yLCBwcm9wZXJ0eTogc3RyaW5nLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AodGFyZ2V0LCBwcm9wZXJ0eSksIGF3YWl0IHRva2VuKHBhZ2UsIG5hbWUpLCBwcm9wZXJ0eSArICcgc2hvdWxkIGJlICcgKyBuYW1lKTtcbn1cblxuLy8gQ2hlY2tzIHRoYXQgdGhlIGVsZW1lbnQncyBpbnNldCBvdXRsaW5lIGlzIHBhaW50ZWQgd2l0aCB0aGUgbmFtZWQgdG9rZW4uXG5hc3luYyBmdW5jdGlvbiBvdXRsaW5lSXMocGFnZTogUGFnZSwgdGFyZ2V0OiBMb2NhdG9yLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0YXNzZXJ0Lm9rKChhd2FpdCBzaGFkb3codGFyZ2V0KSkuc3RhcnRzV2l0aChhd2FpdCB0b2tlbihwYWdlLCBuYW1lKSksICdvdXRsaW5lICcgKyAoYXdhaXQgc2hhZG93KHRhcmdldCkpICsgJyBzaG91bGQgc3RhcnQgd2l0aCAnICsgbmFtZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNlbnRyZSh0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfT4ge1xuXHRjb25zdCBib3ggPSBhd2FpdCB0YXJnZXQuYm91bmRpbmdCb3goKTtcblx0YXNzZXJ0Lm9rKGJveCwgJ2JvdW5kaW5nIGJveCcpO1xuXHRyZXR1cm4geyB4OiBib3gueCArIGJveC53aWR0aCAvIDIsIHk6IGJveC55ICsgYm94LmhlaWdodCAvIDIgfTtcbn1cblxuLy8gTW92ZXMgdGhlIHBvaW50ZXIgb250byB0aGUgZWxlbWVudCBhbmQgcmV0dXJucyB3aGVyZSBpdCB3ZW50LlxuYXN5bmMgZnVuY3Rpb24gcG9pbnRBdChwYWdlOiBQYWdlLCB0YXJnZXQ6IExvY2F0b3IpOiBQcm9taXNlPHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfT4ge1xuXHRjb25zdCBjID0gYXdhaXQgY2VudHJlKHRhcmdldCk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZShjLngsIGMueSk7XG5cdHJldHVybiBjO1xufVxuXG4vLyAtLS0tLS0tLS0tIEJ1dHRvbiAtLS0tLS0tLS0tXG5cbmNvbnN0IEJUTiA9ICd1ZS1idXR0b24gLmJ1dHRvbic7XG5cbnNjZW5hcmlvKCdCdXR0b246IGhvdmVyIGZpbGxzIEhvdmVyLCBwcmltYXJ5IGhvdmVycyB0byBQcmltYXJ5SG92ZXIsIHNpbXBsZSBob3ZlcnMgdG8gRHJvcGRvd24nLCAnQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgcGxhaW4gPSBwYWdlLmxvY2F0b3IoQlROKS5udGgoMCk7XG5cdGNvbnN0IHByaW1hcnkgPSBwYWdlLmxvY2F0b3IoQlROKS5udGgoMSk7XG5cdGNvbnN0IHNpbXBsZSA9IHBhZ2UubG9jYXRvcihCVE4pLm50aCgzKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHBsYWluLCAnc2Vjb25kYXJ5Jyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgcGxhaW4pO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcGxhaW4sICdob3ZlcicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChwbGFpbiksIGF3YWl0IGZpbGwocGFnZS5sb2NhdG9yKCcuYnV0dG9uLS1ob3ZlcicpLmZpcnN0KCkpKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBwcmltYXJ5KTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHByaW1hcnksICdwcmltYXJ5LWhvdmVyJyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgc2ltcGxlKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHNpbXBsZSwgJ2Ryb3Bkb3duJyk7XG5cdGF3YWl0IGlua3MocGFnZSwgc2ltcGxlLCAnY29sb3InLCAnZm9yZWdyb3VuZC1ob3ZlcicpO1xufSk7XG5cbnNjZW5hcmlvKCdCdXR0b246IHRoZSBtb3VzZSBwcmVzcyB1c2VzIHRoZSBwcmVzc2VkIGZpbGwgYW5kIGRyb3BzIHRoZSBsYWJlbCAxcHgnLCAnQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgcGxhaW4gPSBwYWdlLmxvY2F0b3IoQlROKS5udGgoMCk7XG5cdGNvbnN0IHByaW1hcnkgPSBwYWdlLmxvY2F0b3IoQlROKS5udGgoMSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKHBsYWluLCAncGFkZGluZy10b3AnKSwgJzMuNXB4Jyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgcGxhaW4pO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcGxhaW4sICdoZWFkZXInKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AocGxhaW4sICdwYWRkaW5nLXRvcCcpLCAnNC41cHgnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AocGxhaW4sICdwYWRkaW5nLWJvdHRvbScpLCAnMi41cHgnKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AocGxhaW4sICdwYWRkaW5nLXRvcCcpLCAnMy41cHgnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBwcmltYXJ5KTtcblx0YXdhaXQgaG9sZChwYWdlKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHByaW1hcnksICdwcmltYXJ5LXByZXNzJyk7XG5cdGF3YWl0IHJlbGVhc2UocGFnZSk7XG59KTtcblxuc2NlbmFyaW8oJ0J1dHRvbjogY2xpY2tzIHJlZ2lzdGVyIGluIHRoZSBjb3VudGVyLCBhIGRpc2FibGVkIGJ1dHRvbiBkb2VzIG5vdCBjb3VudCcsICdCdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBjb3VudGVyID0gcGFnZS5sb2NhdG9yKCd1ZS1idXR0b24gLmJ1dHRvbi1jb3VudCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY291bnRlci50ZXh0Q29udGVudCgpLCAnQ2xpY2tzOiAwJyk7XG5cdGF3YWl0IHBhZ2UubG9jYXRvcihCVE4pLm50aCgwKS5jbGljaygpO1xuXHRhd2FpdCBwYWdlLmxvY2F0b3IoQlROKS5udGgoMSkuY2xpY2soKTtcblx0YXdhaXQgcGFnZS5sb2NhdG9yKEJUTikubnRoKDQpLmNsaWNrKCk7XG5cdGFzc2VydC5tYXRjaCgoYXdhaXQgY291bnRlci50ZXh0Q29udGVudCgpKSA/PyAnJywgL15DbGlja3M6IDMgXFwobGFzdDogU2V0dGluZ3NcXCkvKTtcblx0Y29uc3QgZGlzYWJsZWQgPSBwYWdlLmxvY2F0b3IoQlROKS5udGgoNSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBkaXNhYmxlZC5pc0Rpc2FibGVkKCksIHRydWUpO1xuXHRhd2FpdCBkaXNhYmxlZC5jbGljayh7IGZvcmNlOiB0cnVlIH0pO1xuXHRhc3NlcnQubWF0Y2goKGF3YWl0IGNvdW50ZXIudGV4dENvbnRlbnQoKSkgPz8gJycsIC9eQ2xpY2tzOiAzLyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGRpc2FibGVkLCAnb3BhY2l0eScpLCAnMC40NScpO1xufSk7XG5cbnNjZW5hcmlvKCdCdXR0b246IFNwYWNlIGFuZCBFbnRlciBwcmVzcyB0aGUgZm9jdXNlZCBidXR0b24sIHdpdGggdGhlIHByZXNzZWQgbG9vayB3aGlsZSBoZWxkJywgJ0J1dHRvbicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGNvdW50ZXIgPSBwYWdlLmxvY2F0b3IoJ3VlLWJ1dHRvbiAuYnV0dG9uLWNvdW50Jyk7XG5cdGNvbnN0IHBsYWluID0gcGFnZS5sb2NhdG9yKEJUTikubnRoKDApO1xuXHRhd2FpdCBwbGFpbi5mb2N1cygpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLmRvd24oJyAnKTtcblx0YXdhaXQgY2xzKHBsYWluLCAnYnV0dG9uLS1wcmVzc2VkJywgdHJ1ZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBwbGFpbiwgJ2hlYWRlcicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChwbGFpbiwgJ3BhZGRpbmctdG9wJyksICc0LjVweCcpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnVwKCcgJyk7XG5cdGF3YWl0IGNscyhwbGFpbiwgJ2J1dHRvbi0tcHJlc3NlZCcsIGZhbHNlKTtcblx0YXNzZXJ0Lm1hdGNoKChhd2FpdCBjb3VudGVyLnRleHRDb250ZW50KCkpID8/ICcnLCAvXkNsaWNrczogMS8pO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGFzc2VydC5tYXRjaCgoYXdhaXQgY291bnRlci50ZXh0Q29udGVudCgpKSA/PyAnJywgL15DbGlja3M6IDIvKTtcbn0pO1xuXG5zY2VuYXJpbygnQnV0dG9uOiBUYWIgc2hvd3MgdGhlIFByaW1hcnkgZm9jdXMgcmluZycsICdCdXR0b24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRhd2FpdCB0YXAocGFnZSwgJ1RhYicpO1xuXHRjb25zdCBmaXJzdCA9IHBhZ2UubG9jYXRvcihCVE4pLm50aCgwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGlzRm9jdXNlZChmaXJzdCksIHRydWUpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgZmlyc3QsICdwcmltYXJ5Jyk7XG59KTtcblxuc2NlbmFyaW8oJ0J1dHRvbjogcGlubmVkIHNwZWNpbWVucyBpZ25vcmUgdGhlIHBvaW50ZXIgYW5kIHNpdCBvdXRzaWRlIHRoZSBlbGVtZW50JywgJ0J1dHRvbicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHBpbm5lZCA9IHBhZ2UubG9jYXRvcignLmJ1dHRvbi0taG92ZXJbZGF0YS1waW5uZWRdJykuZmlyc3QoKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AocGlubmVkLCAncG9pbnRlci1ldmVudHMnKSwgJ25vbmUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBpbm5lZC5ldmFsdWF0ZSgoZWwpID0+IGVsLmNsb3Nlc3QoJ3VlLWJ1dHRvbicpKSwgbnVsbCk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBwaW5uZWQsICdob3ZlcicpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gQ29tYm9CdXR0b24gLS0tLS0tLS0tLVxuXG5jb25zdCBDQiA9ICd1ZS1jb21iby1idXR0b24gJztcbmNvbnN0IGNiVHJpZ2dlciA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoQ0IgKyAnLmNvbWJvYnV0dG9uLWFuY2hvcicpLm50aChpbmRleCkubG9jYXRvcignLmNvbWJvYnV0dG9uJyk7XG5jb25zdCBjYk1lbnUgPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKENCICsgJy5jb21ib2J1dHRvbi1hbmNob3InKS5udGgoaW5kZXgpLmxvY2F0b3IoJy5jb21ib2J1dHRvbi1tZW51Jyk7XG5jb25zdCBjYkxhYmVsID0gKHRyaWdnZXI6IExvY2F0b3IpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+ID0+IHRyaWdnZXIubG9jYXRvcignLmNvbWJvYnV0dG9uX19sYWJlbCcpLnRleHRDb250ZW50KCk7XG5cbnNjZW5hcmlvKCdDb21ib0J1dHRvbjogYSBjbGljayBvcGVucyB0aGUgcG9wdXAgd2l0aCB0aGUgb3BlbiBsb29rLCBjaG9vc2luZyBzZXRzIHRoZSBsYWJlbCBhbmQgY2xvc2VzJywgJ0NvbWJvQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgdHJpZ2dlciA9IGNiVHJpZ2dlcihwYWdlLCAwKTtcblx0Y29uc3QgbWVudSA9IGNiTWVudShwYWdlLCAwKTtcblx0YXdhaXQgc2VlbihtZW51LCBmYWxzZSk7XG5cdGF3YWl0IHRyaWdnZXIuY2xpY2soKTtcblx0YXdhaXQgc2VlbihtZW51LCB0cnVlKTtcblx0YXdhaXQgYXR0cih0cmlnZ2VyLCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG5cdGF3YWl0IGNscyh0cmlnZ2VyLCAnY29tYm9idXR0b24tLW9wZW4nLCB0cnVlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AodHJpZ2dlciwgJ3BhZGRpbmctdG9wJyksICcycHgnKTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIHRyaWdnZXIsICdob3ZlcicpO1xuXHRhd2FpdCBtZW51LmxvY2F0b3IoJy5jb21ib2J1dHRvbi1yb3ctaXRlbScpLm50aCgyKS5jbGljaygpO1xuXHRhd2FpdCBzZWVuKG1lbnUsIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGNiTGFiZWwodHJpZ2dlciksICdTY2FsZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKENCICsgJy5jb21ib2J1dHRvbi1zdGF0dXMnKS50ZXh0Q29udGVudCgpLCAnUGlja2VkOiBTY2FsZScpO1xuXHRhd2FpdCBhdHRyKHRyaWdnZXIsICdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKHRyaWdnZXIsICdwYWRkaW5nLXRvcCcpLCAnMXB4Jyk7XG59KTtcblxuc2NlbmFyaW8oJ0NvbWJvQnV0dG9uOiBob3ZlcmluZyBhIHJvdyBmaWxscyBpdCB3aXRoIFByaW1hcnksIGhvdmVyaW5nIHRoZSBidXR0b24gbGlnaHRzIGl0cyBvdXRsaW5lJywgJ0NvbWJvQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgdHJpZ2dlciA9IGNiVHJpZ2dlcihwYWdlLCAwKTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIHRyaWdnZXIsICdpbnB1dC1vdXRsaW5lJyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgdHJpZ2dlcik7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCB0cmlnZ2VyLCAnaG92ZXInKTtcblx0YXdhaXQgdHJpZ2dlci5jbGljaygpO1xuXHRjb25zdCByb3dzID0gY2JNZW51KHBhZ2UsIDApLmxvY2F0b3IoJy5jb21ib2J1dHRvbi1yb3ctaXRlbScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChyb3dzLm50aCgxKSksIENMRUFSKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCByb3dzLm50aCgxKSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCByb3dzLm50aCgxKSwgJ3ByaW1hcnknKTtcblx0YXdhaXQgY2xzKHJvd3MubnRoKDEpLCAnY29tYm9idXR0b24tcm93LWl0ZW0tLWhvdmVyJywgdHJ1ZSk7XG59KTtcblxuc2NlbmFyaW8oJ0NvbWJvQnV0dG9uOiB0aGUga2V5Ym9hcmQgb3BlbnMgd2l0aCBEb3duLCBhcnJvd3MgbW92ZSwgRW50ZXIgcGlja3MsIEVzY2FwZSBjYW5jZWxzJywgJ0NvbWJvQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgdHJpZ2dlciA9IGNiVHJpZ2dlcihwYWdlLCAwKTtcblx0Y29uc3QgbWVudSA9IGNiTWVudShwYWdlLCAwKTtcblx0Y29uc3Qgcm93cyA9IG1lbnUubG9jYXRvcignLmNvbWJvYnV0dG9uLXJvdy1pdGVtJyk7XG5cdGF3YWl0IHRyaWdnZXIuZm9jdXMoKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0YXdhaXQgc2VlbihtZW51LCB0cnVlKTtcblx0YXdhaXQgY2xzKHJvd3MubnRoKDApLCAnY29tYm9idXR0b24tcm93LWl0ZW0tLWhvdmVyJywgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJywgJ0Fycm93RG93bicpO1xuXHRhd2FpdCBjbHMocm93cy5udGgoMiksICdjb21ib2J1dHRvbi1yb3ctaXRlbS0taG92ZXInLCB0cnVlKTtcblx0YXdhaXQgY2xzKHJvd3MubnRoKDIpLCAnY29tYm9idXR0b24tcm93LWl0ZW0tLWZvY3VzJywgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJyk7XG5cdGF3YWl0IGNscyhyb3dzLm50aCgwKSwgJ2NvbWJvYnV0dG9uLXJvdy1pdGVtLS1ob3ZlcicsIHRydWUpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93VXAnLCAnRW50ZXInKTtcblx0YXdhaXQgc2VlbihtZW51LCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjYkxhYmVsKHRyaWdnZXIpLCAnU2NhbGUnKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbnRlcicpO1xuXHRhd2FpdCBzZWVuKG1lbnUsIHRydWUpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0hvbWUnLCAnRXNjYXBlJyk7XG5cdGF3YWl0IHNlZW4obWVudSwgZmFsc2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY2JMYWJlbCh0cmlnZ2VyKSwgJ1NjYWxlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBpc0ZvY3VzZWQodHJpZ2dlciksIHRydWUpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ1NwYWNlJyk7XG5cdGF3YWl0IHNlZW4obWVudSwgdHJ1ZSk7XG5cdGF3YWl0IGNscyhyb3dzLm50aCgyKSwgJ2NvbWJvYnV0dG9uLXJvdy1pdGVtLS1ob3ZlcicsIHRydWUpO1xufSk7XG5cbnNjZW5hcmlvKCdDb21ib0J1dHRvbjogYW4gb3V0c2lkZSBjbGljayBjbG9zZXMgdGhlIHBvcHVwIGFuZCBvcGVuaW5nIG9uZSBjbG9zZXMgdGhlIG90aGVyJywgJ0NvbWJvQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXdhaXQgY2JUcmlnZ2VyKHBhZ2UsIDApLmNsaWNrKCk7XG5cdGF3YWl0IHNlZW4oY2JNZW51KHBhZ2UsIDApLCB0cnVlKTtcblx0YXdhaXQgY2JUcmlnZ2VyKHBhZ2UsIDEpLmNsaWNrKCk7XG5cdGF3YWl0IHNlZW4oY2JNZW51KHBhZ2UsIDApLCBmYWxzZSk7XG5cdGF3YWl0IHNlZW4oY2JNZW51KHBhZ2UsIDEpLCB0cnVlKTtcblx0YXdhaXQgcGFnZS5tb3VzZS5jbGljayg3MDAsIDE1MCk7XG5cdGF3YWl0IHNlZW4oY2JNZW51KHBhZ2UsIDEpLCBmYWxzZSk7XG59KTtcblxuc2NlbmFyaW8oJ0NvbWJvQnV0dG9uOiB0aGUgc2ltcGxlIHZhcmlhbnQga2VlcHMgaXRzIGxhYmVsLCBhIGRpc2FibGVkIG9uZSBkb2VzIG5vdCBvcGVuJywgJ0NvbWJvQnV0dG9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3Qgc2ltcGxlID0gY2JUcmlnZ2VyKHBhZ2UsIDEpO1xuXHRhd2FpdCBzaW1wbGUuY2xpY2soKTtcblx0YXdhaXQgY2JNZW51KHBhZ2UsIDEpLmxvY2F0b3IoJy5jb21ib2J1dHRvbi1yb3ctaXRlbScpLm50aCgxKS5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY2JMYWJlbChzaW1wbGUpLCAnU2V0dGluZ3MnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihDQiArICcuY29tYm9idXR0b24tc3RhdHVzJykudGV4dENvbnRlbnQoKSwgJ1BpY2tlZDogUHJvamVjdCBTZXR0aW5ncycpO1xuXHRjb25zdCBkaXNhYmxlZCA9IHBhZ2UubG9jYXRvcihDQiArICcuY29tYm9idXR0b25bYXJpYS1kaXNhYmxlZD1cInRydWVcIl0nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AoZGlzYWJsZWQsICdvcGFjaXR5JyksICcwLjQ1Jyk7XG5cdGF3YWl0IGRpc2FibGVkLmNsaWNrKCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoQ0IgKyAnLmNvbWJvYnV0dG9uLW1lbnU6bm90KFtoaWRkZW5dKScpLmNvdW50KCksIDApO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gQ2hlY2tib3ggLS0tLS0tLS0tLVxuXG5jb25zdCBDSyA9ICd1ZS1jaGVja2JveCAnO1xuY29uc3QgY2sgPSAocGFnZTogUGFnZSwgbGFiZWw6IHN0cmluZyk6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKENLICsgJ1tkYXRhLWxhYmVsPVwiJyArIGxhYmVsICsgJ1wiXScpO1xuXG5zY2VuYXJpbygnQ2hlY2tib3g6IGEgY2xpY2sgdG9nZ2xlcyBhbmQgdGhlIGdseXBoIGZvbGxvd3MgdGhlIHN0YXRlJywgJ0NoZWNrYm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgYm94ID0gY2socGFnZSwgJ1NpbXVsYXRlIFBoeXNpY3MnKTtcblx0Y29uc3QgZ2x5cGggPSBib3gubG9jYXRvcignLmNoZWNrYm94X19nbHlwaC0tY2hlY2snKTtcblx0YXdhaXQgYXR0cihib3gsICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnKTtcblx0YXdhaXQgc2VlbihnbHlwaCwgZmFsc2UpO1xuXHRhd2FpdCBib3guY2xpY2soKTtcblx0YXdhaXQgYXR0cihib3gsICdhcmlhLWNoZWNrZWQnLCAndHJ1ZScpO1xuXHRhd2FpdCBzZWVuKGdseXBoLCB0cnVlKTtcblx0YXdhaXQgc2Vlbihib3gubG9jYXRvcignLmNoZWNrYm94X19nbHlwaC0tbWl4ZWQnKSwgZmFsc2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcGFnZS5sb2NhdG9yKENLICsgJy5jaGVja2JveC1zdGF0dXMnKS50ZXh0Q29udGVudCgpLCAnTGFzdCBjaGFuZ2U6IFNpbXVsYXRlIFBoeXNpY3MgaXMgY2hlY2tlZCcpO1xuXHRhd2FpdCBib3guY2xpY2soKTtcblx0YXdhaXQgYXR0cihib3gsICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnKTtcbn0pO1xuXG5zY2VuYXJpbygnQ2hlY2tib3g6IFNwYWNlIGFuZCBFbnRlciB0b2dnbGUgdGhlIGZvY3VzZWQgYm94LCB3aXRoIHRoZSBwcmVzc2VkIGNsYXNzIHdoaWxlIGhlbGQnLCAnQ2hlY2tib3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBjayhwYWdlLCAnRW5hYmxlIEdyYXZpdHknKTtcblx0YXdhaXQgYm94LmZvY3VzKCk7XG5cdGF3YWl0IGF0dHIoYm94LCAnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcblx0YXdhaXQgcGFnZS5rZXlib2FyZC5kb3duKCcgJyk7XG5cdGF3YWl0IGNscyhib3gsICdjaGVja2JveC0tcHJlc3NlZCcsIHRydWUpO1xuXHRhd2FpdCBhdHRyKGJveCwgJ2FyaWEtY2hlY2tlZCcsICd0cnVlJyk7XG5cdGF3YWl0IHBhZ2Uua2V5Ym9hcmQudXAoJyAnKTtcblx0YXdhaXQgYXR0cihib3gsICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbnRlcicpO1xuXHRhd2FpdCBhdHRyKGJveCwgJ2FyaWEtY2hlY2tlZCcsICd0cnVlJyk7XG59KTtcblxuc2NlbmFyaW8oJ0NoZWNrYm94OiB0aGUgdHJpLXN0YXRlIGJveCBjeWNsZXMgdW5jaGVja2VkLCBjaGVja2VkLCB1bmRldGVybWluZWQnLCAnQ2hlY2tib3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBjayhwYWdlLCAnU2hvdyBBbGwnKTtcblx0Y29uc3Qgc3RhdGVzOiBBcnJheTxzdHJpbmcgfCBudWxsPiA9IFthd2FpdCBib3guZ2V0QXR0cmlidXRlKCdhcmlhLWNoZWNrZWQnKV07XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKSB7XG5cdFx0YXdhaXQgYm94LmNsaWNrKCk7XG5cdFx0c3RhdGVzLnB1c2goYXdhaXQgYm94LmdldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJykpO1xuXHR9XG5cdGFzc2VydC5kZWVwRXF1YWwoc3RhdGVzLCBbJ21peGVkJywgJ2ZhbHNlJywgJ3RydWUnLCAnbWl4ZWQnLCAnZmFsc2UnXSk7XG5cdGF3YWl0IGJveC5jbGljaygpO1xuXHRhd2FpdCBib3guY2xpY2soKTtcblx0YXdhaXQgc2Vlbihib3gubG9jYXRvcignLmNoZWNrYm94X19nbHlwaC0tbWl4ZWQnKSwgdHJ1ZSk7XG5cdGF3YWl0IHNlZW4oYm94LmxvY2F0b3IoJy5jaGVja2JveF9fZ2x5cGgtLWNoZWNrJyksIGZhbHNlKTtcbn0pO1xuXG5zY2VuYXJpbygnQ2hlY2tib3g6IGhvdmVyIGFuZCBwcmVzcyBvdXRsaW5lIHRoZSBib3ggd2l0aCBIb3ZlciBhbmQgdGludCB0aGUgZ2x5cGggUHJpbWFyeUhvdmVyIHRoZW4gUHJpbWFyeVByZXNzJywgJ0NoZWNrYm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgYm94ID0gY2socGFnZSwgJ0VuYWJsZSBHcmF2aXR5Jyk7XG5cdGNvbnN0IHNxdWFyZSA9IGJveC5sb2NhdG9yKCcuY2hlY2tib3hfX2JveCcpO1xuXHRjb25zdCBnbHlwaCA9IGJveC5sb2NhdG9yKCcuY2hlY2tib3hfX2dseXBoLS1jaGVjaycpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgc3F1YXJlLCAnc2Vjb25kYXJ5Jyk7XG5cdGF3YWl0IGlua3MocGFnZSwgZ2x5cGgsICdzdHJva2UnLCAncHJpbWFyeScpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIGJveCk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCBzcXVhcmUsICdob3ZlcicpO1xuXHRhd2FpdCBpbmtzKHBhZ2UsIGdseXBoLCAnc3Ryb2tlJywgJ3ByaW1hcnktaG92ZXInKTtcblx0YXdhaXQgaG9sZChwYWdlKTtcblx0YXdhaXQgaW5rcyhwYWdlLCBnbHlwaCwgJ3N0cm9rZScsICdwcmltYXJ5LXByZXNzJyk7XG5cdGF3YWl0IHJlbGVhc2UocGFnZSk7XG59KTtcblxuc2NlbmFyaW8oJ0NoZWNrYm94OiB0aGUgdG9nZ2xlLWJ1dHRvbiBjaGVja2JveCB0b2dnbGVzIGl0cyBmaWxsIGFuZCBoYXMgaG92ZXIsIHByZXNzZWQgYW5kIGRpc2FibGVkIGxvb2tzJywgJ0NoZWNrYm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3Qgb2ZmID0gY2socGFnZSwgJ1BoeXNpY3MnKTtcblx0Y29uc3Qgb24gPSBjayhwYWdlLCAnQ29sbGlzaW9uJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKG9mZiksIENMRUFSKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBvZmYpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgb2ZmLCAnZHJvcGRvd24nKTtcblx0YXdhaXQgb2ZmLmNsaWNrKCk7XG5cdGF3YWl0IGF0dHIob2ZmLCAnYXJpYS1wcmVzc2VkJywgJ3RydWUnKTtcblx0YXdhaXQgY2xzKG9mZiwgJ2NoZWNrYm94LXRvZ2dsZS0tY2hlY2tlZCcsIHRydWUpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgb2ZmLCAncHJpbWFyeS1ob3ZlcicpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgb2ZmLCAncHJpbWFyeScpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIG9uKTtcblx0YXdhaXQgaG9sZChwYWdlKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIG9uLCAnZHJvcGRvd24nKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0YXdhaXQgYXR0cihvbiwgJ2FyaWEtcHJlc3NlZCcsICdmYWxzZScpO1xuXHRjb25zdCBsb2NrZWQgPSBjayhwYWdlLCAnTG9ja2VkIHRvZ2dsZScpO1xuXHRhd2FpdCBsb2NrZWQuY2xpY2soKTtcblx0YXdhaXQgYXR0cihsb2NrZWQsICdhcmlhLXByZXNzZWQnLCAnZmFsc2UnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AobG9ja2VkLCAnb3BhY2l0eScpLCAnMC40NScpO1xuXHRjb25zdCBsb2NrZWRCb3ggPSBjayhwYWdlLCAnTG9ja2VkJyk7XG5cdGF3YWl0IGxvY2tlZEJveC5jbGljaygpO1xuXHRhd2FpdCBhdHRyKGxvY2tlZEJveCwgJ2FyaWEtY2hlY2tlZCcsICd0cnVlJyk7XG59KTtcblxuc2NlbmFyaW8oJ0NoZWNrYm94OiBUYWIgc2hvd3MgdGhlIFByaW1hcnkgZm9jdXMgcmluZycsICdDaGVja2JveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGF3YWl0IHRhcChwYWdlLCAnVGFiJyk7XG5cdGNvbnN0IGZpcnN0ID0gY2socGFnZSwgJ1NpbXVsYXRlIFBoeXNpY3MnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGlzRm9jdXNlZChmaXJzdCksIHRydWUpO1xuXHRhd2FpdCBpbmtzKHBhZ2UsIGZpcnN0LCAnb3V0bGluZS1jb2xvcicsICdwcmltYXJ5Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGZpcnN0LCAnb3V0bGluZS1zdHlsZScpLCAnc29saWQnKTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tIFRleHRJbnB1dCAtLS0tLS0tLS0tXG5cbmNvbnN0IFRJID0gJ3VlLXRleHQtaW5wdXQgJztcbmNvbnN0IHRpQm94ID0gKHBhZ2U6IFBhZ2UsIGluZGV4OiBudW1iZXIpOiBMb2NhdG9yID0+IHBhZ2UubG9jYXRvcihUSSArICcudGV4dGlucHV0JykubnRoKGluZGV4KTtcblxuc2NlbmFyaW8oJ1RleHRJbnB1dDogaG92ZXIgbGlnaHRzIHRoZSBvdXRsaW5lLCBmb2N1cyB0dXJucyBpdCBQcmltYXJ5IHdpdGggd2hpdGUgdGV4dCcsICdUZXh0SW5wdXQnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSB0aUJveChwYWdlLCAxKTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIGJveCwgJ2lucHV0LW91dGxpbmUnKTtcblx0YXdhaXQgaW5rcyhwYWdlLCBib3gsICdjb2xvcicsICdmb3JlZ3JvdW5kJyk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgYm94KTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIGJveCwgJ2hvdmVyJyk7XG5cdGF3YWl0IGJveC5sb2NhdG9yKCdpbnB1dCcpLmNsaWNrKCk7XG5cdGF3YWl0IGF3YXkocGFnZSk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCBib3gsICdwcmltYXJ5Jyk7XG5cdGF3YWl0IGlua3MocGFnZSwgYm94LCAnY29sb3InLCAnZm9yZWdyb3VuZC1ob3ZlcicpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgYm94LCAnaW5wdXQnKTtcbn0pO1xuXG5zY2VuYXJpbygnVGV4dElucHV0OiB0eXBpbmcgZWRpdHMgdGhlIGZpZWxkIGFuZCB0aGUgaGludCBzaG93cyBvbmx5IHdoaWxlIGl0IGlzIGVtcHR5JywgJ1RleHRJbnB1dCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGZpZWxkID0gdGlCb3gocGFnZSwgMCkubG9jYXRvcignaW5wdXQnKTtcblx0YXdhaXQgYXR0cihmaWVsZCwgJ3BsYWNlaG9sZGVyJywgJ0VudGVyIGEgbmFtZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmllbGQuZXZhbHVhdGUoKGVsKSA9PiBlbC5tYXRjaGVzKCc6cGxhY2Vob2xkZXItc2hvd24nKSksIHRydWUpO1xuXHRhd2FpdCBmaWVsZC5jbGljaygpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJ0NoYWlyMDEnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpZWxkLmlucHV0VmFsdWUoKSwgJ0NoYWlyMDEnKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdCYWNrc3BhY2UnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpZWxkLmlucHV0VmFsdWUoKSwgJ0NoYWlyMCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmllbGQuZXZhbHVhdGUoKGVsKSA9PiBlbC5tYXRjaGVzKCc6cGxhY2Vob2xkZXItc2hvd24nKSksIGZhbHNlKTtcbn0pO1xuXG5zY2VuYXJpbygnVGV4dElucHV0OiB0aGUgcmVhZC1vbmx5IGJveCB0YWtlcyBmb2N1cyBidXQgY2Fubm90IGJlIGVkaXRlZCBhbmQga2VlcHMgaXRzIEhlYWRlciBmaWxsJywgJ1RleHRJbnB1dCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHRpQm94KHBhZ2UsIDIpO1xuXHRjb25zdCBmaWVsZCA9IGJveC5sb2NhdG9yKCdpbnB1dCcpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgYm94LCAnaGVhZGVyJyk7XG5cdGF3YWl0IGZpZWxkLmNsaWNrKCk7XG5cdGF3YWl0IHBhZ2Uua2V5Ym9hcmQudHlwZSgneHl6Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWVsZC5pbnB1dFZhbHVlKCksICdTdGF0aWNNZXNoQWN0b3InKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIGJveCwgJ2hlYWRlcicpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgYm94LCAnaW5wdXQtb3V0bGluZScpO1xufSk7XG5cbnNjZW5hcmlvKCdUZXh0SW5wdXQ6IHRoZSBzZWFyY2ggYm94IHN3YXBzIHRoZSBnbGFzcyBmb3IgYSBjbGVhciBidXR0b24gb25jZSBpdCBoYXMgdGV4dCcsICdUZXh0SW5wdXQnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSB0aUJveChwYWdlLCAzKTtcblx0Y29uc3QgZmllbGQgPSBib3gubG9jYXRvcignaW5wdXQnKTtcblx0Y29uc3QgZ2xhc3MgPSBib3gubG9jYXRvcignLnRleHRpbnB1dF9fZ2xhc3MnKTtcblx0Y29uc3QgY2xlYXIgPSBib3gubG9jYXRvcignLnRleHRpbnB1dF9fY2xlYXInKTtcblx0YXdhaXQgc2VlbihnbGFzcywgdHJ1ZSk7XG5cdGF3YWl0IHNlZW4oY2xlYXIsIGZhbHNlKTtcblx0YXdhaXQgZmllbGQuY2xpY2soKTtcblx0YXdhaXQgcGFnZS5rZXlib2FyZC50eXBlKCdjaGFpcicpO1xuXHRhd2FpdCBzZWVuKGdsYXNzLCBmYWxzZSk7XG5cdGF3YWl0IHNlZW4oY2xlYXIsIHRydWUpO1xuXHRhd2FpdCBjbGVhci5jbGljaygpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmllbGQuaW5wdXRWYWx1ZSgpLCAnJyk7XG5cdGF3YWl0IHNlZW4oZ2xhc3MsIHRydWUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgaXNGb2N1c2VkKGZpZWxkKSwgdHJ1ZSk7XG59KTtcblxuc2NlbmFyaW8oJ1RleHRJbnB1dDogRXNjYXBlIGNsZWFycyB0aGUgc2VhcmNoIGJveCcsICdUZXh0SW5wdXQnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSB0aUJveChwYWdlLCAzKTtcblx0Y29uc3QgZmllbGQgPSBib3gubG9jYXRvcignaW5wdXQnKTtcblx0YXdhaXQgZmllbGQuY2xpY2soKTtcblx0YXdhaXQgcGFnZS5rZXlib2FyZC50eXBlKCdsYW1wJyk7XG5cdGF3YWl0IGNscyhib3gsICd0ZXh0aW5wdXQtLWZpbGxlZCcsIHRydWUpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VzY2FwZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmllbGQuaW5wdXRWYWx1ZSgpLCAnJyk7XG5cdGF3YWl0IGNscyhib3gsICd0ZXh0aW5wdXQtLWZpbGxlZCcsIGZhbHNlKTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tIFNwaW5Cb3ggLS0tLS0tLS0tLVxuXG5jb25zdCBTQiA9ICd1ZS1zcGluLWJveCAnO1xuY29uc3Qgc2JCb3ggPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKFNCICsgJy5zcGluYm94JykubnRoKGluZGV4KTtcbmNvbnN0IHNiVmFsdWUgPSBhc3luYyAoYm94OiBMb2NhdG9yKTogUHJvbWlzZTxudW1iZXI+ID0+IE51bWJlcihhd2FpdCBib3guZ2V0QXR0cmlidXRlKCdhcmlhLXZhbHVlbm93JykpO1xuY29uc3Qgc2JUZXh0ID0gYXN5bmMgKGJveDogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nPiA9PiAoKGF3YWl0IGJveC5sb2NhdG9yKCcuc3BpbmJveF9fdGV4dCcpLnRleHRDb250ZW50KCkpID8/ICcnKS50cmltKCk7XG5cbi8vIFByZXNzZXMgb24gdGhlIGJveCwgbW92ZXMgc2lkZXdheXMgYW5kIG9wdGlvbmFsbHkga2VlcHMgdGhlIGJ1dHRvbiBkb3duLlxuYXN5bmMgZnVuY3Rpb24gZHJhZ0J5KHBhZ2U6IFBhZ2UsIGJveDogTG9jYXRvciwgZHg6IG51bWJlciwga2VlcERvd24gPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBjID0gYXdhaXQgcG9pbnRBdChwYWdlLCBib3gpO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoYy54ICsgZHggLyAyLCBjLnksIHsgc3RlcHM6IDYgfSk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZShjLnggKyBkeCwgYy55LCB7IHN0ZXBzOiA2IH0pO1xuXHRpZiAoIWtlZXBEb3duKSBhd2FpdCByZWxlYXNlKHBhZ2UpO1xufVxuXG5zY2VuYXJpbygnU3BpbkJveDogZHJhZ2dpbmcgY2hhbmdlcyB0aGUgdmFsdWUsIHRoZSBmaWxsIGJhciB0cmFja3MgaXQgYW5kIHRoZSBhY3RpdmUgbG9vayBzaG93cyB3aGlsZSBoZWxkJywgJ1NwaW5Cb3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBzYkJveChwYWdlLCAxKTtcblx0Y29uc3QgZmlsbEJhciA9IGJveC5sb2NhdG9yKCcuc3BpbmJveF9fZmlsbCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChib3gsICdjdXJzb3InKSwgJ2V3LXJlc2l6ZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JWYWx1ZShib3gpLCA0MCk7XG5cdGF3YWl0IGRyYWdCeShwYWdlLCBib3gsIDQwLCB0cnVlKTtcblx0YXdhaXQgY2xzKGJveCwgJ3NwaW5ib3gtLWFjdGl2ZScsIHRydWUpO1xuXHRhd2FpdCBvdXRsaW5lSXMocGFnZSwgYm94LCAncHJpbWFyeScpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgZmlsbEJhciwgJ3ByaW1hcnknKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0YXdhaXQgY2xzKGJveCwgJ3NwaW5ib3gtLWFjdGl2ZScsIGZhbHNlKTtcblx0YXdhaXQgY2xzKGJveCwgJ3NwaW5ib3gtLXRleHQnLCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlZhbHVlKGJveCksIDcwLCAnYSA0MHB4IGRyYWcgb24gYSAxMzJweCB3aWRlIDAgdG8gMTAwIGJveCBsYW5kcyBvbiA3MCBhZnRlciB0aGUgZGVsdGEgc25hcCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JUZXh0KGJveCksICc3MC4wJyk7XG5cdGNvbnN0IHdpZHRoID0gYXdhaXQgYm94LmV2YWx1YXRlKChlbCkgPT4gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGgpO1xuXHRjb25zdCBmaWxsV2lkdGggPSBhd2FpdCBmaWxsQmFyLmV2YWx1YXRlKChlbCkgPT4gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGgpO1xuXHRhc3NlcnQub2soTWF0aC5hYnMoZmlsbFdpZHRoIC0gKDAuNyAqIHdpZHRoIC0gMikpIDwgMC42LCAnZmlsbCB3aWR0aCAnICsgZmlsbFdpZHRoICsgJyBvZiAnICsgd2lkdGgpO1xufSk7XG5cbnNjZW5hcmlvKCdTcGluQm94OiB0aGUgdmFsdWUgY2xhbXBzIHRvIHRoZSByYW5nZSBhdCBib3RoIGVuZHMnLCAnU3BpbkJveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHNiQm94KHBhZ2UsIDEpO1xuXHRhd2FpdCBkcmFnQnkocGFnZSwgYm94LCA5MDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JWYWx1ZShib3gpLCAxMDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgYm94LmV2YWx1YXRlKChlbCkgPT4gZWwuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1zcGluYm94LWZpbGwnKSksICcxJyk7XG5cdGF3YWl0IGRyYWdCeShwYWdlLCBib3gsIC05MDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JWYWx1ZShib3gpLCAwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVGV4dChib3gpLCAnMC4wJyk7XG59KTtcblxuc2NlbmFyaW8oJ1NwaW5Cb3g6IGEgY2xpY2sgd2l0aG91dCBhIGRyYWcgb3BlbnMgdGV4dCBlbnRyeSwgRW50ZXIgY29tbWl0cyBhbmQgY2xhbXBzLCBFc2NhcGUgY2FuY2VscycsICdTcGluQm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgYm94ID0gc2JCb3gocGFnZSwgMSk7XG5cdGF3YWl0IGJveC5jbGljaygpO1xuXHRhd2FpdCBjbHMoYm94LCAnc3BpbmJveC0tdGV4dCcsIHRydWUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgYm94LmxvY2F0b3IoJ2lucHV0JykuaW5wdXRWYWx1ZSgpLCAnNDAuMCcpO1xuXHRhd2FpdCBzZWVuKGJveC5sb2NhdG9yKCcuc3BpbmJveF9fZmlsbCcpLCBmYWxzZSk7XG5cdGF3YWl0IHBhZ2Uua2V5Ym9hcmQudHlwZSgnNTUnKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbnRlcicpO1xuXHRhd2FpdCBjbHMoYm94LCAnc3BpbmJveC0tdGV4dCcsIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVmFsdWUoYm94KSwgNTUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JUZXh0KGJveCksICc1NS4wJyk7XG5cdGF3YWl0IGJveC5jbGljaygpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJzk5OScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlZhbHVlKGJveCksIDEwMCk7XG5cdGF3YWl0IGJveC5jbGljaygpO1xuXHRhd2FpdCBwYWdlLmtleWJvYXJkLnR5cGUoJzEyJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRXNjYXBlJyk7XG5cdGF3YWl0IGNscyhib3gsICdzcGluYm94LS10ZXh0JywgZmFsc2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JWYWx1ZShib3gpLCAxMDApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JUZXh0KGJveCksICcxMDAuMCcpO1xufSk7XG5cbnNjZW5hcmlvKCdTcGluQm94OiBVcCBhbmQgRG93biBhcnJvd3Mgc3RlcCBieSB0aGUgZGVsdGEgYW5kIHN0b3AgYXQgdGhlIGxpbWl0LCBFbnRlciBvcGVucyB0ZXh0IGVudHJ5JywgJ1NwaW5Cb3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBzYkJveChwYWdlLCAwKTtcblx0YXdhaXQgYm94LmZvY3VzKCk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dVcCcpO1xuXHRhc3NlcnQuZXF1YWwoTWF0aC5yb3VuZCgoYXdhaXQgc2JWYWx1ZShib3gpKSAqIDEwMCkgLyAxMDAsIDAuNDEpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicsICdBcnJvd0Rvd24nKTtcblx0YXNzZXJ0LmVxdWFsKE1hdGgucm91bmQoKGF3YWl0IHNiVmFsdWUoYm94KSkgKiAxMDApIC8gMTAwLCAwLjM5KTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCA4MDsgaSsrKSBhd2FpdCB0YXAocGFnZSwgJ0Fycm93VXAnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVmFsdWUoYm94KSwgMSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRW50ZXInKTtcblx0YXdhaXQgY2xzKGJveCwgJ3NwaW5ib3gtLXRleHQnLCB0cnVlKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFc2NhcGUnKTtcbn0pO1xuXG5zY2VuYXJpbygnU3BpbkJveDogRXNjYXBlIGR1cmluZyBhIGRyYWcgcmVzdG9yZXMgdGhlIHZhbHVlJywgJ1NwaW5Cb3gnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBib3ggPSBzYkJveChwYWdlLCAxKTtcblx0YXdhaXQgZHJhZ0J5KHBhZ2UsIGJveCwgNTAsIHRydWUpO1xuXHRhc3NlcnQubm90RXF1YWwoYXdhaXQgc2JWYWx1ZShib3gpLCA0MCk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRXNjYXBlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzYlZhbHVlKGJveCksIDQwKTtcblx0YXdhaXQgY2xzKGJveCwgJ3NwaW5ib3gtLWFjdGl2ZScsIGZhbHNlKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNiVmFsdWUoYm94KSwgNDApO1xufSk7XG5cbnNjZW5hcmlvKCdTcGluQm94OiBhbiB1bmJvdW5kZWQgYm94IGhhcyBubyBmaWxsIGFuZCBkcmFncyBieSBhIHNoYXJlIG9mIGl0cyB2YWx1ZSwgYSBkaXNhYmxlZCBib3ggaWdub3JlcyB0aGUgcG9pbnRlcicsICdTcGluQm94JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZnJlZSA9IHNiQm94KHBhZ2UsIDIpO1xuXHRhd2FpdCBzZWVuKGZyZWUubG9jYXRvcignLnNwaW5ib3hfX2ZpbGwnKSwgZmFsc2UpO1xuXHRhd2FpdCBkcmFnQnkocGFnZSwgZnJlZSwgNjApO1xuXHRhc3NlcnQub2soKGF3YWl0IHNiVmFsdWUoZnJlZSkpID4gMTMwMCwgJ3ZhbHVlICcgKyAoYXdhaXQgc2JWYWx1ZShmcmVlKSkpO1xuXHRjb25zdCBsb2NrZWQgPSBzYkJveChwYWdlLCAzKTtcblx0YXdhaXQgZHJhZ0J5KHBhZ2UsIGxvY2tlZCwgNjApO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2JWYWx1ZShsb2NrZWQpLCA0MCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGxvY2tlZCwgJ29wYWNpdHknKSwgJzAuNDUnKTtcblx0YXdhaXQgbG9ja2VkLmNsaWNrKCk7XG5cdGF3YWl0IGNscyhsb2NrZWQsICdzcGluYm94LS10ZXh0JywgZmFsc2UpO1xufSk7XG5cbnNjZW5hcmlvKCdTcGluQm94OiBob3ZlciBvdXRsaW5lcyBIb3ZlciBhbmQgZmlsbHMgSG92ZXIsIHRoZSBpZGxlIGZpbGwgaXMgRHJvcGRvd24nLCAnU3BpbkJveCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGJveCA9IHNiQm94KHBhZ2UsIDEpO1xuXHRjb25zdCBmaWxsQmFyID0gYm94LmxvY2F0b3IoJy5zcGluYm94X19maWxsJyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBmaWxsQmFyLCAnZHJvcGRvd24nKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBib3gpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgZmlsbEJhciwgJ2hvdmVyJyk7XG5cdGF3YWl0IG91dGxpbmVJcyhwYWdlLCBib3gsICdob3ZlcicpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgZmlsbEJhciwgJ2Ryb3Bkb3duJyk7XG59KTtcblxuLy8gLS0tLS0tLS0tLSBTbGlkZXIgLS0tLS0tLS0tLVxuXG5jb25zdCBTTCA9ICd1ZS1zbGlkZXIgJztcbmNvbnN0IHNsaWRlciA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoU0wgKyAnLnNsaWRlcicpLm50aChpbmRleCk7XG5jb25zdCBzbFZhbHVlID0gYXN5bmMgKGVsOiBMb2NhdG9yKTogUHJvbWlzZTxudW1iZXI+ID0+IE51bWJlcihhd2FpdCBlbC5nZXRBdHRyaWJ1dGUoJ2FyaWEtdmFsdWVub3cnKSk7XG5cbnNjZW5hcmlvKCdTbGlkZXI6IGNsaWNraW5nIHRoZSBiYXIganVtcHMgdGhlIHRodW1iIHRoZXJlIGFuZCBkcmFnZ2luZyBmb2xsb3dzIHRoZSBwb2ludGVyJywgJ1NsaWRlcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGVsID0gc2xpZGVyKHBhZ2UsIDApO1xuXHRjb25zdCBib3ggPSBhd2FpdCBlbC5ib3VuZGluZ0JveCgpO1xuXHRhc3NlcnQub2soYm94KTtcblx0YXdhaXQgcGFnZS5tb3VzZS5jbGljayhib3gueCArIDggKyAwLjc1ICogKGJveC53aWR0aCAtIDE2KSwgYm94LnkgKyA0KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCAwLjc1KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihTTCArICcuc2xpZGVyLXZhbHVlJykubnRoKDApLnRleHRDb250ZW50KCksICcwLjc1Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBlbC5ldmFsdWF0ZSgoZSkgPT4gZS5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCctLXNsaWRlci12YWx1ZScpKSwgJzAuNzUnKTtcblx0YXdhaXQgcGFnZS5tb3VzZS5tb3ZlKGJveC54ICsgMTAwLCBib3gueSArIDQpO1xuXHRhd2FpdCBob2xkKHBhZ2UpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoYm94LnggKyAzMCwgYm94LnkgKyA0LCB7IHN0ZXBzOiA1IH0pO1xuXHRhc3NlcnQub2soTWF0aC5hYnMoKGF3YWl0IHNsVmFsdWUoZWwpKSAtICgzMCAtIDgpIC8gKGJveC53aWR0aCAtIDE2KSkgPCAwLjAxMSk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZShib3gueCAtIDgwLCBib3gueSArIDQsIHsgc3RlcHM6IDUgfSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMCk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZShib3gueCArIDUwMCwgYm94LnkgKyA0LCB7IHN0ZXBzOiA1IH0pO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2xWYWx1ZShlbCksIDEpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRjb25zdCB0aHVtYkJveCA9IGF3YWl0IGVsLmxvY2F0b3IoJy5zbGlkZXJfX3RodW1iJykuYm91bmRpbmdCb3goKTtcblx0YXNzZXJ0Lm9rKHRodW1iQm94KTtcblx0YXNzZXJ0Lm9rKE1hdGguYWJzKHRodW1iQm94LnggKyA0IC0gKGJveC54ICsgYm94LndpZHRoIC0gOCkpIDwgMC42LCAndGhlIHRodW1iIGNlbnRyZSBzaXRzIDhweCBmcm9tIHRoZSByaWdodCBlbmQnKTtcbn0pO1xuXG5zY2VuYXJpbygnU2xpZGVyOiB0aGUgc3RlcHBlZCBzbGlkZXIgc25hcHMgdG8gaXRzIHN0ZXAnLCAnU2xpZGVyJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgZWwgPSBzbGlkZXIocGFnZSwgMSk7XG5cdGNvbnN0IGJveCA9IGF3YWl0IGVsLmJvdW5kaW5nQm94KCk7XG5cdGFzc2VydC5vayhib3gpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLmNsaWNrKGJveC54ICsgOCArIDAuNTIgKiAoYm94LndpZHRoIC0gMTYpLCBib3gueSArIDQpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2xWYWx1ZShlbCksIDUwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihTTCArICcuc2xpZGVyLXZhbHVlJykubnRoKDEpLnRleHRDb250ZW50KCksICc1MCcpO1xufSk7XG5cbnNjZW5hcmlvKCdTbGlkZXI6IGFycm93IGtleXMsIFBhZ2Uga2V5cywgSG9tZSBhbmQgRW5kIG1vdmUgdGhlIHZhbHVlIGFuZCBzdG9wIGF0IHRoZSBlbmRzJywgJ1NsaWRlcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGVsID0gc2xpZGVyKHBhZ2UsIDApO1xuXHRhd2FpdCBlbC5mb2N1cygpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93UmlnaHQnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCAwLjUxKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0xlZnQnLCAnQXJyb3dMZWZ0Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMC40OSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnUGFnZVVwJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMC41OSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRW5kJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzbFZhbHVlKGVsKSwgMSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc2xWYWx1ZShlbCksIDEpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0hvbWUnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCAwKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCAwKTtcblx0YXdhaXQgaW5rcyhwYWdlLCBlbCwgJ291dGxpbmUtY29sb3InLCAncHJpbWFyeScpO1xufSk7XG5cbnNjZW5hcmlvKCdTbGlkZXI6IHRoZSB0aHVtYiBpcyBGb3JlZ3JvdW5kIGFuZCBicmlnaHRlbnMgdG8gRm9yZWdyb3VuZEhvdmVyIG9uIGhvdmVyIGFuZCB3aGlsZSBwcmVzc2VkJywgJ1NsaWRlcicsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGVsID0gc2xpZGVyKHBhZ2UsIDApO1xuXHRjb25zdCB0aHVtYiA9IGVsLmxvY2F0b3IoJy5zbGlkZXJfX3RodW1iJyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCB0aHVtYiwgJ2ZvcmVncm91bmQnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBlbCk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCB0aHVtYiwgJ2ZvcmVncm91bmQtaG92ZXInKTtcblx0YXdhaXQgYXdheShwYWdlKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHRodW1iLCAnZm9yZWdyb3VuZCcpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIGVsKTtcblx0YXdhaXQgaG9sZChwYWdlKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHRodW1iLCAnZm9yZWdyb3VuZC1ob3ZlcicpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xufSk7XG5cbnNjZW5hcmlvKCdTbGlkZXI6IGEgZGlzYWJsZWQgc2xpZGVyIGlnbm9yZXMgdGhlIHBvaW50ZXIgYW5kIHN0YXlzIGRpbW1lZCcsICdTbGlkZXInLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBlbCA9IHNsaWRlcihwYWdlLCAyKTtcblx0Y29uc3QgYm94ID0gYXdhaXQgZWwuYm91bmRpbmdCb3goKTtcblx0YXNzZXJ0Lm9rKGJveCk7XG5cdGF3YWl0IHBhZ2UubW91c2UuY2xpY2soYm94LnggKyAyMCwgYm94LnkgKyA0KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHNsVmFsdWUoZWwpLCAwLjUpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChlbCwgJ29wYWNpdHknKSwgJzAuNDUnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBlbCk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBlbC5sb2NhdG9yKCcuc2xpZGVyX190aHVtYicpLCAnZm9yZWdyb3VuZCcpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0gVG9vbHRpcCAtLS0tLS0tLS0tXG5cbmNvbnN0IFRUID0gJ3VlLXRvb2x0aXAgJztcbmNvbnN0IHBvcHVwID0gKHBhZ2U6IFBhZ2UsIGluZGV4OiBudW1iZXIpOiBMb2NhdG9yID0+IHBhZ2UubG9jYXRvcihUVCArICcudG9vbHRpcC1wb3B1cCcpLm50aChpbmRleCk7XG5cbnNjZW5hcmlvKCdUb29sdGlwOiBob3ZlcmluZyBhIHRhcmdldCBzaG93cyBpdCBhZnRlciBhIHNob3J0IGRlbGF5IG5lYXIgdGhlIHBvaW50ZXIgYW5kIGxlYXZpbmcgaGlkZXMgaXQnLCAnVG9vbHRpcCcsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHRpcCA9IHBvcHVwKHBhZ2UsIDApO1xuXHRjb25zdCBjID0gYXdhaXQgcG9pbnRBdChwYWdlLCBwYWdlLmxvY2F0b3IoVFQgKyAnLnRvb2x0aXAtdGFyZ2V0JykubnRoKDApKTtcblx0YXdhaXQgc2Vlbih0aXAsIGZhbHNlKTtcblx0YXdhaXQgd2FpdChwYWdlLCA0NTApO1xuXHRhd2FpdCBzZWVuKHRpcCwgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKHRpcCwgJ29wYWNpdHknKSwgJzEnKTtcblx0Y29uc3QgYm94ID0gYXdhaXQgdGlwLmJvdW5kaW5nQm94KCk7XG5cdGFzc2VydC5vayhib3gpO1xuXHRhc3NlcnQub2soTWF0aC5hYnMoYm94LnggLSAoYy54ICsgMTIpKSA8IDEuNSAmJiBNYXRoLmFicyhib3gueSAtIChjLnkgKyA4KSkgPCAxLjUsICdvZmZzZXQgKDEyLCA4KSBmcm9tIHRoZSBwb2ludGVyOiAnICsgYm94LnggKyAnLCcgKyBib3gueSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCB0aXAsICdkcm9wZG93bicpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoYy54ICsgMjAsIGMueSArIDMpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDYwKTtcblx0Y29uc3QgbW92ZWQgPSBhd2FpdCB0aXAuYm91bmRpbmdCb3goKTtcblx0YXNzZXJ0Lm9rKG1vdmVkKTtcblx0YXNzZXJ0Lm9rKE1hdGguYWJzKG1vdmVkLnggLSAoYy54ICsgMjAgKyAxMikpIDwgMS41LCAndGhlIHRvb2x0aXAgZm9sbG93cyB0aGUgcG9pbnRlcicpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDgwKTtcblx0YXdhaXQgc2Vlbih0aXAsIGZhbHNlKTtcbn0pO1xuXG5zY2VuYXJpbygnVG9vbHRpcDogYSBwcmVzcyBhbmQgRXNjYXBlIGJvdGggaGlkZSBpdCwgYW5kIGEgcHJlc3Mga2VlcHMgaXQgaGlkZGVuIHVudGlsIHRoZSBwb2ludGVyIGxlYXZlcycsICdUb29sdGlwJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgdGlwID0gcG9wdXAocGFnZSwgMSk7XG5cdGNvbnN0IGMgPSBhd2FpdCBwb2ludEF0KHBhZ2UsIHBhZ2UubG9jYXRvcihUVCArICcudG9vbHRpcC10YXJnZXQnKS5udGgoMSkpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDQwMCk7XG5cdGF3YWl0IHNlZW4odGlwLCB0cnVlKTtcblx0YXdhaXQgaG9sZChwYWdlKTtcblx0YXdhaXQgcmVsZWFzZShwYWdlKTtcblx0YXdhaXQgd2FpdChwYWdlLCA2MCk7XG5cdGF3YWl0IHNlZW4odGlwLCBmYWxzZSk7XG5cdGF3YWl0IHBhZ2UubW91c2UubW92ZShjLnggKyA0LCBjLnkgKyAyKTtcblx0YXdhaXQgd2FpdChwYWdlLCAzNTApO1xuXHRhd2FpdCBzZWVuKHRpcCwgZmFsc2UpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhd2FpdCBwYWdlLm1vdXNlLm1vdmUoYy54LCBjLnkpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDQwMCk7XG5cdGF3YWl0IHNlZW4odGlwLCB0cnVlKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFc2NhcGUnKTtcblx0YXdhaXQgd2FpdChwYWdlLCA0MCk7XG5cdGF3YWl0IHNlZW4odGlwLCBmYWxzZSk7XG59KTtcblxuc2NlbmFyaW8oJ1Rvb2x0aXA6IGtleWJvYXJkIGZvY3VzIHNob3dzIGl0IGFuZCBibHVyIGhpZGVzIGl0LCB0aGUgdGV4dC1vbmx5IGZvcm0gaXMgYmxhY2sgb24gdGhlIGJyaWdodCBmaWxsJywgJ1Rvb2x0aXAnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRhd2FpdCB0YXAocGFnZSwgJ1RhYicsICdUYWInKTtcblx0Y29uc3QgdGlwID0gcG9wdXAocGFnZSwgMSk7XG5cdGF3YWl0IHdhaXQocGFnZSwgNDAwKTtcblx0YXdhaXQgc2Vlbih0aXAsIHRydWUpO1xuXHRhd2FpdCBpbmtzKHBhZ2UsIHRpcCwgJ2NvbG9yJywgJ2JsYWNrJyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCB0aXAsICdmb3JlZ3JvdW5kJyk7XG5cdGF3YWl0IHNlZW4ocG9wdXAocGFnZSwgMCksIGZhbHNlKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdUYWInKTtcblx0YXdhaXQgd2FpdChwYWdlLCA2MCk7XG5cdGF3YWl0IHNlZW4odGlwLCBmYWxzZSk7XG59KTtcblxuc2NlbmFyaW8oJ1Rvb2x0aXA6IHBpbm5lZCBzcGVjaW1lbnMgc3RheSB2aXNpYmxlIHBsYWluIEhUTUwgYW5kIHRoZSBsaXZlIHRvb2x0aXAgc3RhcnRzIGhpZGRlbicsICdUb29sdGlwJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgcGlubmVkID0gcGFnZS5sb2NhdG9yKCcudG9vbHRpcFtkYXRhLXBpbm5lZF0nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBpbm5lZC5jb3VudCgpLCAyKTtcblx0YXdhaXQgc2VlbihwaW5uZWQuZmlyc3QoKSwgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwaW5uZWQuZmlyc3QoKS5ldmFsdWF0ZSgoZWwpID0+IGVsLmNsb3Nlc3QoJ3VlLXRvb2x0aXAnKSksIG51bGwpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcG9wdXAocGFnZSwgMCkuZXZhbHVhdGUoKGVsKSA9PiBlbC5oYXNBdHRyaWJ1dGUoJ2hpZGRlbicpKSwgdHJ1ZSk7XG59KTtcblxuLy8gLS0tLS0tLS0tLSBQb3B1cE1lbnUgLS0tLS0tLS0tLVxuXG5jb25zdCBQTSA9ICd1ZS1wb3B1cC1tZW51ICc7XG5jb25zdCBtZW51ID0gKHBhZ2U6IFBhZ2UsIGluZGV4OiBudW1iZXIpOiBMb2NhdG9yID0+IHBhZ2UubG9jYXRvcihQTSArICcucG9wdXBtZW51W3RhYmluZGV4XScpLm50aChpbmRleCk7XG5jb25zdCByb3cgPSAocGFnZTogUGFnZSwgbGFiZWw6IHN0cmluZyk6IExvY2F0b3IgPT4gcGFnZS5sb2NhdG9yKFBNICsgJy5wb3B1cG1lbnVfX3JvdycpLmZpbHRlcih7IGhhczogcGFnZS5sb2NhdG9yKCcucG9wdXBtZW51X19sYWJlbCcsIHsgaGFzVGV4dDogbmV3IFJlZ0V4cCgnXicgKyBsYWJlbCArICckJykgfSkgfSk7XG5jb25zdCBjdXJyZW50ID0gKHBhZ2U6IFBhZ2UsIGluZGV4OiBudW1iZXIpOiBMb2NhdG9yID0+IG1lbnUocGFnZSwgaW5kZXgpLmxvY2F0b3IoJy5wb3B1cG1lbnVfX3Jvdy0taG92ZXInKTtcbmNvbnN0IGN1cnJlbnRMYWJlbCA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiA9PiBjdXJyZW50KHBhZ2UsIGluZGV4KS5sb2NhdG9yKCcucG9wdXBtZW51X19sYWJlbCcpLmZpcnN0KCkudGV4dENvbnRlbnQoKTtcbmNvbnN0IG1lbnVTdGF0dXMgPSAocGFnZTogUGFnZSwgaW5kZXg6IG51bWJlcik6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4gPT4gcGFnZS5sb2NhdG9yKFBNICsgJy5wb3B1cG1lbnUtc3RhdHVzJykubnRoKGluZGV4KS50ZXh0Q29udGVudCgpO1xuXG5zY2VuYXJpbygnUG9wdXBNZW51OiBob3ZlcmluZyBhIHJvdyBmaWxscyBpdCB3aXRoIFByaW1hcnkgYW5kIGEgcHJlc3NlZCByb3cgZHJvcHMgMXB4JywgJ1BvcHVwTWVudScsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGNvcHkgPSByb3cocGFnZSwgJ0NvcHknKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGZpbGwoY29weSksIENMRUFSKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBjb3B5KTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIGNvcHksICdwcmltYXJ5Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGNvcHksICdwYWRkaW5nLXRvcCcpLCAnM3B4Jyk7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGNvcHksICdwYWRkaW5nLXRvcCcpLCAnNHB4Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGNvcHksICdwYWRkaW5nLWJvdHRvbScpLCAnMnB4Jyk7XG5cdGF3YWl0IHJlbGVhc2UocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGNvcHksICdwYWRkaW5nLXRvcCcpLCAnM3B4Jyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51U3RhdHVzKHBhZ2UsIDEpLCAnQWN0aXZhdGVkOiBDb3B5Jyk7XG5cdGF3YWl0IGF3YXkocGFnZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBmaWxsKGNvcHkpLCBDTEVBUik7XG59KTtcblxuc2NlbmFyaW8oJ1BvcHVwTWVudTogYXJyb3cga2V5cyBoaWdobGlnaHQsIHNraXAgdGhlIGRpc2FibGVkIHJvdyBhbmQgd3JhcCwgSG9tZSBhbmQgRW5kIGp1bXAnLCAnUG9wdXBNZW51JywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXdhaXQgbWVudShwYWdlLCAwKS5mb2N1cygpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0Fycm93RG93bicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDApLCAnU2hvdyBHcmlkJyk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBjdXJyZW50KHBhZ2UsIDApLCAncHJpbWFyeScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VuZCcpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDApLCAnVG9wJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMCksICdTaG93IEdyaWQnKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd1VwJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMCksICdUb3AnKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBhZ2UubG9jYXRvcihQTSArICcucG9wdXBtZW51X19yb3ctLWhvdmVyJykuY291bnQoKSwgMSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnSG9tZScpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgY3VycmVudExhYmVsKHBhZ2UsIDApLCAnU2hvdyBHcmlkJyk7XG59KTtcblxuc2NlbmFyaW8oJ1BvcHVwTWVudTogRW50ZXIgYW5kIFNwYWNlIGFjdGl2YXRlLCBjaGVja21hcmtzIHRvZ2dsZSwgcmFkaW9zIHBpY2sgb25lIGFuZCB0aGUgY2FwdGlvbiBuYW1lcyB0aGUgcGljaycsICdQb3B1cE1lbnUnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBncmlkID0gcm93KHBhZ2UsICdTaG93IEdyaWQnKTtcblx0Y29uc3QgYm91bmRzID0gcm93KHBhZ2UsICdTaG93IEJvdW5kcycpO1xuXHRhd2FpdCBtZW51KHBhZ2UsIDApLmZvY3VzKCk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJyk7XG5cdGF3YWl0IGF0dHIoZ3JpZCwgJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpO1xuXHRhd2FpdCBzZWVuKGdyaWQubG9jYXRvcignLnBvcHVwbWVudV9fdGljaycpLCBmYWxzZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRW50ZXInKTtcblx0YXdhaXQgYXR0cihncmlkLCAnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcblx0YXdhaXQgc2VlbihncmlkLmxvY2F0b3IoJy5wb3B1cG1lbnVfX3RpY2snKSwgdHJ1ZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51U3RhdHVzKHBhZ2UsIDApLCAnQWN0aXZhdGVkOiBTaG93IEdyaWQgKGNoZWNrZWQpJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJywgJ1NwYWNlJyk7XG5cdGF3YWl0IGF0dHIoYm91bmRzLCAnYXJpYS1jaGVja2VkJywgJ2ZhbHNlJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBtZW51U3RhdHVzKHBhZ2UsIDApLCAnQWN0aXZhdGVkOiBTaG93IEJvdW5kcyAodW5jaGVja2VkKScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VuZCcsICdFbnRlcicpO1xuXHRhd2FpdCBhdHRyKHJvdyhwYWdlLCAnVG9wJyksICdhcmlhLWNoZWNrZWQnLCAndHJ1ZScpO1xuXHRhd2FpdCBhdHRyKHJvdyhwYWdlLCAnUGVyc3BlY3RpdmUnKSwgJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcm93KHBhZ2UsICdUb3AnKS5sb2NhdG9yKCcucG9wdXBtZW51X19yYWRpbycpLCAnd2hpdGUnKTtcblx0YXdhaXQgcm93KHBhZ2UsICdQZXJzcGVjdGl2ZScpLmNsaWNrKCk7XG5cdGF3YWl0IGF0dHIocm93KHBhZ2UsICdQZXJzcGVjdGl2ZScpLCAnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcblx0YXdhaXQgYXR0cihyb3cocGFnZSwgJ1RvcCcpLCAnYXJpYS1jaGVja2VkJywgJ2ZhbHNlJyk7XG5cdGF3YWl0IHJvdyhwYWdlLCAnUmVzZXQgTGF5b3V0JykuY2xpY2soeyBmb3JjZTogdHJ1ZSB9KTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnVTdGF0dXMocGFnZSwgMCksICdBY3RpdmF0ZWQ6IFBlcnNwZWN0aXZlIChzZWxlY3RlZCknKTtcbn0pO1xuXG5zY2VuYXJpbygnUG9wdXBNZW51OiBSaWdodCBvcGVucyB0aGUgc3VibWVudSBhbmQgZW50ZXJzIGl0LCBMZWZ0IGNsb3NlcyBpdCwgc2VwYXJhdG9ycyBhbmQgZGlzYWJsZWQgcm93cyBhcmUgc2tpcHBlZCcsICdQb3B1cE1lbnUnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBzYXZlQXMgPSByb3cocGFnZSwgJ1NhdmUgQXMnKTtcblx0Y29uc3Qgc3ViID0gc2F2ZUFzLmxvY2F0b3IoJy5wb3B1cG1lbnVfX3N1YicpO1xuXHRhd2FpdCBtZW51KHBhZ2UsIDEpLmZvY3VzKCk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJywgJ0Fycm93RG93bicsICdBcnJvd0Rvd24nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGN1cnJlbnRMYWJlbChwYWdlLCAxKSwgJ1NhdmUgQXMnKTtcblx0YXdhaXQgc2VlbihzdWIsIGZhbHNlKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd1JpZ2h0Jyk7XG5cdGF3YWl0IHNlZW4oc3ViLCB0cnVlKTtcblx0YXdhaXQgYXR0cihzYXZlQXMsICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHNhdmVBcywgJ3ByaW1hcnknKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGN1cnJlbnRMYWJlbChwYWdlLCAxKSwgJ0Fzc2V0Li4uJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMSksICdDb3B5IFBhdGgnKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdBcnJvd0Rvd24nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGN1cnJlbnRMYWJlbChwYWdlLCAxKSwgJ0Fzc2V0Li4uJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRW50ZXInKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IG1lbnVTdGF0dXMocGFnZSwgMSksICdBY3RpdmF0ZWQ6IEFzc2V0Li4uJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dMZWZ0Jyk7XG5cdGF3YWl0IHNlZW4oc3ViLCBmYWxzZSk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMSksICdTYXZlIEFzJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dSaWdodCcpO1xuXHRhd2FpdCBzZWVuKHN1YiwgdHJ1ZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnRXNjYXBlJyk7XG5cdGF3YWl0IHNlZW4oc3ViLCBmYWxzZSk7XG5cdGF3YWl0IHRhcChwYWdlLCAnQXJyb3dEb3duJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBjdXJyZW50TGFiZWwocGFnZSwgMSksICdEZWxldGUnKTtcbn0pO1xuXG5zY2VuYXJpbygnUG9wdXBNZW51OiBob3ZlcmluZyBhIHN1Ym1lbnUgcm93IG9wZW5zIGl0cyBzdWJtZW51IGFuZCBpdCBzdGF5cyBvcGVuIHdoaWxlIHRoZSBwb2ludGVyIGlzIGluc2lkZScsICdQb3B1cE1lbnUnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBzYXZlQXMgPSByb3cocGFnZSwgJ1NhdmUgQXMnKTtcblx0Y29uc3Qgc3ViID0gc2F2ZUFzLmxvY2F0b3IoJy5wb3B1cG1lbnVfX3N1YicpO1xuXHRhd2FpdCBwb2ludEF0KHBhZ2UsIHNhdmVBcy5sb2NhdG9yKCcucG9wdXBtZW51X19sYWJlbCcpLmZpcnN0KCkpO1xuXHRhd2FpdCBzZWVuKHN1YiwgdHJ1ZSk7XG5cdGNvbnN0IGZpcnN0U3ViUm93ID0gc3ViLmxvY2F0b3IoJy5wb3B1cG1lbnVfX3JvdycpLmZpcnN0KCk7XG5cdGF3YWl0IHBvaW50QXQocGFnZSwgZmlyc3RTdWJSb3cpO1xuXHRhd2FpdCBzZWVuKHN1YiwgdHJ1ZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBmaXJzdFN1YlJvdywgJ3ByaW1hcnknKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHNhdmVBcywgJ3ByaW1hcnknKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCByb3cocGFnZSwgJ0NvcHknKSk7XG5cdGF3YWl0IHNlZW4oc3ViLCBmYWxzZSk7XG59KTtcblxuc2NlbmFyaW8oJ1BvcHVwTWVudTogcGlubmVkIG1lbnVzIHN0YXkgcGxhaW4gSFRNTCBhbmQgaWdub3JlIHRoZSBwb2ludGVyJywgJ1BvcHVwTWVudScsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHBpbm5lZCA9IHBhZ2UubG9jYXRvcignLnBvcHVwbWVudVtkYXRhLXBpbm5lZF0nKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBpbm5lZC5jb3VudCgpLCAyKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHBpbm5lZC5maXJzdCgpLmV2YWx1YXRlKChlbCkgPT4gZWwuY2xvc2VzdCgndWUtcG9wdXAtbWVudScpKSwgbnVsbCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKHBpbm5lZC5maXJzdCgpLCAncG9pbnRlci1ldmVudHMnKSwgJ25vbmUnKTtcbn0pO1xuXG4vLyAtLS0tLS0tLS0tIE5vdGlmaWNhdGlvbiAtLS0tLS0tLS0tXG5cbmNvbnN0IE5UID0gJ3VlLW5vdGlmaWNhdGlvbiAnO1xuY29uc3QgdG9hc3RDb3VudCA9IChwYWdlOiBQYWdlKTogUHJvbWlzZTxudW1iZXI+ID0+IHBhZ2UubG9jYXRvcihOVCArICcubm90aWZpY2F0aW9uJykuY291bnQoKTtcbmNvbnN0IHN0YWNrSGVpZ2h0ID0gYXN5bmMgKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPG51bWJlcj4gPT4gKGF3YWl0IHBhZ2UubG9jYXRvcihOVCArICcubm90aWZpY2F0aW9uLXN0YWNrJykuYm91bmRpbmdCb3goKSk/LmhlaWdodCA/PyAwO1xuY29uc3QgdG9hc3RUaXRsZXMgPSAocGFnZTogUGFnZSk6IFByb21pc2U8c3RyaW5nW10+ID0+IHBhZ2UubG9jYXRvcihOVCArICcubm90aWZpY2F0aW9uX190aXRsZScpLmFsbFRleHRDb250ZW50cygpO1xuY29uc3QgdG9hc3RHb25lID0gKHBhZ2U6IFBhZ2UsIHJlbWFpbmluZzogbnVtYmVyKTogUHJvbWlzZTx1bmtub3duPiA9PiBwYWdlLndhaXRGb3JGdW5jdGlvbigobikgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndWUtbm90aWZpY2F0aW9uIC5ub3RpZmljYXRpb24nKS5sZW5ndGggPT09IG4sIHJlbWFpbmluZyk7XG5cbnNjZW5hcmlvKCdOb3RpZmljYXRpb246IERpc21pc3MgcmVtb3ZlcyB0aGUgdG9hc3QgYW5kIHRoZSBzdGFjayBjbG9zZXMgdXAnLCAnTm90aWZpY2F0aW9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHRvYXN0Q291bnQocGFnZSksIDEpO1xuXHRhc3NlcnQub2soKGF3YWl0IHN0YWNrSGVpZ2h0KHBhZ2UpKSA+IDYwKTtcblx0YXdhaXQgcGFnZS5sb2NhdG9yKE5UICsgJy5ub3RpZmljYXRpb25fX2J0bltkYXRhLWFjdGlvbj1cImRpc21pc3NcIl0nKS5jbGljaygpO1xuXHRhd2FpdCB0b2FzdEdvbmUocGFnZSwgMCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzdGFja0hlaWdodChwYWdlKSwgMCk7XG59KTtcblxuc2NlbmFyaW8oJ05vdGlmaWNhdGlvbjogU2hvdyBub3RpZmljYXRpb24gYWRkcyB0b2FzdHMgYW5kIGRpc21pc3Npbmcgb25lIGNvbGxhcHNlcyBpdHMgaGVpZ2h0IG91dCBvZiB0aGUgc3RhY2snLCAnTm90aWZpY2F0aW9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3Qgc2hvdyA9IHBhZ2UubG9jYXRvcihOVCArICdbZGF0YS1hY3Rpb249XCJzaG93XCJdJyk7XG5cdGF3YWl0IHNob3cuY2xpY2soKTtcblx0YXdhaXQgc2hvdy5jbGljaygpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDM1MCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCB0b2FzdENvdW50KHBhZ2UpLCAzKTtcblx0YXNzZXJ0LmRlZXBFcXVhbChhd2FpdCB0b2FzdFRpdGxlcyhwYWdlKSwgWydTYXZlZCAyIGFzc2V0cycsICdTYXZlZCAxIGFzc2V0JywgJ0ltcG9ydCBmYWlsZWQnXSk7XG5cdGNvbnN0IGZ1bGwgPSBhd2FpdCBzdGFja0hlaWdodChwYWdlKTtcblx0YXdhaXQgcGFnZS5sb2NhdG9yKE5UICsgJy5ub3RpZmljYXRpb24nKS5udGgoMCkubG9jYXRvcignW2RhdGEtYWN0aW9uPVwiZGlzbWlzc1wiXScpLmNsaWNrKCk7XG5cdGF3YWl0IHRvYXN0R29uZShwYWdlLCAyKTtcblx0Y29uc3QgbGVzcyA9IGF3YWl0IHN0YWNrSGVpZ2h0KHBhZ2UpO1xuXHRhc3NlcnQub2soZnVsbCAtIGxlc3MgPiA0MCwgJ3RoZSBzdGFjayBzaHJhbmsgZnJvbSAnICsgZnVsbCArICcgdG8gJyArIGxlc3MpO1xuXHRhc3NlcnQuZGVlcEVxdWFsKGF3YWl0IHRvYXN0VGl0bGVzKHBhZ2UpLCBbJ1NhdmVkIDEgYXNzZXQnLCAnSW1wb3J0IGZhaWxlZCddKTtcbn0pO1xuXG5zY2VuYXJpbygnTm90aWZpY2F0aW9uOiBidXR0b25zIGhhdmUgaG92ZXIsIHByZXNzZWQgYW5kIGZvY3VzIGxvb2tzIGFuZCBSZXRyeSBlZGl0cyB0aGUgc3ViIHRleHQnLCAnTm90aWZpY2F0aW9uJywgYXN5bmMgKHBhZ2UpID0+IHtcblx0Y29uc3QgcmV0cnkgPSBwYWdlLmxvY2F0b3IoTlQgKyAnW2RhdGEtYWN0aW9uPVwicmV0cnlcIl0nKTtcblx0Y29uc3Qgc3ViID0gcGFnZS5sb2NhdG9yKE5UICsgJy5ub3RpZmljYXRpb25fX3N1YicpO1xuXHRhd2FpdCBwYWludHMocGFnZSwgcmV0cnksICdzZWNvbmRhcnknKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCByZXRyeSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCByZXRyeSwgJ2hvdmVyJyk7XG5cdGF3YWl0IGhvbGQocGFnZSk7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCByZXRyeSwgJ2hlYWRlcicpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgcHJvcChyZXRyeSwgJ3BhZGRpbmctdG9wJyksICc0LjVweCcpO1xuXHRhd2FpdCByZWxlYXNlKHBhZ2UpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgc3ViLnRleHRDb250ZW50KCksICdDaGFpci5mYnggY291bGQgbm90IGJlIHJlYWQuIFJldHJpZWQgMSB0aW1lLicpO1xuXHRhd2FpdCBhd2F5KHBhZ2UpO1xuXHRhd2FpdCByZXRyeS5mb2N1cygpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ1NoaWZ0K1RhYicsICdUYWInKTtcblx0YXdhaXQgb3V0bGluZUlzKHBhZ2UsIHJldHJ5LCAncHJpbWFyeScpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ0VudGVyJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBzdWIudGV4dENvbnRlbnQoKSwgJ0NoYWlyLmZieCBjb3VsZCBub3QgYmUgcmVhZC4gUmV0cmllZCAyIHRpbWVzLicpO1xufSk7XG5cbnNjZW5hcmlvKCdOb3RpZmljYXRpb246IGEgZGlzbWlzc2VkIHRvYXN0IGNhbiBiZSBicm91Z2h0IGJhY2sgd2l0aCBTaG93IG5vdGlmaWNhdGlvbicsICdOb3RpZmljYXRpb24nLCBhc3luYyAocGFnZSkgPT4ge1xuXHRhd2FpdCBwYWdlLmxvY2F0b3IoTlQgKyAnW2RhdGEtYWN0aW9uPVwiZGlzbWlzc1wiXScpLmNsaWNrKCk7XG5cdGF3YWl0IHRvYXN0R29uZShwYWdlLCAwKTtcblx0YXdhaXQgcGFnZS5sb2NhdG9yKE5UICsgJ1tkYXRhLWFjdGlvbj1cInNob3dcIl0nKS5jbGljaygpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDMwMCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCB0b2FzdENvdW50KHBhZ2UpLCAxKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHBhZ2UubG9jYXRvcihOVCArICcubm90aWZpY2F0aW9uJyksICdub3RpZmljYXRpb25zJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJy5ub3RpZmljYXRpb25bZGF0YS1waW5uZWRdJykuY291bnQoKSwgMyk7XG59KTtcblxuLy8gLS0tLS0tLS0tLSBFeHBhbmRhYmxlQXJlYSAtLS0tLS0tLS0tXG5cbmNvbnN0IEVBID0gJ3VlLWV4cGFuZGFibGUtYXJlYSAnO1xuY29uc3QgYXJlYSA9IChwYWdlOiBQYWdlLCBpbmRleDogbnVtYmVyKTogTG9jYXRvciA9PiBwYWdlLmxvY2F0b3IoRUEgKyAnLmV4cGFuZGFibGVhcmVhJykubnRoKGluZGV4KTtcblxuc2NlbmFyaW8oJ0V4cGFuZGFibGVBcmVhOiBhIGNsaWNrIHRvZ2dsZXMgdGhlIGJvZHkgYW5kIHR1cm5zIHRoZSBjYXJldCcsICdFeHBhbmRhYmxlQXJlYScsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IGNsb3NlZCA9IGFyZWEocGFnZSwgMCk7XG5cdGNvbnN0IGhlYWRlciA9IGNsb3NlZC5sb2NhdG9yKCcuZXhwYW5kYWJsZWFyZWFfX2hlYWRlcicpO1xuXHRjb25zdCBib2R5ID0gY2xvc2VkLmxvY2F0b3IoJy5leHBhbmRhYmxlYXJlYV9fYm9keScpO1xuXHRjb25zdCBjYXJldCA9IGNsb3NlZC5sb2NhdG9yKCcuZXhwYW5kYWJsZWFyZWFfX2NhcmV0Jyk7XG5cdGF3YWl0IGF0dHIoaGVhZGVyLCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuXHRhd2FpdCBzZWVuKGJvZHksIGZhbHNlKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AoY2FyZXQsICd0cmFuc2Zvcm0nKSwgJ25vbmUnKTtcblx0YXdhaXQgaGVhZGVyLmNsaWNrKCk7XG5cdGF3YWl0IGF0dHIoaGVhZGVyLCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG5cdGF3YWl0IHNlZW4oYm9keSwgdHJ1ZSk7XG5cdGF3YWl0IHdhaXQocGFnZSwgMjUwKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IHByb3AoY2FyZXQsICd0cmFuc2Zvcm0nKSwgJ21hdHJpeCgwLCAxLCAtMSwgMCwgMCwgMCknKTtcblx0YXdhaXQgaGVhZGVyLmNsaWNrKCk7XG5cdGF3YWl0IHNlZW4oYm9keSwgZmFsc2UpO1xuXHRhd2FpdCB3YWl0KHBhZ2UsIDI1MCk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwcm9wKGNhcmV0LCAndHJhbnNmb3JtJyksICdub25lJyk7XG59KTtcblxuc2NlbmFyaW8oJ0V4cGFuZGFibGVBcmVhOiBFbnRlciBhbmQgU3BhY2UgdG9nZ2xlIHRoZSBmb2N1c2VkIGhlYWRlciBhbmQgaXQgc2hvd3MgdGhlIGZvY3VzIHJpbmcnLCAnRXhwYW5kYWJsZUFyZWEnLCBhc3luYyAocGFnZSkgPT4ge1xuXHRjb25zdCBoZWFkZXIgPSBhcmVhKHBhZ2UsIDEpLmxvY2F0b3IoJy5leHBhbmRhYmxlYXJlYV9faGVhZGVyJyk7XG5cdGNvbnN0IGJvZHkgPSBhcmVhKHBhZ2UsIDEpLmxvY2F0b3IoJy5leHBhbmRhYmxlYXJlYV9fYm9keScpO1xuXHRhd2FpdCBzZWVuKGJvZHksIHRydWUpO1xuXHRhd2FpdCB0YXAocGFnZSwgJ1RhYicsICdUYWInKTtcblx0YXNzZXJ0LmVxdWFsKGF3YWl0IGlzRm9jdXNlZChoZWFkZXIpLCB0cnVlKTtcblx0YXdhaXQgaW5rcyhwYWdlLCBoZWFkZXIsICdvdXRsaW5lLWNvbG9yJywgJ3ByaW1hcnknKTtcblx0YXdhaXQgdGFwKHBhZ2UsICdFbnRlcicpO1xuXHRhd2FpdCBzZWVuKGJvZHksIGZhbHNlKTtcblx0YXdhaXQgYXR0cihoZWFkZXIsICdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG5cdGF3YWl0IHRhcChwYWdlLCAnU3BhY2UnKTtcblx0YXdhaXQgc2Vlbihib2R5LCB0cnVlKTtcbn0pO1xuXG5zY2VuYXJpbygnRXhwYW5kYWJsZUFyZWE6IHRoZSBwYW5lbCBrZWVwcyBpdHMgUGFuZWwgZmlsbCBhbmQgdGhlIGhlYWRlciBoYXMgbm8gaG92ZXIgZmlsbCcsICdFeHBhbmRhYmxlQXJlYScsIGFzeW5jIChwYWdlKSA9PiB7XG5cdGNvbnN0IHBhbmVsID0gYXJlYShwYWdlLCAwKTtcblx0Y29uc3QgaGVhZGVyID0gcGFuZWwubG9jYXRvcignLmV4cGFuZGFibGVhcmVhX19oZWFkZXInKTtcblx0YXdhaXQgcGFpbnRzKHBhZ2UsIHBhbmVsLCAncGFuZWwnKTtcblx0YXdhaXQgcG9pbnRBdChwYWdlLCBoZWFkZXIpO1xuXHRhc3NlcnQuZXF1YWwoYXdhaXQgZmlsbChoZWFkZXIpLCBDTEVBUik7XG5cdGF3YWl0IHBhaW50cyhwYWdlLCBwYW5lbCwgJ3BhbmVsJyk7XG5cdGFzc2VydC5lcXVhbChhd2FpdCBwYWdlLmxvY2F0b3IoJy5leHBhbmRhYmxlYXJlYVtkYXRhLXBpbm5lZF0nKS5jb3VudCgpLCAyKTtcbn0pO1xuXG4iLCAiLy8vIDxyZWZlcmVuY2UgbGliPVwiZG9tXCIgLz5cbi8vIFNtYWxsIHBhZ2UgcHJvYmVzIHNoYXJlZCBieSB0aGUgcHJldmlldyB0ZXN0czogY29tcHV0ZWQgc3R5bGVzLCB0b2tlbnMsIGtleXMgYW5kIHRoZSBtb3VzZS5cbmltcG9ydCB0eXBlIHsgTG9jYXRvciwgUGFnZSB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuXG5leHBvcnQgY29uc3QgQ0xFQVIgPSAncmdiYSgwLCAwLCAwLCAwKSc7XG5cbi8vIFJlc29sdmVzIGEgZGVzaWduIHRva2VuIHRvIHRoZSBjb2xvdXIgc3RyaW5nIHRoZSBicm93c2VyIGNvbXB1dGVzIGZvciBpdC5cbmV4cG9ydCBjb25zdCB0b2tlbiA9IChwYWdlOiBQYWdlLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT5cblx0cGFnZS5ldmFsdWF0ZSgobikgPT4ge1xuXHRcdGNvbnN0IHByb2JlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0cHJvYmUuc3R5bGUuYmFja2dyb3VuZCA9ICd2YXIoLS0nICsgbiArICcpJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZChwcm9iZSk7XG5cdFx0Y29uc3QgY29sb3VyID0gZ2V0Q29tcHV0ZWRTdHlsZShwcm9iZSkuYmFja2dyb3VuZENvbG9yO1xuXHRcdHByb2JlLnJlbW92ZSgpO1xuXHRcdHJldHVybiBjb2xvdXI7XG5cdH0sIG5hbWUpO1xuXG5leHBvcnQgY29uc3QgcHJvcCA9ICh0YXJnZXQ6IExvY2F0b3IsIG5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB0YXJnZXQuZXZhbHVhdGUoKGVsLCBuKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5nZXRQcm9wZXJ0eVZhbHVlKG4pLCBuYW1lKTtcbmV4cG9ydCBjb25zdCBmaWxsID0gKHRhcmdldDogTG9jYXRvcik6IFByb21pc2U8c3RyaW5nPiA9PiBwcm9wKHRhcmdldCwgJ2JhY2tncm91bmQtY29sb3InKTtcbmV4cG9ydCBjb25zdCBpbmsgPSAodGFyZ2V0OiBMb2NhdG9yKTogUHJvbWlzZTxzdHJpbmc+ID0+IHByb3AodGFyZ2V0LCAnY29sb3InKTtcbmV4cG9ydCBjb25zdCBoYXNDbGFzcyA9ICh0YXJnZXQ6IExvY2F0b3IsIG5hbWU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4gPT4gdGFyZ2V0LmV2YWx1YXRlKChlbCwgbikgPT4gZWwuY2xhc3NMaXN0LmNvbnRhaW5zKG4pLCBuYW1lKTtcbmV4cG9ydCBjb25zdCB0ZXh0cyA9IChwYWdlOiBQYWdlLCBzZWxlY3Rvcjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4gcGFnZS4kJGV2YWwoc2VsZWN0b3IsIChlbHMpID0+IGVscy5tYXAoKGVsKSA9PiBlbC50ZXh0Q29udGVudD8udHJpbSgpID8/ICcnKSk7XG5leHBvcnQgY29uc3QgZm9jdXNlZFRleHQgPSAocGFnZTogUGFnZSk6IFByb21pc2U8c3RyaW5nPiA9PiBwYWdlLmV2YWx1YXRlKCgpID0+IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ/LnRleHRDb250ZW50Py50cmltKCkgPz8gJycpO1xuZXhwb3J0IGNvbnN0IGFmdGVyID0gKHRhcmdldDogTG9jYXRvcik6IExvY2F0b3IgPT4gdGFyZ2V0LmxvY2F0b3IoJ3hwYXRoPWZvbGxvd2luZy1zaWJsaW5nOjoqWzFdJyk7XG5leHBvcnQgY29uc3QgcHJlc3MgPSAocGFnZTogUGFnZSwga2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2Uua2V5Ym9hcmQucHJlc3Moa2V5KTtcbmV4cG9ydCBjb25zdCBob2xkID0gKHBhZ2U6IFBhZ2UpOiBQcm9taXNlPHZvaWQ+ID0+IHBhZ2UubW91c2UuZG93bigpO1xuZXhwb3J0IGNvbnN0IHJlbGVhc2UgPSAocGFnZTogUGFnZSk6IFByb21pc2U8dm9pZD4gPT4gcGFnZS5tb3VzZS51cCgpO1xuZXhwb3J0IGNvbnN0IGF3YXkgPSAocGFnZTogUGFnZSk6IFByb21pc2U8dm9pZD4gPT4gcGFnZS5tb3VzZS5tb3ZlKDkwMCwgNzAwKTtcbmV4cG9ydCBjb25zdCBjbGlja0F3YXkgPSAocGFnZTogUGFnZSk6IFByb21pc2U8dm9pZD4gPT4gcGFnZS5tb3VzZS5jbGljayg5MDAsIDcwMCk7XG4iLCAiLy8gRGVjbGFyZXMgb25lIHByZXZpZXcgdGVzdDogb3BlbnMgdGhlIHByZXZpZXcsIHJ1bnMgdGhlIGJvZHksIHRoZW4gYXNzZXJ0cyB0aGUgcGFnZSByYWlzZWQgbm8gZXJyb3JzLlxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydC9zdHJpY3QnO1xuaW1wb3J0IHsgdGVzdCB9IGZyb20gJ25vZGU6dGVzdCc7XG5pbXBvcnQgdHlwZSB7IFBhZ2UgfSBmcm9tICdwbGF5d3JpZ2h0JztcbmltcG9ydCB7IG9wZW5QcmV2aWV3LCB3aXRoQnJvd3NlciB9IGZyb20gJy4vbGliLnRzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHNjZW5hcmlvKG5hbWU6IHN0cmluZywgY29tcG9uZW50OiBzdHJpbmcsIGJvZHk6IChwYWdlOiBQYWdlKSA9PiBQcm9taXNlPHZvaWQ+KTogdm9pZCB7XG5cdHRlc3QobmFtZSwgKCkgPT5cblx0XHR3aXRoQnJvd3Nlcihhc3luYyAoYnJvd3NlcikgPT4ge1xuXHRcdFx0Y29uc3QgeyBwYWdlLCBlcnJvcnMgfSA9IGF3YWl0IG9wZW5QcmV2aWV3KGJyb3dzZXIsIGNvbXBvbmVudCk7XG5cdFx0XHRhd2FpdCBib2R5KHBhZ2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBFcXVhbChlcnJvcnMsIFtdLCAndGhlIHBhZ2UgcmFpc2VkIGNvbnNvbGUgb3IgcGFnZSBlcnJvcnMnKTtcblx0XHRcdGF3YWl0IHBhZ2UuY2xvc2UoKTtcblx0XHR9KSxcblx0KTtcbn1cbiIsICIvLy8gPHJlZmVyZW5jZSBsaWI9XCJkb21cIiAvPlxuLy8gU2hhcmVkIGhlbHBlcnMgZm9yIHRoZSBwcmV2aWV3IGludGVyYWN0aW9uIHRlc3RzLiBUaGUgRE9NIGxpYiB0eXBlcyB0aGUgY2FsbGJhY2tzIHRoYXQgcnVuIGluIHRoZSBwYWdlLlxuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IGh0dHAgZnJvbSAnbm9kZTpodHRwJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHsgY2hyb21pdW0sIHR5cGUgQnJvd3NlciwgdHlwZSBQYWdlIH0gZnJvbSAncGxheXdyaWdodCc7XG5cbmNvbnN0IGhlcmUgPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcbmV4cG9ydCBjb25zdCByb290ID0gcGF0aC5yZXNvbHZlKGhlcmUsICcuLicsICdkZXNpZ24tc3lzdGVtJyk7XG5cbmludGVyZmFjZSBUb2tlblZhbHVlIHsgW3RoZW1lOiBzdHJpbmddOiBzdHJpbmcgfVxuaW50ZXJmYWNlIFRva2VucyB7XG5cdGNvbG9yOiB7IHRoZW1lczogQXJyYXk8eyBpZDogc3RyaW5nIH0+OyB0b2tlbnM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIHwgVG9rZW5WYWx1ZSB9PiB9O1xuXHRzcGFjaW5nOiB7IHRva2VuczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfT4gfTtcblx0cmFkaXVzOiB7IHRva2VuczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfT4gfTtcblx0dHlwZTogeyBmYW1pbGllczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB9O1xufVxuXG4vLyBCdWlsZHMgdGhlIHRva2Vucy5jc3MgdGhhdCB0aGUgcHJldmlldyBmcmFtZSBwcmVsb2FkcywgZnJvbSB0b2tlbnMuanNvbiAoZmlyc3QgdGhlbWUpLlxuZXhwb3J0IGZ1bmN0aW9uIHRva2Vuc0NzcygpOiBzdHJpbmcge1xuXHRjb25zdCB0b2tlbnMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocm9vdCwgJ3Rva2Vucy5qc29uJyksICd1dGY4JykpIGFzIFRva2Vucztcblx0Y29uc3QgdGhlbWUgPSB0b2tlbnMuY29sb3IudGhlbWVzWzBdLmlkO1xuXHRjb25zdCB2YXJzOiBzdHJpbmdbXSA9IFtdO1xuXHRjb25zdCByZXNvbHZlID0gKHZhbHVlOiBzdHJpbmcgfCBUb2tlblZhbHVlKTogc3RyaW5nID0+IHtcblx0XHRjb25zdCByYXcgPSB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8gdmFsdWUgOiB2YWx1ZVt0aGVtZV07XG5cdFx0Y29uc3QgYWxpYXMgPSAvXlxceyguKylcXH0kLy5leGVjKHJhdyk7XG5cdFx0cmV0dXJuIGFsaWFzID8gJ3ZhcigtLScgKyBhbGlhc1sxXSArICcpJyA6IHJhdztcblx0fTtcblx0Zm9yIChjb25zdCB0IG9mIHRva2Vucy5jb2xvci50b2tlbnMpIHZhcnMucHVzaCgnLS0nICsgdC5uYW1lICsgJzogJyArIHJlc29sdmUodC52YWx1ZSkgKyAnOycpO1xuXHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zLnNwYWNpbmcudG9rZW5zKSB2YXJzLnB1c2goJy0tJyArIHQubmFtZSArICc6ICcgKyB0LnZhbHVlICsgJzsnKTtcblx0Zm9yIChjb25zdCB0IG9mIHRva2Vucy5yYWRpdXMudG9rZW5zKSB2YXJzLnB1c2goJy0tJyArIHQubmFtZSArICc6ICcgKyB0LnZhbHVlICsgJzsnKTtcblx0Zm9yIChjb25zdCBba2V5LCBzdGFja10gb2YgT2JqZWN0LmVudHJpZXModG9rZW5zLnR5cGUuZmFtaWxpZXMpKSB2YXJzLnB1c2goJy0tZm9udC0nICsga2V5ICsgJzogJyArIHN0YWNrICsgJzsnKTtcblx0cmV0dXJuICc6cm9vdCB7ICcgKyB2YXJzLmpvaW4oJyAnKSArICcgfVxcbmJvZHkgeyBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kKTsgY29sb3I6IHZhcigtLWZvcmVncm91bmQpOyB9Jztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3IHtcblx0cGFnZTogUGFnZTtcblx0ZXJyb3JzOiBzdHJpbmdbXTtcbn1cblxuY29uc3QgTUlNRTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcblx0Jy5odG1sJzogJ3RleHQvaHRtbDsgY2hhcnNldD11dGYtOCcsXG5cdCcuanMnOiAndGV4dC9qYXZhc2NyaXB0OyBjaGFyc2V0PXV0Zi04Jyxcblx0Jy5jc3MnOiAndGV4dC9jc3M7IGNoYXJzZXQ9dXRmLTgnLFxuXHQnLmpzb24nOiAnYXBwbGljYXRpb24vanNvbicsXG5cdCcucG5nJzogJ2ltYWdlL3BuZycsXG5cdCcuc3ZnJzogJ2ltYWdlL3N2Zyt4bWwnLFxufTtcblxubGV0IGJhc2VVcmw6IFByb21pc2U8c3RyaW5nPiB8IHVuZGVmaW5lZDtcblxuLy8gU2VydmVzIGRlc2lnbi1zeXN0ZW0gb3ZlciBodHRwLCBiZWNhdXNlIENocm9taXVtIGJsb2NrcyBtb2R1bGUgc2NyaXB0cyBvbiBmaWxlOi8vLiBPbmUgc2VydmVyIHBlciBwcm9jZXNzLlxuZnVuY3Rpb24gc2VydmUoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0YmFzZVVybCA/Pz0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKChyZXEsIHJlcykgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZSA9IHBhdGguam9pbihyb290LCBkZWNvZGVVUklDb21wb25lbnQobmV3IFVSTChyZXEudXJsID8/ICcvJywgJ2h0dHA6Ly94JykucGF0aG5hbWUpKTtcblx0XHRcdGlmICghZmlsZS5zdGFydHNXaXRoKHJvb3QpIHx8ICFmcy5leGlzdHNTeW5jKGZpbGUpIHx8IGZzLnN0YXRTeW5jKGZpbGUpLmlzRGlyZWN0b3J5KCkpIHtcblx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDQpLmVuZCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXMud3JpdGVIZWFkKDIwMCwgeyAnY29udGVudC10eXBlJzogTUlNRVtwYXRoLmV4dG5hbWUoZmlsZSldID8/ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nIH0pO1xuXHRcdFx0ZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlKS5waXBlKHJlcyk7XG5cdFx0fSk7XG5cdFx0c2VydmVyLm9uKCdlcnJvcicsIHJlamVjdCk7XG5cdFx0c2VydmVyLmxpc3RlbigwLCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuXHRcdFx0c2VydmVyLnVucmVmKCk7XG5cdFx0XHRjb25zdCBhZGRyZXNzID0gc2VydmVyLmFkZHJlc3MoKTtcblx0XHRcdHJlc29sdmUoJ2h0dHA6Ly8xMjcuMC4wLjE6JyArICh0eXBlb2YgYWRkcmVzcyA9PT0gJ29iamVjdCcgJiYgYWRkcmVzcyA/IGFkZHJlc3MucG9ydCA6IDApKTtcblx0XHR9KTtcblx0fSk7XG5cdHJldHVybiBiYXNlVXJsO1xufVxuXG4vLyBPcGVucyBhIGNvbXBvbmVudCBwcmV2aWV3IHdpdGggdGhlIHRva2VucyBpbmplY3RlZC4gQ29uc29sZSBhbmQgcGFnZSBlcnJvcnMgY29sbGVjdCBpbiBgZXJyb3JzYC5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuUHJldmlldyhicm93c2VyOiBCcm93c2VyLCBuYW1lOiBzdHJpbmcsIHZpZXdwb3J0ID0geyB3aWR0aDogMTAwMCwgaGVpZ2h0OiA4MDAgfSk6IFByb21pc2U8UHJldmlldz4ge1xuXHRjb25zdCBwYWdlID0gYXdhaXQgYnJvd3Nlci5uZXdQYWdlKHsgdmlld3BvcnQgfSk7XG5cdGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblx0cGFnZS5vbigncGFnZWVycm9yJywgKGUpID0+IGVycm9ycy5wdXNoKFN0cmluZyhlKSkpO1xuXHRwYWdlLm9uKCdjb25zb2xlJywgKG0pID0+IHtcblx0XHRpZiAobS50eXBlKCkgPT09ICdlcnJvcicgJiYgIS9mb250c1xcLmd8RVJSX3xGYWlsZWQgdG8gbG9hZCByZXNvdXJjZS8udGVzdChtLnRleHQoKSkpIGVycm9ycy5wdXNoKG0udGV4dCgpKTtcblx0fSk7XG5cdGF3YWl0IHBhZ2UuZ290bygoYXdhaXQgc2VydmUoKSkgKyAnL2NvbXBvbmVudHMvJyArIG5hbWUgKyAnL3ByZXZpZXcuaHRtbCcpO1xuXHRhd2FpdCBwYWdlLmFkZFN0eWxlVGFnKHsgY29udGVudDogdG9rZW5zQ3NzKCkgfSk7XG5cdGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTAwKTtcblx0cmV0dXJuIHsgcGFnZSwgZXJyb3JzIH07XG59XG5cbi8vIFJ1bnMgYSB0ZXN0IGJvZHkgd2l0aCBhIGZyZXNoIGJyb3dzZXIgYW5kIGFsd2F5cyBjbG9zZXMgaXQuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aEJyb3dzZXIoYm9keTogKGJyb3dzZXI6IEJyb3dzZXIpID0+IFByb21pc2U8dm9pZD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgYnJvd3NlciA9IGF3YWl0IGNocm9taXVtLmxhdW5jaCgpO1xuXHR0cnkge1xuXHRcdGF3YWl0IGJvZHkoYnJvd3Nlcik7XG5cdH0gZmluYWxseSB7XG5cdFx0YXdhaXQgYnJvd3Nlci5jbG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBiYWNrZ3JvdW5kID0gKHBhZ2U6IFBhZ2UsIHNlbGVjdG9yOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4gcGFnZS4kZXZhbChzZWxlY3RvciwgKGVsKSA9PiBnZXRDb21wdXRlZFN0eWxlKGVsKS5iYWNrZ3JvdW5kQ29sb3IpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLE9BQU9BLGFBQVk7OztBQ0VaLElBQU0sUUFBUTtBQUdkLElBQU0sUUFBUSxDQUFDLE1BQVksU0FDakMsS0FBSyxTQUFTLENBQUMsTUFBTTtBQUNwQixRQUFNLFFBQVEsU0FBUyxjQUFjLEtBQUs7QUFDMUMsUUFBTSxNQUFNLGFBQWEsV0FBVyxJQUFJO0FBQ3hDLFdBQVMsS0FBSyxPQUFPLEtBQUs7QUFDMUIsUUFBTSxTQUFTLGlCQUFpQixLQUFLLEVBQUU7QUFDdkMsUUFBTSxPQUFPO0FBQ2IsU0FBTztBQUNSLEdBQUcsSUFBSTtBQUVELElBQU0sT0FBTyxDQUFDLFFBQWlCLFNBQWtDLE9BQU8sU0FBUyxDQUFDLElBQUksTUFBTSxpQkFBaUIsRUFBRSxFQUFFLGlCQUFpQixDQUFDLEdBQUcsSUFBSTtBQUMxSSxJQUFNLE9BQU8sQ0FBQyxXQUFxQyxLQUFLLFFBQVEsa0JBQWtCO0FBRWxGLElBQU0sV0FBVyxD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
