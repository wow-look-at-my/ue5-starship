/// <reference lib="dom" />
// Interaction tests for the controls group: Button, ComboButton, Checkbox, TextInput, SpinBox, Slider, Tooltip, PopupMenu, Notification, ExpandableArea.
import assert from 'node:assert/strict';
import type { Locator, Page } from 'playwright';
import { CLEAR, token, prop, fill, hasClass, hold, release, away } from './probe.ts';
import { scenario } from './scenario.ts';

// ---------- helpers for this file ----------

const shadow = (target: Locator): Promise<string> => prop(target, 'box-shadow');
const wait = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms);
const tap = (page: Page, ...names: string[]): Promise<void> => names.reduce((chain, name) => chain.then(() => page.keyboard.press(name)), Promise.resolve());
const isFocused = (target: Locator): Promise<boolean> => target.evaluate((el) => el === document.activeElement);

// Checks that an element is shown or hidden.
async function seen(target: Locator, expected: boolean): Promise<void> {
	assert.equal(await target.isVisible(), expected, 'visible: expected ' + expected);
}

// Checks one attribute value.
async function attr(target: Locator, name: string, expected: string): Promise<void> {
	assert.equal(await target.getAttribute(name), expected, name);
}

// Checks that a class is present or absent.
async function cls(target: Locator, name: string, expected: boolean): Promise<void> {
	assert.equal(await hasClass(target, name), expected, 'class ' + name);
}

// Checks that the element's fill is the named token.
async function paints(page: Page, target: Locator, name: string): Promise<void> {
	assert.equal(await fill(target), await token(page, name), 'fill should be ' + name);
}

// Checks that one computed property is the named token colour.
async function inks(page: Page, target: Locator, property: string, name: string): Promise<void> {
	assert.equal(await prop(target, property), await token(page, name), property + ' should be ' + name);
}

// Checks that the element's inset outline is painted with the named token.
async function outlineIs(page: Page, target: Locator, name: string): Promise<void> {
	assert.ok((await shadow(target)).startsWith(await token(page, name)), 'outline ' + (await shadow(target)) + ' should start with ' + name);
}

async function centre(target: Locator): Promise<{ x: number; y: number }> {
	const box = await target.boundingBox();
	assert.ok(box, 'bounding box');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Moves the pointer onto the element and returns where it went.
async function pointAt(page: Page, target: Locator): Promise<{ x: number; y: number }> {
	const c = await centre(target);
	await page.mouse.move(c.x, c.y);
	return c;
}

// ---------- Button ----------

const BTN = 'ue-button .button';

scenario('Button: hover fills Hover, primary hovers to PrimaryHover, simple hovers to Dropdown', 'Button', async (page) => {
	const plain = page.locator(BTN).nth(0);
	const primary = page.locator(BTN).nth(1);
	const simple = page.locator(BTN).nth(3);
	await paints(page, plain, 'secondary');
	await pointAt(page, plain);
	await paints(page, plain, 'hover');
	assert.equal(await fill(plain), await fill(page.locator('.button--hover').first()));
	await pointAt(page, primary);
	await paints(page, primary, 'primary-hover');
	await pointAt(page, simple);
	await paints(page, simple, 'dropdown');
	await inks(page, simple, 'color', 'foreground-hover');
});

scenario('Button: the mouse press uses the pressed fill and drops the label 1px', 'Button', async (page) => {
	const plain = page.locator(BTN).nth(0);
	const primary = page.locator(BTN).nth(1);
	assert.equal(await prop(plain, 'padding-top'), '3.5px');
	await pointAt(page, plain);
	await hold(page);
	await paints(page, plain, 'header');
	assert.equal(await prop(plain, 'padding-top'), '4.5px');
	assert.equal(await prop(plain, 'padding-bottom'), '2.5px');
	await release(page);
	assert.equal(await prop(plain, 'padding-top'), '3.5px');
	await pointAt(page, primary);
	await hold(page);
	await paints(page, primary, 'primary-press');
	await release(page);
});

scenario('Button: clicks register in the counter, a disabled button does not count', 'Button', async (page) => {
	const counter = page.locator('ue-button .button-count');
	assert.equal(await counter.textContent(), 'Clicks: 0');
	await page.locator(BTN).nth(0).click();
	await page.locator(BTN).nth(1).click();
	await page.locator(BTN).nth(4).click();
	assert.match((await counter.textContent()) ?? '', /^Clicks: 3 \(last: Settings\)/);
	const disabled = page.locator(BTN).nth(5);
	assert.equal(await disabled.isDisabled(), true);
	await disabled.click({ force: true });
	assert.match((await counter.textContent()) ?? '', /^Clicks: 3/);
	assert.equal(await prop(disabled, 'opacity'), '0.45');
});

scenario('Button: Space and Enter press the focused button, with the pressed look while held', 'Button', async (page) => {
	const counter = page.locator('ue-button .button-count');
	const plain = page.locator(BTN).nth(0);
	await plain.focus();
	await page.keyboard.down(' ');
	await cls(plain, 'button--pressed', true);
	await paints(page, plain, 'header');
	assert.equal(await prop(plain, 'padding-top'), '4.5px');
	await page.keyboard.up(' ');
	await cls(plain, 'button--pressed', false);
	assert.match((await counter.textContent()) ?? '', /^Clicks: 1/);
	await tap(page, 'Enter');
	assert.match((await counter.textContent()) ?? '', /^Clicks: 2/);
});

scenario('Button: Tab shows the Primary focus ring', 'Button', async (page) => {
	await tap(page, 'Tab');
	const first = page.locator(BTN).nth(0);
	assert.equal(await isFocused(first), true);
	await outlineIs(page, first, 'primary');
});

scenario('Button: pinned specimens ignore the pointer and sit outside the element', 'Button', async (page) => {
	const pinned = page.locator('.button--hover[data-pinned]').first();
	assert.equal(await prop(pinned, 'pointer-events'), 'none');
	assert.equal(await pinned.evaluate((el) => el.closest('ue-button')), null);
	await paints(page, pinned, 'hover');
});

// ---------- ComboButton ----------

const CB = 'ue-combo-button ';
const cbTrigger = (page: Page, index: number): Locator => page.locator(CB + '.combobutton-anchor').nth(index).locator('.combobutton');
const cbMenu = (page: Page, index: number): Locator => page.locator(CB + '.combobutton-anchor').nth(index).locator('.combobutton-menu');
const cbLabel = (trigger: Locator): Promise<string | null> => trigger.locator('.combobutton__label').textContent();

scenario('ComboButton: a click opens the popup with the open look, choosing sets the label and closes', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 0);
	const menu = cbMenu(page, 0);
	await seen(menu, false);
	await trigger.click();
	await seen(menu, true);
	await attr(trigger, 'aria-expanded', 'true');
	await cls(trigger, 'combobutton--open', true);
	assert.equal(await prop(trigger, 'padding-top'), '2px');
	await outlineIs(page, trigger, 'hover');
	await menu.locator('.combobutton-row-item').nth(2).click();
	await seen(menu, false);
	assert.equal(await cbLabel(trigger), 'Scale');
	assert.equal(await page.locator(CB + '.combobutton-status').textContent(), 'Picked: Scale');
	await attr(trigger, 'aria-expanded', 'false');
	assert.equal(await prop(trigger, 'padding-top'), '1px');
});

scenario('ComboButton: hovering a row fills it with Primary, hovering the button lights its outline', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 0);
	await outlineIs(page, trigger, 'input-outline');
	await pointAt(page, trigger);
	await outlineIs(page, trigger, 'hover');
	await trigger.click();
	const rows = cbMenu(page, 0).locator('.combobutton-row-item');
	assert.equal(await fill(rows.nth(1)), CLEAR);
	await pointAt(page, rows.nth(1));
	await paints(page, rows.nth(1), 'primary');
	await cls(rows.nth(1), 'combobutton-row-item--hover', true);
});

scenario('ComboButton: the keyboard opens with Down, arrows move, Enter picks, Escape cancels', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 0);
	const menu = cbMenu(page, 0);
	const rows = menu.locator('.combobutton-row-item');
	await trigger.focus();
	await tap(page, 'ArrowDown');
	await seen(menu, true);
	await cls(rows.nth(0), 'combobutton-row-item--hover', true);
	await tap(page, 'ArrowDown', 'ArrowDown');
	await cls(rows.nth(2), 'combobutton-row-item--hover', true);
	await cls(rows.nth(2), 'combobutton-row-item--focus', true);
	await tap(page, 'ArrowDown');
	await cls(rows.nth(0), 'combobutton-row-item--hover', true);
	await tap(page, 'ArrowUp', 'Enter');
	await seen(menu, false);
	assert.equal(await cbLabel(trigger), 'Scale');
	await tap(page, 'Enter');
	await seen(menu, true);
	await tap(page, 'Home', 'Escape');
	await seen(menu, false);
	assert.equal(await cbLabel(trigger), 'Scale');
	assert.equal(await isFocused(trigger), true);
	await tap(page, 'Space');
	await seen(menu, true);
	await cls(rows.nth(2), 'combobutton-row-item--hover', true);
});

scenario('ComboButton: an outside click closes the popup and opening one closes the other', 'ComboButton', async (page) => {
	await cbTrigger(page, 0).click();
	await seen(cbMenu(page, 0), true);
	await cbTrigger(page, 1).click();
	await seen(cbMenu(page, 0), false);
	await seen(cbMenu(page, 1), true);
	await page.mouse.click(700, 150);
	await seen(cbMenu(page, 1), false);
});

scenario('ComboButton: the simple variant keeps its label, a disabled one does not open', 'ComboButton', async (page) => {
	const simple = cbTrigger(page, 1);
	await simple.click();
	await cbMenu(page, 1).locator('.combobutton-row-item').nth(1).click();
	assert.equal(await cbLabel(simple), 'Settings');
	assert.equal(await page.locator(CB + '.combobutton-status').textContent(), 'Picked: Project Settings');
	const disabled = page.locator(CB + '.combobutton[aria-disabled="true"]');
	assert.equal(await prop(disabled, 'opacity'), '0.45');
	await disabled.click({ force: true });
	assert.equal(await page.locator(CB + '.combobutton-menu:not([hidden])').count(), 0);
});

// ---------- Checkbox ----------

const CK = 'ue-checkbox ';
const ck = (page: Page, label: string): Locator => page.locator(CK + '[data-label="' + label + '"]');

scenario('Checkbox: a click toggles and the glyph follows the state', 'Checkbox', async (page) => {
	const box = ck(page, 'Simulate Physics');
	const glyph = box.locator('.checkbox__glyph--check');
	await attr(box, 'aria-checked', 'false');
	await seen(glyph, false);
	await box.click();
	await attr(box, 'aria-checked', 'true');
	await seen(glyph, true);
	await seen(box.locator('.checkbox__glyph--mixed'), false);
	assert.equal(await page.locator(CK + '.checkbox-status').textContent(), 'Last change: Simulate Physics is checked');
	await box.click();
	await attr(box, 'aria-checked', 'false');
});

scenario('Checkbox: Space and Enter toggle the focused box, with the pressed class while held', 'Checkbox', async (page) => {
	const box = ck(page, 'Enable Gravity');
	await box.focus();
	await attr(box, 'aria-checked', 'true');
	await page.keyboard.down(' ');
	await cls(box, 'checkbox--pressed', true);
	await attr(box, 'aria-checked', 'true');
	await page.keyboard.up(' ');
	await attr(box, 'aria-checked', 'false');
	await tap(page, 'Enter');
	await attr(box, 'aria-checked', 'true');
});

scenario('Checkbox: the tri-state box cycles unchecked, checked, undetermined', 'Checkbox', async (page) => {
	const box = ck(page, 'Show All');
	const states: Array<string | null> = [await box.getAttribute('aria-checked')];
	for (let i = 0; i < 4; i++) {
		await box.click();
		states.push(await box.getAttribute('aria-checked'));
	}
	assert.deepEqual(states, ['mixed', 'false', 'true', 'mixed', 'false']);
	await box.click();
	await box.click();
	await seen(box.locator('.checkbox__glyph--mixed'), true);
	await seen(box.locator('.checkbox__glyph--check'), false);
});

scenario('Checkbox: hover and press outline the box with Hover and tint the glyph PrimaryHover then PrimaryPress', 'Checkbox', async (page) => {
	const box = ck(page, 'Enable Gravity');
	const square = box.locator('.checkbox__box');
	const glyph = box.locator('.checkbox__glyph--check');
	await outlineIs(page, square, 'secondary');
	await inks(page, glyph, 'stroke', 'primary');
	await pointAt(page, box);
	await outlineIs(page, square, 'hover');
	await inks(page, glyph, 'stroke', 'primary-hover');
	await hold(page);
	await inks(page, glyph, 'stroke', 'primary-press');
	await release(page);
});

scenario('Checkbox: the toggle-button checkbox toggles its fill and has hover, pressed and disabled looks', 'Checkbox', async (page) => {
	const off = ck(page, 'Physics');
	const on = ck(page, 'Collision');
	assert.equal(await fill(off), CLEAR);
	await pointAt(page, off);
	await paints(page, off, 'dropdown');
	await off.click();
	await attr(off, 'aria-pressed', 'true');
	await cls(off, 'checkbox-toggle--checked', true);
	await paints(page, off, 'primary-hover');
	await away(page);
	await paints(page, off, 'primary');
	await pointAt(page, on);
	await hold(page);
	await paints(page, on, 'dropdown');
	await release(page);
	await attr(on, 'aria-pressed', 'false');
	const locked = ck(page, 'Locked toggle');
	await locked.click({ force: true });
	await attr(locked, 'aria-pressed', 'false');
	assert.equal(await prop(locked, 'opacity'), '0.45');
	const lockedBox = ck(page, 'Locked');
	await lockedBox.click({ force: true });
	await attr(lockedBox, 'aria-checked', 'true');
});

scenario('Checkbox: Tab shows the Primary focus ring', 'Checkbox', async (page) => {
	await tap(page, 'Tab');
	const first = ck(page, 'Simulate Physics');
	assert.equal(await isFocused(first), true);
	await inks(page, first, 'outline-color', 'primary');
	assert.equal(await prop(first, 'outline-style'), 'solid');
});

// ---------- TextInput ----------

const TI = 'ue-text-input ';
const tiBox = (page: Page, index: number): Locator => page.locator(TI + '.textinput').nth(index);

scenario('TextInput: hover lights the outline, focus turns it Primary with white text', 'TextInput', async (page) => {
	const box = tiBox(page, 1);
	await outlineIs(page, box, 'input-outline');
	await inks(page, box, 'color', 'foreground');
	await pointAt(page, box);
	await outlineIs(page, box, 'hover');
	await box.locator('input').click();
	await away(page);
	await outlineIs(page, box, 'primary');
	await inks(page, box, 'color', 'foreground-hover');
	await paints(page, box, 'input');
});

scenario('TextInput: typing edits the field and the hint shows only while it is empty', 'TextInput', async (page) => {
	const field = tiBox(page, 0).locator('input');
	await attr(field, 'placeholder', 'Enter a name');
	assert.equal(await field.evaluate((el) => el.matches(':placeholder-shown')), true);
	await field.click();
	await page.keyboard.type('Chair01');
	assert.equal(await field.inputValue(), 'Chair01');
	await tap(page, 'Backspace');
	assert.equal(await field.inputValue(), 'Chair0');
	assert.equal(await field.evaluate((el) => el.matches(':placeholder-shown')), false);
});

scenario('TextInput: the read-only box takes focus but cannot be edited and keeps its Header fill', 'TextInput', async (page) => {
	const box = tiBox(page, 2);
	const field = box.locator('input');
	await paints(page, box, 'header');
	await field.click();
	await page.keyboard.type('xyz');
	assert.equal(await field.inputValue(), 'StaticMeshActor');
	await paints(page, box, 'header');
	await outlineIs(page, box, 'input-outline');
});

scenario('TextInput: the search box swaps the glass for a clear button once it has text', 'TextInput', async (page) => {
	const box = tiBox(page, 3);
	const field = box.locator('input');
	const glass = box.locator('.textinput__glass');
	const clear = box.locator('.textinput__clear');
	await seen(glass, true);
	await seen(clear, false);
	await field.click();
	await page.keyboard.type('chair');
	await seen(glass, false);
	await seen(clear, true);
	await clear.click();
	assert.equal(await field.inputValue(), '');
	await seen(glass, true);
	assert.equal(await isFocused(field), true);
});

scenario('TextInput: Escape clears the search box', 'TextInput', async (page) => {
	const box = tiBox(page, 3);
	const field = box.locator('input');
	await field.click();
	await page.keyboard.type('lamp');
	await cls(box, 'textinput--filled', true);
	await tap(page, 'Escape');
	assert.equal(await field.inputValue(), '');
	await cls(box, 'textinput--filled', false);
});

// ---------- SpinBox ----------

const SB = 'ue-spin-box ';
const sbBox = (page: Page, index: number): Locator => page.locator(SB + '.spinbox').nth(index);
const sbValue = async (box: Locator): Promise<number> => Number(await box.getAttribute('aria-valuenow'));
const sbText = async (box: Locator): Promise<string> => ((await box.locator('.spinbox__text').textContent()) ?? '').trim();

// Presses on the box, moves sideways and optionally keeps the button down.
async function dragBy(page: Page, box: Locator, dx: number, keepDown = false): Promise<void> {
	const c = await pointAt(page, box);
	await hold(page);
	await page.mouse.move(c.x + dx / 2, c.y, { steps: 6 });
	await page.mouse.move(c.x + dx, c.y, { steps: 6 });
	if (!keepDown) await release(page);
}

scenario('SpinBox: dragging changes the value, the fill bar tracks it and the active look shows while held', 'SpinBox', async (page) => {
	const box = sbBox(page, 1);
	const fillBar = box.locator('.spinbox__fill');
	assert.equal(await prop(box, 'cursor'), 'ew-resize');
	assert.equal(await sbValue(box), 40);
	await dragBy(page, box, 40, true);
	await cls(box, 'spinbox--active', true);
	await outlineIs(page, box, 'primary');
	await paints(page, fillBar, 'primary');
	await release(page);
	await cls(box, 'spinbox--active', false);
	await cls(box, 'spinbox--text', false);
	const landed = await sbValue(box);
	assert.ok(landed >= 60 && landed <= 70 && Number.isInteger(landed), 'a 40px drag moves 40 to between 60 and 70 after the 5px trigger and the delta snap, got ' + landed);
	assert.equal(await sbText(box), landed.toFixed(1));
	const width = await box.evaluate((el) => el.getBoundingClientRect().width);
	const fillWidth = await fillBar.evaluate((el) => el.getBoundingClientRect().width);
	assert.ok(Math.abs(fillWidth - (landed / 100 * width - 2)) < 0.6, 'fill width ' + fillWidth + ' of ' + width);
});

scenario('SpinBox: the value clamps to the range at both ends', 'SpinBox', async (page) => {
	const box = sbBox(page, 1);
	await dragBy(page, box, 900);
	assert.equal(await sbValue(box), 100);
	assert.equal(await box.evaluate((el) => el.style.getPropertyValue('--spinbox-fill')), '1');
	await dragBy(page, box, -900);
	assert.equal(await sbValue(box), 0);
	assert.equal(await sbText(box), '0.0');
});

scenario('SpinBox: a click without a drag opens text entry, Enter commits and clamps, Escape cancels', 'SpinBox', async (page) => {
	const box = sbBox(page, 1);
	await box.click();
	await cls(box, 'spinbox--text', true);
	assert.equal(await box.locator('input').inputValue(), '40.0');
	await seen(box.locator('.spinbox__fill'), false);
	await page.keyboard.type('55');
	await tap(page, 'Enter');
	await cls(box, 'spinbox--text', false);
	assert.equal(await sbValue(box), 55);
	assert.equal(await sbText(box), '55.0');
	await box.click();
	await page.keyboard.type('999');
	await tap(page, 'Enter');
	assert.equal(await sbValue(box), 100);
	await box.click();
	await page.keyboard.type('12');
	await tap(page, 'Escape');
	await cls(box, 'spinbox--text', false);
	assert.equal(await sbValue(box), 100);
	assert.equal(await sbText(box), '100.0');
});

scenario('SpinBox: Up and Down arrows step by the delta and stop at the limit, Enter opens text entry', 'SpinBox', async (page) => {
	const box = sbBox(page, 0);
	await box.focus();
	await tap(page, 'ArrowUp');
	assert.equal(Math.round((await sbValue(box)) * 100) / 100, 0.41);
	await tap(page, 'ArrowDown', 'ArrowDown');
	assert.equal(Math.round((await sbValue(box)) * 100) / 100, 0.39);
	for (let i = 0; i < 80; i++) await tap(page, 'ArrowUp');
	assert.equal(await sbValue(box), 1);
	await tap(page, 'Enter');
	await cls(box, 'spinbox--text', true);
	await tap(page, 'Escape');
});

scenario('SpinBox: Escape during a drag restores the value', 'SpinBox', async (page) => {
	const box = sbBox(page, 1);
	await dragBy(page, box, 50, true);
	assert.notEqual(await sbValue(box), 40);
	await tap(page, 'Escape');
	assert.equal(await sbValue(box), 40);
	await cls(box, 'spinbox--active', false);
	await release(page);
	assert.equal(await sbValue(box), 40);
});

scenario('SpinBox: an unbounded box has no fill and drags by a share of its value, a disabled box ignores the pointer', 'SpinBox', async (page) => {
	const free = sbBox(page, 2);
	await seen(free.locator('.spinbox__fill'), false);
	await dragBy(page, free, 60);
	assert.ok((await sbValue(free)) > 1300, 'value ' + (await sbValue(free)));
	const locked = sbBox(page, 3);
	await dragBy(page, locked, 60);
	assert.equal(await sbValue(locked), 40);
	assert.equal(await prop(locked, 'opacity'), '0.45');
	await locked.click({ force: true });
	await cls(locked, 'spinbox--text', false);
});

scenario('SpinBox: hover outlines Hover and fills Hover, the idle fill is Dropdown', 'SpinBox', async (page) => {
	const box = sbBox(page, 1);
	const fillBar = box.locator('.spinbox__fill');
	await paints(page, fillBar, 'dropdown');
	await pointAt(page, box);
	await paints(page, fillBar, 'hover');
	await outlineIs(page, box, 'hover');
	await away(page);
	await paints(page, fillBar, 'dropdown');
});

// ---------- Slider ----------

const SL = 'ue-slider ';
const slider = (page: Page, index: number): Locator => page.locator(SL + '.slider').nth(index);
const slValue = async (el: Locator): Promise<number> => Number(await el.getAttribute('aria-valuenow'));

scenario('Slider: clicking the bar jumps the thumb there and dragging follows the pointer', 'Slider', async (page) => {
	const el = slider(page, 0);
	const box = await el.boundingBox();
	assert.ok(box);
	await page.mouse.click(box.x + 8 + 0.75 * (box.width - 16), box.y + 4);
	assert.equal(await slValue(el), 0.75);
	assert.equal(await page.locator(SL + '.slider-value').nth(0).textContent(), '0.75');
	assert.equal(await el.evaluate((e) => e.style.getPropertyValue('--slider-value')), '0.75');
	await page.mouse.move(box.x + 100, box.y + 4);
	await hold(page);
	await page.mouse.move(box.x + 30, box.y + 4, { steps: 5 });
	assert.ok(Math.abs((await slValue(el)) - (30 - 8) / (box.width - 16)) < 0.011);
	await page.mouse.move(box.x - 80, box.y + 4, { steps: 5 });
	assert.equal(await slValue(el), 0);
	await page.mouse.move(box.x + 500, box.y + 4, { steps: 5 });
	assert.equal(await slValue(el), 1);
	await release(page);
	const thumbBox = await el.locator('.slider__thumb').boundingBox();
	assert.ok(thumbBox);
	assert.ok(Math.abs(thumbBox.x + 4 - (box.x + box.width - 8)) < 0.6, 'the thumb centre sits 8px from the right end');
});

scenario('Slider: the stepped slider snaps to its step', 'Slider', async (page) => {
	const el = slider(page, 1);
	const box = await el.boundingBox();
	assert.ok(box);
	await page.mouse.click(box.x + 8 + 0.52 * (box.width - 16), box.y + 4);
	assert.equal(await slValue(el), 50);
	assert.equal(await page.locator(SL + '.slider-value').nth(1).textContent(), '50');
});

scenario('Slider: arrow keys, Page keys, Home and End move the value and stop at the ends', 'Slider', async (page) => {
	const el = slider(page, 0);
	await el.focus();
	await tap(page, 'ArrowRight');
	assert.equal(await slValue(el), 0.51);
	await tap(page, 'ArrowLeft', 'ArrowLeft');
	assert.equal(await slValue(el), 0.49);
	await tap(page, 'PageUp');
	assert.equal(await slValue(el), 0.59);
	await tap(page, 'End');
	assert.equal(await slValue(el), 1);
	await tap(page, 'ArrowRight');
	assert.equal(await slValue(el), 1);
	await tap(page, 'Home');
	assert.equal(await slValue(el), 0);
	await tap(page, 'ArrowDown');
	assert.equal(await slValue(el), 0);
	await inks(page, el, 'outline-color', 'primary');
});

scenario('Slider: the thumb is Foreground and brightens to ForegroundHover on hover and while pressed', 'Slider', async (page) => {
	const el = slider(page, 0);
	const thumb = el.locator('.slider__thumb');
	await paints(page, thumb, 'foreground');
	await pointAt(page, el);
	await paints(page, thumb, 'foreground-hover');
	await away(page);
	await paints(page, thumb, 'foreground');
	await pointAt(page, el);
	await hold(page);
	await paints(page, thumb, 'foreground-hover');
	await release(page);
});

scenario('Slider: a disabled slider ignores the pointer and stays dimmed', 'Slider', async (page) => {
	const el = slider(page, 2);
	const box = await el.boundingBox();
	assert.ok(box);
	await page.mouse.click(box.x + 20, box.y + 4);
	assert.equal(await slValue(el), 0.5);
	assert.equal(await prop(el, 'opacity'), '0.45');
	await pointAt(page, el);
	await paints(page, el.locator('.slider__thumb'), 'foreground');
});

// ---------- Tooltip ----------

const TT = 'ue-tooltip ';
const popup = (page: Page, index: number): Locator => page.locator(TT + '.tooltip-popup').nth(index);

scenario('Tooltip: hovering a target shows it after a short delay near the pointer and leaving hides it', 'Tooltip', async (page) => {
	const tip = popup(page, 0);
	const c = await pointAt(page, page.locator(TT + '.tooltip-target').nth(0));
	await seen(tip, false);
	await wait(page, 450);
	await seen(tip, true);
	assert.equal(await prop(tip, 'opacity'), '1');
	const box = await tip.boundingBox();
	assert.ok(box);
	assert.ok(Math.abs(box.x - (c.x + 12)) < 1.5 && Math.abs(box.y - (c.y + 8)) < 1.5, 'offset (12, 8) from the pointer: ' + box.x + ',' + box.y);
	await paints(page, tip, 'dropdown');
	await page.mouse.move(c.x + 20, c.y + 3);
	await wait(page, 60);
	const moved = await tip.boundingBox();
	assert.ok(moved);
	assert.ok(Math.abs(moved.x - (c.x + 20 + 12)) < 1.5, 'the tooltip follows the pointer');
	await away(page);
	await wait(page, 80);
	await seen(tip, false);
});

scenario('Tooltip: a press and Escape both hide it, and a press keeps it hidden until the pointer leaves', 'Tooltip', async (page) => {
	const tip = popup(page, 1);
	const c = await pointAt(page, page.locator(TT + '.tooltip-target').nth(1));
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
	await tap(page, 'Escape');
	await wait(page, 40);
	await seen(tip, false);
});

scenario('Tooltip: keyboard focus shows it and blur hides it, the text-only form is black on the bright fill', 'Tooltip', async (page) => {
	await tap(page, 'Tab', 'Tab');
	const tip = popup(page, 1);
	await wait(page, 400);
	await seen(tip, true);
	await inks(page, tip, 'color', 'black');
	await paints(page, tip, 'foreground');
	await seen(popup(page, 0), false);
	await tap(page, 'Tab');
	await wait(page, 60);
	await seen(tip, false);
});

scenario('Tooltip: pinned specimens stay visible plain HTML and the live tooltip starts hidden', 'Tooltip', async (page) => {
	const pinned = page.locator('.tooltip[data-pinned]');
	assert.equal(await pinned.count(), 2);
	await seen(pinned.first(), true);
	assert.equal(await pinned.first().evaluate((el) => el.closest('ue-tooltip')), null);
	assert.equal(await popup(page, 0).evaluate((el) => el.hasAttribute('hidden')), true);
});

// ---------- PopupMenu ----------

const PM = 'ue-popup-menu ';
const menu = (page: Page, index: number): Locator => page.locator(PM + '.popupmenu[tabindex]').nth(index);
const row = (page: Page, label: string): Locator => page.locator(PM + '.popupmenu__row').filter({ has: page.locator('.popupmenu__label', { hasText: new RegExp('^' + label + '$') }) });
const current = (page: Page, index: number): Locator => menu(page, index).locator('.popupmenu__row--hover');
const currentLabel = (page: Page, index: number): Promise<string | null> => current(page, index).locator('.popupmenu__label').first().textContent();
const menuStatus = (page: Page, index: number): Promise<string | null> => page.locator(PM + '.popupmenu-status').nth(index).textContent();

scenario('PopupMenu: hovering a row fills it with Primary and a pressed row drops 1px', 'PopupMenu', async (page) => {
	const copy = row(page, 'Copy');
	assert.equal(await fill(copy), CLEAR);
	await pointAt(page, copy);
	await paints(page, copy, 'primary');
	assert.equal(await prop(copy, 'padding-top'), '3px');
	await hold(page);
	assert.equal(await prop(copy, 'padding-top'), '4px');
	assert.equal(await prop(copy, 'padding-bottom'), '2px');
	await release(page);
	assert.equal(await prop(copy, 'padding-top'), '3px');
	assert.equal(await menuStatus(page, 1), 'Activated: Copy');
	await away(page);
	assert.equal(await fill(copy), CLEAR);
});

scenario('PopupMenu: arrow keys highlight, skip the disabled row and wrap, Home and End jump', 'PopupMenu', async (page) => {
	await menu(page, 0).focus();
	await tap(page, 'ArrowDown');
	assert.equal(await currentLabel(page, 0), 'Show Grid');
	await paints(page, current(page, 0), 'primary');
	await tap(page, 'End');
	assert.equal(await currentLabel(page, 0), 'Top');
	await tap(page, 'ArrowDown');
	assert.equal(await currentLabel(page, 0), 'Show Grid');
	await tap(page, 'ArrowUp');
	assert.equal(await currentLabel(page, 0), 'Top');
	assert.equal(await page.locator(PM + '.popupmenu__row--hover').count(), 1);
	await tap(page, 'Home');
	assert.equal(await currentLabel(page, 0), 'Show Grid');
});

scenario('PopupMenu: Enter and Space activate, checkmarks toggle, radios pick one and the caption names the pick', 'PopupMenu', async (page) => {
	const grid = row(page, 'Show Grid');
	const bounds = row(page, 'Show Bounds');
	await menu(page, 0).focus();
	await tap(page, 'ArrowDown');
	await attr(grid, 'aria-checked', 'false');
	await seen(grid.locator('.popupmenu__tick'), false);
	await tap(page, 'Enter');
	await attr(grid, 'aria-checked', 'true');
	await seen(grid.locator('.popupmenu__tick'), true);
	assert.equal(await menuStatus(page, 0), 'Activated: Show Grid (checked)');
	await tap(page, 'ArrowDown', 'Space');
	await attr(bounds, 'aria-checked', 'false');
	assert.equal(await menuStatus(page, 0), 'Activated: Show Bounds (unchecked)');
	await tap(page, 'End', 'Enter');
	await attr(row(page, 'Top'), 'aria-checked', 'true');
	await attr(row(page, 'Perspective'), 'aria-checked', 'false');
	await paints(page, row(page, 'Top').locator('.popupmenu__radio'), 'white');
	await row(page, 'Perspective').click();
	await attr(row(page, 'Perspective'), 'aria-checked', 'true');
	await attr(row(page, 'Top'), 'aria-checked', 'false');
	await row(page, 'Reset Layout').click({ force: true });
	assert.equal(await menuStatus(page, 0), 'Activated: Perspective (selected)');
});

scenario('PopupMenu: Right opens the submenu and enters it, Left closes it, separators and disabled rows are skipped', 'PopupMenu', async (page) => {
	const saveAs = row(page, 'Save As');
	const sub = saveAs.locator('.popupmenu__sub');
	await menu(page, 1).focus();
	await tap(page, 'ArrowDown', 'ArrowDown', 'ArrowDown');
	assert.equal(await currentLabel(page, 1), 'Save As');
	await seen(sub, false);
	await tap(page, 'ArrowRight');
	await seen(sub, true);
	await attr(saveAs, 'aria-expanded', 'true');
	await paints(page, saveAs, 'primary');
	assert.equal(await currentLabel(page, 1), 'Asset...');
	await tap(page, 'ArrowDown');
	assert.equal(await currentLabel(page, 1), 'Copy Path');
	await tap(page, 'ArrowDown');
	assert.equal(await currentLabel(page, 1), 'Asset...');
	await tap(page, 'Enter');
	assert.equal(await menuStatus(page, 1), 'Activated: Asset...');
	await tap(page, 'ArrowLeft');
	await seen(sub, false);
	assert.equal(await currentLabel(page, 1), 'Save As');
	await tap(page, 'ArrowRight');
	await seen(sub, true);
	await tap(page, 'Escape');
	await seen(sub, false);
	await tap(page, 'ArrowDown');
	assert.equal(await currentLabel(page, 1), 'Delete');
});

scenario('PopupMenu: hovering a submenu row opens its submenu and it stays open while the pointer is inside', 'PopupMenu', async (page) => {
	const saveAs = row(page, 'Save As');
	const sub = saveAs.locator('.popupmenu__sub');
	await pointAt(page, saveAs.locator('.popupmenu__label').first());
	await seen(sub, true);
	const firstSubRow = sub.locator('.popupmenu__row').first();
	await pointAt(page, firstSubRow);
	await seen(sub, true);
	await paints(page, firstSubRow, 'primary');
	await paints(page, saveAs, 'primary');
	await pointAt(page, row(page, 'Copy'));
	await seen(sub, false);
});

scenario('PopupMenu: pinned menus stay plain HTML and ignore the pointer', 'PopupMenu', async (page) => {
	const pinned = page.locator('.popupmenu[data-pinned]');
	assert.equal(await pinned.count(), 2);
	assert.equal(await pinned.first().evaluate((el) => el.closest('ue-popup-menu')), null);
	assert.equal(await prop(pinned.first(), 'pointer-events'), 'none');
});

// ---------- Notification ----------

const NT = 'ue-notification ';
const toastCount = (page: Page): Promise<number> => page.locator(NT + '.notification').count();
const stackHeight = async (page: Page): Promise<number> => (await page.locator(NT + '.notification-stack').boundingBox())?.height ?? 0;
const toastTitles = (page: Page): Promise<string[]> => page.locator(NT + '.notification__title').allTextContents();
const toastGone = (page: Page, remaining: number): Promise<unknown> => page.waitForFunction((n) => document.querySelectorAll('ue-notification .notification').length === n, remaining);

scenario('Notification: Dismiss removes the toast and the stack closes up', 'Notification', async (page) => {
	assert.equal(await toastCount(page), 1);
	assert.ok((await stackHeight(page)) > 60);
	await page.locator(NT + '.notification__btn[data-action="dismiss"]').click();
	await toastGone(page, 0);
	assert.equal(await stackHeight(page), 0);
});

scenario('Notification: Show notification adds toasts and dismissing one collapses its height out of the stack', 'Notification', async (page) => {
	const show = page.locator(NT + '[data-action="show"]');
	await show.click();
	await show.click();
	await wait(page, 350);
	assert.equal(await toastCount(page), 3);
	assert.deepEqual(await toastTitles(page), ['Saved 2 assets', 'Saved 1 asset', 'Import failed']);
	const full = await stackHeight(page);
	await page.locator(NT + '.notification').nth(0).locator('[data-action="dismiss"]').click();
	await toastGone(page, 2);
	const less = await stackHeight(page);
	assert.ok(full - less > 40, 'the stack shrank from ' + full + ' to ' + less);
	assert.deepEqual(await toastTitles(page), ['Saved 1 asset', 'Import failed']);
});

scenario('Notification: buttons have hover, pressed and focus looks and Retry edits the sub text', 'Notification', async (page) => {
	const retry = page.locator(NT + '[data-action="retry"]');
	const sub = page.locator(NT + '.notification__sub');
	await paints(page, retry, 'secondary');
	await pointAt(page, retry);
	await paints(page, retry, 'hover');
	await hold(page);
	await paints(page, retry, 'header');
	assert.equal(await prop(retry, 'padding-top'), '4.5px');
	await release(page);
	assert.equal(await sub.textContent(), 'Chair.fbx could not be read. Retried 1 time.');
	await away(page);
	await retry.focus();
	await tap(page, 'Shift+Tab', 'Tab');
	await outlineIs(page, retry, 'primary');
	await tap(page, 'Enter');
	assert.equal(await sub.textContent(), 'Chair.fbx could not be read. Retried 2 times.');
});

scenario('Notification: a dismissed toast can be brought back with Show notification', 'Notification', async (page) => {
	await page.locator(NT + '[data-action="dismiss"]').click();
	await toastGone(page, 0);
	await page.locator(NT + '[data-action="show"]').click();
	await wait(page, 300);
	assert.equal(await toastCount(page), 1);
	await paints(page, page.locator(NT + '.notification'), 'notifications');
	assert.equal(await page.locator('.notification[data-pinned]').count(), 3);
});

// ---------- ExpandableArea ----------

const EA = 'ue-expandable-area ';
const area = (page: Page, index: number): Locator => page.locator(EA + '.expandablearea').nth(index);

scenario('ExpandableArea: a click toggles the body and turns the caret', 'ExpandableArea', async (page) => {
	const closed = area(page, 0);
	const header = closed.locator('.expandablearea__header');
	const body = closed.locator('.expandablearea__body');
	const caret = closed.locator('.expandablearea__caret');
	await attr(header, 'aria-expanded', 'false');
	await seen(body, false);
	assert.equal(await prop(caret, 'transform'), 'none');
	await header.click();
	await attr(header, 'aria-expanded', 'true');
	await seen(body, true);
	await wait(page, 250);
	assert.equal(await prop(caret, 'transform'), 'matrix(0, 1, -1, 0, 0, 0)');
	await header.click();
	await seen(body, false);
	await wait(page, 250);
	assert.equal(await prop(caret, 'transform'), 'none');
});

scenario('ExpandableArea: Enter and Space toggle the focused header and it shows the focus ring', 'ExpandableArea', async (page) => {
	const header = area(page, 1).locator('.expandablearea__header');
	const body = area(page, 1).locator('.expandablearea__body');
	await seen(body, true);
	await tap(page, 'Tab', 'Tab');
	assert.equal(await isFocused(header), true);
	await inks(page, header, 'outline-color', 'primary');
	await tap(page, 'Enter');
	await seen(body, false);
	await attr(header, 'aria-expanded', 'false');
	await tap(page, 'Space');
	await seen(body, true);
});

scenario('ExpandableArea: the panel keeps its Panel fill and the header has no hover fill', 'ExpandableArea', async (page) => {
	const panel = area(page, 0);
	const header = panel.locator('.expandablearea__header');
	await paints(page, panel, 'panel');
	await pointAt(page, header);
	assert.equal(await fill(header), CLEAR);
	await paints(page, panel, 'panel');
	assert.equal(await page.locator('.expandablearea[data-pinned]').count(), 2);
});

