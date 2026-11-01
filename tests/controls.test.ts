/// <reference lib="dom" />
// Interaction tests for the controls group: Button, ComboButton, Checkbox, TextInput, SpinBox, Slider, Tooltip, PopupMenu, Notification, ExpandableArea, ResetToDefault.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { Locator, Page } from 'playwright';
import { root } from './lib.ts';
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
	const expected = await token(page, name);
	await settled(() => fill(target), expected);
	assert.equal(await fill(target), expected, 'fill should be ' + name);
}

// Waits up to one second for a computed style to reach its value, because a hover change lands a frame after the pointer moves.
async function settled(read: () => Promise<string>, expected: string): Promise<void> {
	for (let attempt = 0; attempt < 20 && (await read()) !== expected; attempt++) await new Promise((done) => setTimeout(done, 50));
}

// Checks that one computed property is the named token colour.
async function inks(page: Page, target: Locator, property: string, name: string): Promise<void> {
	const expected = await token(page, name);
	await settled(() => prop(target, property), expected);
	assert.equal(await prop(target, property), expected, property + ' should be ' + name);
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

// Records the detail of every event of one type that reaches the document. Object values (such as a row element) are left out.
async function record(page: Page, type: string): Promise<void> {
	await page.evaluate((t) => {
		const store = window as unknown as { __events?: Record<string, unknown[]> };
		const log: unknown[] = [];
		(store.__events ??= {})[t] = log;
		document.addEventListener(t, (event) => {
			const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
			log.push(Object.fromEntries(Object.entries(detail).filter(([, value]) => typeof value !== 'object' || value === null)));
		});
	}, type);
}

const events = (page: Page, type: string): Promise<Array<Record<string, unknown>>> =>
	page.evaluate((t) => (window as unknown as { __events: Record<string, Array<Record<string, unknown>>> }).__events[t], type);

// ---------- one element, one control ----------

const SINGLE: Array<[string, string, string]> = [
	['Button', 'ue-button', '.button'],
	['Checkbox', 'ue-checkbox', '.checkbox, .checkbox-toggle'],
	['ComboButton', 'ue-combo-button', '.combobutton'],
	['PopupMenu', 'ue-popup-menu', '.popupmenu[tabindex]'],
	['TextInput', 'ue-text-input', '.textinput'],
	['SpinBox', 'ue-spin-box', '.spinbox'],
	['Slider', 'ue-slider', '.slider'],
	['Tooltip', 'ue-tooltip', '.tooltip-popup'],
	['ExpandableArea', 'ue-expandable-area', '.expandablearea'],
	['ResetToDefault', 'ue-reset-to-default', '.resettodefault'],
];

for (const [name, tag, control] of SINGLE) {
	scenario(name + ': every ' + tag + ' wraps exactly one control and no preview glyph depends on an svg symbol', name, async (page) => {
		const counts = await page.$$eval(tag, (hosts, selector) => hosts.map((host) => host.querySelectorAll(selector).length), control);
		assert.ok(counts.length > 0, 'a ' + tag + ' in the preview');
		assert.deepEqual(counts.filter((count) => count !== 1), [], 'controls per element: ' + counts.join(','));
		assert.equal(await page.locator('symbol, use').count(), 0, 'the preview has no symbol or use element');
	});
}

// The control CSS lives in the component. A preview style may hold only demo layout.
const CONTROL_CLASS = /\.(button|checkbox|checkbox-toggle|combobutton|combobutton-anchor|combobutton-menu|popupmenu|textinput|spinbox|slider|tooltip|expandablearea|resettodefault)(__[a-z-]+|--[a-z-]+)?\s*[,{:[>+~.]|(^|[}\n])\s*\[data-pinned\]\s*\{/;
for (const [name] of SINGLE) {
	test(name + ': the preview style holds no control rule', () => {
		const html = fs.readFileSync(path.join(root, 'components', name, 'preview.html'), 'utf8');
		const styles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), (m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
		const hit = CONTROL_CLASS.exec(styles);
		assert.equal(hit, null, 'a control rule in the preview style: ' + hit?.[0]);
	});
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

scenario('Button: clicks emit ue-button-click per instance, a disabled button does not', 'Button', async (page) => {
	const status = page.locator('.button-count');
	assert.equal(await status.textContent(), 'Last click: none yet');
	await record(page, 'ue-button-click');
	await page.locator(BTN).nth(0).click();
	await page.locator(BTN).nth(1).click();
	await page.locator(BTN).nth(4).click();
	await page.locator(BTN).nth(0).click();
	assert.deepEqual(await events(page, 'ue-button-click'), [
		{ label: 'Import', pressed: null, count: 1 },
		{ label: 'Create', pressed: null, count: 1 },
		{ label: 'Settings', pressed: null, count: 1 },
		{ label: 'Import', pressed: null, count: 2 },
	]);
	assert.equal(await status.textContent(), 'Last click: Import');
	const disabled = page.locator(BTN).nth(5);
	assert.equal(await disabled.isDisabled(), true);
	await disabled.click({ force: true });
	assert.equal((await events(page, 'ue-button-click')).length, 4);
	assert.equal(await prop(disabled, 'opacity'), '0.45');
});

scenario('Button: Space and Enter press the focused button, with the pressed look while held', 'Button', async (page) => {
	await record(page, 'ue-button-click');
	const plain = page.locator(BTN).nth(0);
	await plain.focus();
	await page.keyboard.down(' ');
	await cls(plain, 'button--pressed', true);
	await paints(page, plain, 'header');
	assert.equal(await prop(plain, 'padding-top'), '4.5px');
	await cls(page.locator(BTN).nth(1), 'button--pressed', false);
	await page.keyboard.up(' ');
	await cls(plain, 'button--pressed', false);
	assert.equal((await events(page, 'ue-button-click')).length, 1);
	await tap(page, 'Enter');
	assert.deepEqual((await events(page, 'ue-button-click')).map((e) => e.count), [1, 2]);
});

scenario('Button: a role=button element presses with Enter and Space too', 'Button', async (page) => {
	await record(page, 'ue-button-click');
	const span = page.locator('ue-button span.button');
	await span.focus();
	await tap(page, 'Enter');
	await page.keyboard.down(' ');
	await cls(span, 'button--pressed', true);
	await page.keyboard.up(' ');
	assert.deepEqual((await events(page, 'ue-button-click')).map((e) => e.count), [1, 2]);
});

scenario('Button: a toggle flips aria-pressed, fills Primary while on and reports the new state', 'Button', async (page) => {
	await record(page, 'ue-button-click');
	const snap = page.locator('ue-button .button--toggle').nth(0);
	const grid = page.locator('ue-button .button--toggle').nth(1);
	assert.equal(await fill(snap), CLEAR);
	await attr(grid, 'aria-pressed', 'true');
	await paints(page, grid, 'primary');
	await snap.click();
	await away(page);
	await attr(snap, 'aria-pressed', 'true');
	await paints(page, snap, 'primary');
	await inks(page, snap, 'color', 'foreground-hover');
	await pointAt(page, snap);
	await paints(page, snap, 'primary-hover');
	await hold(page);
	await paints(page, snap, 'dropdown');
	assert.equal(await prop(snap, 'padding-top'), '3px');
	await release(page);
	await attr(snap, 'aria-pressed', 'false');
	assert.deepEqual(await events(page, 'ue-button-click'), [
		{ label: 'Snap', pressed: true, count: 1 },
		{ label: 'Snap', pressed: false, count: 2 },
	]);
});

scenario('Button: icon-only pads 3px 4px, the small variant is 22px high with 14px sides', 'Button', async (page) => {
	const icon = page.locator(BTN).nth(4);
	assert.equal(await prop(icon, 'padding-left'), '4px');
	assert.equal(await prop(icon, 'padding-top'), '3px');
	assert.equal(await prop(icon, 'border-top-left-radius'), '4px');
	const small = page.locator('ue-button .button--small');
	assert.equal(await prop(small, 'padding-left'), '14px');
	assert.equal((await small.boundingBox())?.height, 22);
	await pointAt(page, small);
	await hold(page);
	assert.equal(await prop(small, 'padding-top'), '1px');
	assert.equal((await small.boundingBox())?.height, 22);
	await release(page);
});

scenario('Button: Tab shows the Primary focus ring', 'Button', async (page) => {
	await tap(page, 'Tab');
	const first = page.locator(BTN).nth(0);
	assert.equal(await isFocused(first), true);
	await outlineIs(page, first, 'primary');
});

scenario('Button: pinned specimens ignore the pointer and sit in a pinned ue-button', 'Button', async (page) => {
	const pinned = page.locator('[data-pinned] .button--hover').first();
	assert.equal(await prop(pinned, 'pointer-events'), 'none');
	assert.equal(await pinned.evaluate((el) => el.closest('ue-button')?.hasAttribute('data-pinned')), true);
	await paints(page, pinned, 'hover');
});

// ---------- ComboButton ----------

const CB = 'ue-combo-button ';
const cbTrigger = (page: Page, index: number): Locator => page.locator('ue-combo-button').nth(index).locator('.combobutton');
const cbMenu = (page: Page, index: number): Locator => page.locator('ue-combo-button').nth(index).locator('.combobutton-menu');
const cbRows = (page: Page, index: number): Locator => cbMenu(page, index).locator('.popupmenu__row');
const cbLabel = (trigger: Locator): Promise<string | null> => trigger.locator('.combobutton__label').textContent();
const cbStatus = (page: Page): Promise<string | null> => page.locator('.combobutton-status').textContent();

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
	await cbRows(page, 0).nth(2).click();
	await seen(menu, false);
	assert.equal(await cbLabel(trigger), 'Scale');
	assert.equal(await cbStatus(page), 'Picked: Scale');
	await attr(trigger, 'aria-expanded', 'false');
	assert.equal(await prop(trigger, 'padding-top'), '1px');
	assert.equal(await isFocused(trigger), true);
});

scenario('ComboButton: the panel is a ue-popup-menu and the picked row is marked selected', 'ComboButton', async (page) => {
	assert.equal(await cbMenu(page, 0).locator('ue-popup-menu > .popupmenu[role="menu"]').count(), 1);
	const rows = cbRows(page, 0);
	await attr(rows.nth(0), 'aria-selected', 'true');
	await cbTrigger(page, 0).click();
	await rows.nth(1).click();
	await attr(rows.nth(0), 'aria-selected', 'false');
	await attr(rows.nth(1), 'aria-selected', 'true');
	assert.equal(await cbLabel(cbTrigger(page, 0)), 'Rotation');
});

scenario('ComboButton: hovering a row fills it with Primary, hovering the button lights its outline', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 0);
	await outlineIs(page, trigger, 'input-outline');
	await pointAt(page, trigger);
	await outlineIs(page, trigger, 'hover');
	await trigger.click();
	const rows = cbRows(page, 0);
	assert.equal(await fill(rows.nth(1)), CLEAR);
	await pointAt(page, rows.nth(1));
	await paints(page, rows.nth(1), 'primary');
	await cls(rows.nth(1), 'popupmenu__row--hover', true);
});

scenario('ComboButton: the keyboard opens with Down, arrows move, Enter picks, Escape cancels', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 0);
	const menu = cbMenu(page, 0);
	const rows = cbRows(page, 0);
	await trigger.focus();
	await tap(page, 'ArrowDown');
	await seen(menu, true);
	await cls(rows.nth(0), 'popupmenu__row--hover', true);
	await tap(page, 'ArrowDown', 'ArrowDown');
	await cls(rows.nth(2), 'popupmenu__row--hover', true);
	await paints(page, rows.nth(2), 'primary');
	await tap(page, 'ArrowDown');
	await cls(rows.nth(0), 'popupmenu__row--hover', true);
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
	await cls(rows.nth(2), 'popupmenu__row--hover', true);
	await tap(page, 'Escape', 'ArrowUp');
	await seen(menu, true);
	await tap(page, 'Escape');
	await tap(page, 'ArrowUp');
	await cls(rows.nth(2), 'popupmenu__row--hover', true);
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
	await cbRows(page, 1).nth(1).click();
	assert.equal(await cbLabel(simple), 'Settings');
	assert.equal(await cbStatus(page), 'Picked: Project Settings');
	const disabled = page.locator('.combobutton[aria-disabled="true"]');
	assert.equal(await prop(disabled, 'opacity'), '0.45');
	await outlineIs(page, disabled, 'input-outline');
	await pointAt(page, disabled);
	await outlineIs(page, disabled, 'input-outline');
	await disabled.click({ force: true });
	assert.equal(await page.locator(CB + '.combobutton-menu:not([hidden])').count(), 0);
});

scenario('ComboButton: ue-combo-pick reports the value, label and check state of the row', 'ComboButton', async (page) => {
	await record(page, 'ue-combo-pick');
	await cbTrigger(page, 0).click();
	await cbRows(page, 0).nth(1).click();
	await cbTrigger(page, 1).click();
	await cbRows(page, 1).nth(2).click();
	assert.deepEqual(await events(page, 'ue-combo-pick'), [
		{ value: 'Rotation', label: 'Rotation', checked: null },
		{ value: 'Plugins', label: 'Plugins', checked: false },
	]);
	await attr(cbRows(page, 1).nth(2), 'aria-checked', 'false');
	assert.equal(await cbLabel(cbTrigger(page, 1)), 'Settings');
});

scenario('ComboButton: mode=action keeps the label of a boxed trigger, the button look is 22px high', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 4);
	assert.equal((await trigger.boundingBox())?.height, 22);
	await paints(page, trigger, 'secondary');
	await pointAt(page, trigger);
	await paints(page, trigger, 'hover');
	await trigger.click();
	await cbRows(page, 4).nth(1).click();
	assert.equal(await cbLabel(trigger), 'Add');
	assert.equal(await cbStatus(page), 'Picked: Camera');
});

scenario('ComboButton: the icon-only trigger has no label, no fill at rest and Dropdown on hover', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 2);
	assert.equal(await trigger.locator('.combobutton__label').count(), 0);
	assert.equal(await fill(trigger), CLEAR);
	await pointAt(page, trigger);
	await paints(page, trigger, 'dropdown');
	await trigger.click();
	await cbRows(page, 2).nth(1).click();
	assert.equal(await cbStatus(page), 'Picked: Sphere');
	assert.equal(await trigger.locator('.combobutton__label').count(), 0);
});

scenario('ComboButton: the small variant is 22px high at 10.667px and still follows the pick', 'ComboButton', async (page) => {
	const trigger = cbTrigger(page, 3);
	assert.equal((await trigger.boundingBox())?.height, 22);
	assert.ok(Math.abs(parseFloat(await prop(trigger, 'font-size')) - 10.667) < 0.01);
	await trigger.click();
	await cbRows(page, 3).nth(1).click();
	assert.equal(await cbLabel(trigger), 'OverlapAll');
	assert.ok(Math.abs(parseFloat(await prop(cbRows(page, 3).first().locator('.popupmenu__label'), 'font-size')) - 10.667) < 0.01);
});

scenario('ComboButton: the panel aligns to the start by default and to the end with the end modifier', 'ComboButton', async (page) => {
	const start = cbTrigger(page, 0);
	await start.click();
	const startTrigger = await start.boundingBox();
	const startPanel = await cbMenu(page, 0).boundingBox();
	assert.ok(startTrigger && startPanel);
	assert.ok(Math.abs(startPanel.x - startTrigger.x) < 1, 'panel starts at the trigger');
	assert.ok(Math.abs(startPanel.y - (startTrigger.y + startTrigger.height)) < 1, 'panel sits below the trigger');
	const end = cbTrigger(page, 5);
	await end.click();
	const endTrigger = await end.boundingBox();
	const endPanel = await cbMenu(page, 5).boundingBox();
	assert.ok(endTrigger && endPanel);
	assert.ok(endPanel.width > endTrigger.width, 'the panel is wider than the trigger');
	assert.ok(Math.abs(endPanel.x + endPanel.width - (endTrigger.x + endTrigger.width)) < 1, 'panel ends at the trigger');
});

scenario('ComboButton: the panel minimum width follows --combobutton-menu-min-width', 'ComboButton', async (page) => {
	await cbTrigger(page, 1).click();
	const panel = await cbMenu(page, 1).boundingBox();
	assert.ok(panel);
	assert.ok(panel.width >= 200, 'panel width ' + panel.width);
	const trigger = await cbTrigger(page, 1).boundingBox();
	assert.ok(trigger && trigger.width < 200);
});

interface ComboApi {
	open(keys?: boolean, fromEnd?: boolean): void;
	close(refocus?: boolean): void;
	isOpen: boolean;
}

scenario('ComboButton: open() and close() drive the panel, mode=value gives a simple trigger value mode, --up opens above', 'ComboButton', async (page) => {
	await page.evaluate(() => {
		const holder = document.createElement('div');
		holder.style.cssText = 'position:absolute;left:40px;top:420px';
		holder.innerHTML = '<ue-combo-button mode="value" id="vm"><div class="combobutton-anchor"><span class="combobutton combobutton--simple" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false"><span class="combobutton__label">Cmd</span></span><div class="combobutton-menu combobutton-menu--up" hidden><ue-popup-menu><div class="popupmenu" role="menu" tabindex="0"><div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">Cmd</span></span></div><div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">Python</span></span></div></div></ue-popup-menu></div></div></ue-combo-button>';
		document.body.append(holder);
	});
	const host = page.locator('#vm');
	const trigger = host.locator('.combobutton');
	const menu = host.locator('.combobutton-menu');
	const isOpen = (): Promise<boolean> => host.evaluate((el) => (el as unknown as ComboApi).isOpen);
	assert.equal(await isOpen(), false);
	await host.evaluate((el) => (el as unknown as ComboApi).open());
	await seen(menu, true);
	await attr(trigger, 'aria-expanded', 'true');
	await cls(trigger, 'combobutton--open', true);
	assert.equal(await isOpen(), true);
	const triggerBox = await trigger.boundingBox();
	const menuBox = await menu.boundingBox();
	assert.ok(triggerBox && menuBox && menuBox.y + menuBox.height <= triggerBox.y + 1, 'the --up panel sits above the trigger');
	await host.evaluate((el) => (el as unknown as ComboApi).close());
	await seen(menu, false);
	assert.equal(await isOpen(), false);
	await trigger.click();
	await menu.locator('.popupmenu__row').nth(1).click();
	assert.equal(await cbLabel(trigger), 'Python', 'a simple trigger in value mode follows the pick');
});

scenario('Button and ComboButton: the toolbar, plate, status, menubar and wide variants carry their own metrics', 'ComboButton', async (page) => {
	await page.evaluate(() => {
		const holder = document.createElement('div');
		holder.style.cssText = 'position:absolute;left:40px;top:480px;color:rgb(10, 20, 30)';
		const icon = '<svg class="button__icon button__icon--solo" viewBox="0 0 16 16"><path d="M3 3h10v10H3z"/></svg>';
		holder.innerHTML = '<button class="button button--simple button--toolbar" id="tb">' + icon + '</button>'
			+ '<button class="button button--simple button--toolbar button--pressed" id="tbp">' + icon + '</button>'
			+ '<button class="button button--toggle button--toolbar button--pressed" id="tbt">' + icon + '</button>'
			+ '<button class="button button--plate" id="pl">' + icon + '</button>'
			+ '<button class="button button--plate" id="pld" disabled>' + icon + '</button>'
			+ '<button class="button button--status" id="st">' + icon + 'Drawer</button>'
			+ '<button class="button button--status" id="sto" aria-pressed="true">' + icon + 'Drawer</button>'
			+ '<span class="combobutton combobutton--menubar" id="mb"><span class="combobutton__label">File</span></span>'
			+ '<span class="combobutton combobutton--menubar combobutton--open" id="mbo"><span class="combobutton__label">File</span></span>'
			+ '<span class="combobutton combobutton--toolbar" id="ct"><svg class="combobutton__icon" viewBox="0 0 16 16"><path d="M3 3h10v10H3z"/></svg></span>'
			+ '<span class="combobutton combobutton--simple combobutton--wide" id="cw"><span class="combobutton__label">Derived Data</span></span>';
		document.body.append(holder);
	});
	const at = (id: string): Locator => page.locator('#' + id);
	assert.equal(await prop(at('tb'), 'padding-top'), '4px');
	assert.equal(await prop(at('tb'), 'padding-left'), '8px');
	assert.equal(await prop(at('tb').locator('svg'), 'width'), '20px');
	assert.equal(await prop(at('tbp'), 'padding-top'), '5px');
	assert.equal(await prop(at('tbp'), 'padding-bottom'), '3px');
	assert.equal(await prop(at('tbt'), 'padding-top'), '4px', 'a toggle does not shift when pressed');
	assert.equal(await fill(at('pl')), CLEAR);
	assert.equal(await prop(at('pl'), 'color'), 'rgb(10, 20, 30)', 'a plate button takes the foreground of its plate');
	assert.equal(await prop(at('pld'), 'opacity'), '1', 'the plate owns the disabled alpha');
	assert.equal(await prop(at('st'), 'padding-top'), '4px');
	assert.equal(await prop(at('sto'), 'padding-top'), '5px');
	assert.equal(await prop(at('sto'), 'color'), await token(page, 'foreground-hover'));
	assert.equal(await fill(at('sto')), CLEAR, 'an open drawer has no fill');
	assert.equal(await prop(at('mb'), 'padding-left'), '12px');
	assert.equal(await prop(at('mb'), 'padding-top'), '4px');
	assert.equal(await fill(at('mb')), CLEAR);
	assert.equal(await fill(at('mbo')), await token(page, 'primary'));
	assert.equal(await prop(at('ct'), 'padding-left'), '8px');
	assert.equal(await prop(at('ct').locator('svg'), 'width'), '20px');
	assert.equal(await prop(at('cw'), 'padding-left'), '10px');
});

scenario('ComboButton: a combo button inside another primitive acts on its own control only', 'ExpandableArea', async (page) => {
	if (process.env.UE_MODE === 'modules') await page.addScriptTag({ type: 'module', url: '/components/ComboButton/ComboButton.js' });
	await page.waitForFunction(() => customElements.get('ue-combo-button') !== undefined);
	await page.evaluate(() => {
		const body = document.querySelectorAll('ue-expandable-area:not([data-pinned], [data-pinned] *) .expandablearea__body')[1];
		const row = document.createElement('div');
		row.innerHTML = '<ue-combo-button><div class="combobutton-anchor"><span class="combobutton combobutton--small" role="combobox" tabindex="0" aria-expanded="false"><span class="combobutton__label">One</span><svg class="combobutton__arrow" viewBox="0 0 16 16"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg></span><div class="combobutton-menu" hidden><ue-popup-menu><div class="popupmenu popupmenu--combo" role="menu" tabindex="0"><div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">One</span></span></div><div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">Two</span></span></div></div></ue-popup-menu></div></div></ue-combo-button>';
		body.append(row);
	});
	await record(page, 'ue-expand-toggle');
	const nested = page.locator('ue-expandable-area ue-combo-button');
	await nested.locator('.combobutton').click();
	await seen(nested.locator('.combobutton-menu'), true);
	await nested.locator('.popupmenu__row').nth(1).click();
	assert.equal(await nested.locator('.combobutton__label').textContent(), 'Two');
	await seen(nested.locator('.combobutton-menu'), false);
	await attr(area(page, 1).locator('.expandablearea__header'), 'aria-expanded', 'true');
	assert.deepEqual(await events(page, 'ue-expand-toggle'), []);
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
	assert.equal(await page.locator('.checkbox-status').textContent(), 'Last change: Simulate Physics is checked');
	await box.click();
	await attr(box, 'aria-checked', 'false');
	await attr(ck(page, 'Enable Gravity'), 'aria-checked', 'true');
});

scenario('Checkbox: ue-checkbox-change reports label, state and checked per control', 'Checkbox', async (page) => {
	await record(page, 'ue-checkbox-change');
	await ck(page, 'Simulate Physics').click();
	await ck(page, 'Show All').click();
	await ck(page, 'Physics').click();
	await page.locator(CK + '[aria-label="Visible"]').click();
	assert.deepEqual(await events(page, 'ue-checkbox-change'), [
		{ label: 'Simulate Physics', state: 'checked', checked: true, text: 'Simulate Physics is checked' },
		{ label: 'Show All', state: 'unchecked', checked: false, text: 'Show All is unchecked' },
		{ label: 'Physics', state: 'on', checked: true, text: 'Physics is on' },
		{ label: 'Visible', state: 'unchecked', checked: false, text: 'Visible is unchecked' },
	]);
});

scenario('Checkbox: the box-only variant has no label, names itself by aria-label and toggles by key', 'Checkbox', async (page) => {
	const box = page.locator(CK + '[aria-label="Visible"]');
	assert.equal(await box.locator('.checkbox__label').count(), 0);
	assert.equal((await box.boundingBox())?.width, 18);
	await seen(box.locator('.checkbox__glyph--check'), true);
	await box.focus();
	await tap(page, 'Space');
	await attr(box, 'aria-checked', 'false');
	await seen(box.locator('.checkbox__glyph--check'), false);
	await tap(page, 'Enter');
	await attr(box, 'aria-checked', 'true');
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

scenario('TextInput: ue-text-input reports every edit and ue-text-clear the search clear', 'TextInput', async (page) => {
	await record(page, 'ue-text-input');
	await record(page, 'ue-text-clear');
	const field = tiBox(page, 3).locator('input');
	await field.click();
	await page.keyboard.type('ab');
	assert.deepEqual(await events(page, 'ue-text-input'), [{ value: 'a' }, { value: 'ab' }]);
	assert.equal(await page.locator('.textinput-cap', { hasText: 'Value:' }).textContent(), 'Value: ab');
	await tiBox(page, 3).locator('.textinput__clear').click();
	assert.deepEqual(await events(page, 'ue-text-input'), [{ value: 'a' }, { value: 'ab' }, { value: '' }]);
	assert.equal((await events(page, 'ue-text-clear')).length, 1);
	await page.keyboard.type('x');
	await tap(page, 'Escape');
	assert.equal((await events(page, 'ue-text-clear')).length, 2);
	assert.equal((await events(page, 'ue-text-input')).at(-1)?.value, '');
});

scenario('TextInput: the trailing slot sits inside the field and a click on it does not take the focus', 'TextInput', async (page) => {
	const box = tiBox(page, 4);
	const button = box.locator('.textinput__trail .textinput-trail-btn');
	const boxRect = await box.boundingBox();
	const buttonRect = await button.boundingBox();
	assert.ok(boxRect && buttonRect);
	assert.ok(buttonRect.x > boxRect.x && buttonRect.x + buttonRect.width < boxRect.x + boxRect.width, 'the button sits inside the box');
	await button.click();
	assert.equal(await isFocused(box.locator('input')), false);
	await box.locator('input').click();
	await page.keyboard.type('chair');
	await seen(box.locator('.textinput__trail'), true);
});

scenario('TextInput: the console variant is 12px mono with a 4px radius and Escape does not clear it', 'TextInput', async (page) => {
	const box = tiBox(page, 5);
	const field = box.locator('input');
	assert.equal(await prop(box, 'border-top-left-radius'), '4px');
	assert.equal(await prop(box, 'font-size'), '12px');
	assert.match(await prop(box, 'font-family'), /Roboto Mono/);
	await field.click();
	await page.keyboard.type('stat fps');
	await tap(page, 'Escape');
	assert.equal(await field.inputValue(), 'stat fps');
	await outlineIs(page, box, 'primary');
});

scenario('TextInput: Escape in a plain box leaves the text', 'TextInput', async (page) => {
	const field = tiBox(page, 1).locator('input');
	await field.click();
	await tap(page, 'Escape');
	assert.equal(await field.inputValue(), 'StaticMeshActor');
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

scenario('SpinBox: ue-spin-change reports each change and the status line follows', 'SpinBox', async (page) => {
	await record(page, 'ue-spin-change');
	const box = sbBox(page, 1);
	await box.focus();
	await tap(page, 'ArrowUp', 'ArrowUp');
	assert.deepEqual(await events(page, 'ue-spin-change'), [
		{ value: 41, text: '41.0' },
		{ value: 42, text: '42.0' },
	]);
	assert.equal(await page.locator('.spinbox-status').textContent(), 'Last change: 42.0');
	await tap(page, 'ArrowUp');
	await sbBox(page, 0).focus();
	await tap(page, 'ArrowDown');
	assert.equal(await sbValue(box), 43);
	assert.equal(Math.round((await sbValue(sbBox(page, 0))) * 100) / 100, 0.39);
});

scenario('SpinBox: the unbounded box does not clamp typed values and has no fill', 'SpinBox', async (page) => {
	const box = sbBox(page, 2);
	await cls(box, 'spinbox--unbounded', true);
	await seen(box.locator('.spinbox__fill'), false);
	await box.click();
	await page.keyboard.type('99999');
	await tap(page, 'Enter');
	assert.equal(await sbValue(box), 99999);
	await box.focus();
	await tap(page, 'ArrowUp');
	assert.equal(await sbValue(box), 100009);
	await box.click();
	await page.keyboard.type('-500');
	await tap(page, 'Enter');
	assert.equal(await sbValue(box), -500);
});

scenario('SpinBox: data-step sets the arrow step and data-unit adds a unit suffix', 'SpinBox', async (page) => {
	const axis = sbBox(page, 4);
	await axis.focus();
	await tap(page, 'ArrowUp', 'ArrowUp', 'ArrowDown');
	assert.equal(await sbValue(axis), -209);
	const unit = sbBox(page, 7);
	assert.equal(await unit.locator('.spinbox__unit').textContent(), 'cm');
	assert.equal(await sbText(unit), '90.0');
	await unit.focus();
	await tap(page, 'ArrowUp');
	assert.equal(await sbValue(unit), 95);
	assert.equal(await sbText(unit), '95.0');
	assert.equal(await page.locator('.spinbox-status').textContent(), 'Last change: 95.0 cm');
	const text = await unit.locator('.spinbox__text').boundingBox();
	const suffix = await unit.locator('.spinbox__unit').boundingBox();
	assert.ok(text && suffix && suffix.x >= text.x + text.width - 1, 'the unit follows the value');
});

scenario('SpinBox: the axis strips are the X, Y and Z tokens and the text keeps clear of them', 'SpinBox', async (page) => {
	for (const [index, axis] of [[4, 'x'], [5, 'y'], [6, 'z']] as const) {
		const box = sbBox(page, index);
		const strip = box.locator('.spinbox__axis--' + axis);
		await paints(page, strip, 'axis-' + axis);
		const stripRect = await strip.boundingBox();
		const textRect = await box.locator('.spinbox__text').boundingBox();
		assert.ok(stripRect && textRect);
		assert.equal(stripRect.width, 2);
		const inset = parseFloat(await prop(box.locator('.spinbox__text'), 'padding-left'));
		assert.ok(textRect.x + inset >= stripRect.x + stripRect.width, 'the text starts after the strip');
	}
});

scenario('SpinBox: dragging one box leaves the other boxes alone', 'SpinBox', async (page) => {
	await dragBy(page, sbBox(page, 1), 40);
	assert.equal(await sbValue(sbBox(page, 0)), 0.4);
	assert.equal(await sbValue(sbBox(page, 2)), 1200);
	assert.equal(await sbValue(sbBox(page, 4)), -210);
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

scenario('Slider: ue-slider-change reports value and text, and one slider leaves the others alone', 'Slider', async (page) => {
	await record(page, 'ue-slider-change');
	const el = slider(page, 0);
	await el.focus();
	await tap(page, 'ArrowRight', 'ArrowRight');
	assert.deepEqual(await events(page, 'ue-slider-change'), [
		{ value: 0.51, text: '0.51' },
		{ value: 0.52, text: '0.52' },
	]);
	assert.equal(await slValue(slider(page, 1)), 25);
	assert.equal(await page.locator(SL + '.slider-value').nth(1).textContent(), '25');
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

scenario('Tooltip: any element inside a ue-tooltip is a target and the popup follows the pointer', 'Tooltip', async (page) => {
	if (process.env.UE_MODE === 'modules') await page.waitForFunction(() => customElements.get('ue-tooltip') !== undefined);
	await page.evaluate(() => {
		const host = document.createElement('div');
		host.innerHTML = '<ue-tooltip id="wide"><span id="left" style="display:inline-block;width:60px;height:24px;background:#444">A</span><span id="right" style="display:inline-block;width:60px;height:24px;background:#555">B</span><span class="tooltip tooltip--dark tooltip-popup" role="tooltip" hidden>Wide target</span></ue-tooltip>';
		host.style.cssText = 'position:fixed;left:700px;top:500px';
		document.body.append(host);
	});
	const tip = page.locator('#wide .tooltip-popup');
	const right = await pointAt(page, page.locator('#wide #right'));
	await wait(page, 450);
	await seen(tip, true);
	const box = await tip.boundingBox();
	assert.ok(box);
	assert.ok(Math.abs(box.x - (right.x + 12)) < 1.5, 'near the pointer');
	await pointAt(page, page.locator('#wide #left'));
	await wait(page, 80);
	await seen(tip, true);
	await away(page);
	await wait(page, 80);
	await seen(tip, false);
});

scenario('Tooltip: a tooltip around another tooltip does not show for the inner target', 'Tooltip', async (page) => {
	await page.evaluate(() => {
		const host = document.createElement('div');
		host.innerHTML = '<ue-tooltip id="outer"><span id="plain" style="display:inline-block;width:60px;height:24px">A</span><ue-tooltip id="inner"><span id="inside" style="display:inline-block;width:60px;height:24px">B</span><span class="tooltip tooltip--dark tooltip-popup" role="tooltip" hidden>Inner</span></ue-tooltip><span class="tooltip tooltip--dark tooltip-popup" role="tooltip" hidden>Outer</span></ue-tooltip>';
		host.style.cssText = 'position:fixed;left:700px;top:500px';
		document.body.append(host);
	});
	await pointAt(page, page.locator('#inside'));
	await wait(page, 450);
	await seen(page.locator('#inner .tooltip-popup'), true);
	await seen(page.locator('#outer > .tooltip-popup'), false);
});

scenario('Tooltip: pinned specimens stay visible in a pinned ue-tooltip and the live tooltip starts hidden', 'Tooltip', async (page) => {
	const pinned = page.locator('[data-pinned] .tooltip');
	assert.equal(await pinned.count(), 2);
	await seen(pinned.first(), true);
	assert.equal(await pinned.first().evaluate((el) => el.closest('ue-tooltip')?.hasAttribute('data-pinned')), true);
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

scenario('PopupMenu: ue-menu-activate reports label, role, state and value, and a submenu row only opens', 'PopupMenu', async (page) => {
	await record(page, 'ue-menu-activate');
	await row(page, 'Show Grid').click();
	await row(page, 'Top').click();
	await row(page, 'Copy').click();
	await row(page, 'Save As').click();
	assert.deepEqual(await events(page, 'ue-menu-activate'), [
		{ label: 'Show Grid', role: 'menuitemcheckbox', checked: true, text: 'Show Grid (checked)', value: 'Show Grid' },
		{ label: 'Top', role: 'menuitemradio', checked: true, text: 'Top (selected)', value: 'Top' },
		{ label: 'Copy', role: 'menuitem', checked: null, text: 'Copy', value: 'Copy' },
	]);
});

scenario('PopupMenu: the small variant sets 10.667px rows and each list keeps its own current row', 'PopupMenu', async (page) => {
	const small = menu(page, 2);
	assert.ok(Math.abs(parseFloat(await prop(small.locator('.popupmenu__label').first(), 'font-size')) - 10.667) < 0.01);
	assert.ok(Math.abs(parseFloat(await prop(menu(page, 0).locator('.popupmenu__label').first(), 'font-size')) - 13.333) < 0.01);
	await pointAt(page, row(page, 'SM_Table'));
	assert.equal(await currentLabel(page, 2), 'SM_Table');
	assert.equal(await current(page, 0).count(), 0);
	assert.equal(await current(page, 1).count(), 0);
	await menu(page, 0).focus();
	await tap(page, 'ArrowDown');
	assert.equal(await currentLabel(page, 0), 'Show Grid');
	await row(page, 'SM_Lamp').click();
	assert.equal(await menuStatus(page, 2), 'Activated: SM_Lamp');
	assert.equal(await menuStatus(page, 0), 'Activated: nothing yet');
});

scenario('PopupMenu: pinned menus sit in a pinned ue-popup-menu and ignore the pointer', 'PopupMenu', async (page) => {
	const pinned = page.locator('[data-pinned] .popupmenu');
	assert.equal(await pinned.count(), 2);
	assert.equal(await pinned.first().evaluate((el) => el.closest('ue-popup-menu')?.hasAttribute('data-pinned')), true);
	assert.equal(await prop(pinned.first(), 'pointer-events'), 'none');
});

// ---------- Notification ----------

const NT = 'ue-notification ';
const toastCount = (page: Page): Promise<number> => page.locator(NT + '.notification').count();
const stackHeight = async (page: Page): Promise<number> => (await page.locator(NT + '.notification-stack').boundingBox())?.height ?? 0;
const toastTitles = (page: Page): Promise<string[]> => page.locator(NT + '.notification__title').allTextContents();
const toastGone = (page: Page, remaining: number): Promise<unknown> => page.waitForFunction((n) => document.querySelectorAll('ue-notification:not([data-pinned], [data-pinned] *) .notification').length === n, remaining);

scenario('Notification: Dismiss removes the toast and the stack closes up', 'Notification', async (page) => {
	assert.equal(await toastCount(page), 1);
	assert.ok((await stackHeight(page)) > 60);
	await page.locator(NT + '.button[data-action="dismiss"]').click();
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
	assert.equal(await page.locator('[data-pinned] .notification').count(), 3);
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

scenario('ExpandableArea: ue-expand-toggle reports the new state and each area folds on its own', 'ExpandableArea', async (page) => {
	await record(page, 'ue-expand-toggle');
	await area(page, 0).locator('.expandablearea__header').click();
	await area(page, 1).locator('.expandablearea__header').click();
	assert.deepEqual(await events(page, 'ue-expand-toggle'), [{ expanded: true }, { expanded: false }]);
	assert.equal(await page.locator('.expandablearea-cap', { hasText: 'Expanded:' }).textContent(), 'Expanded: true');
	await attr(area(page, 2).locator('.expandablearea__header'), 'aria-expanded', 'true');
	await seen(area(page, 2).locator('.expandablearea__body'), true);
});

scenario('ExpandableArea: a control inside the header does not fold the area, the rest of the header does', 'ExpandableArea', async (page) => {
	await record(page, 'ue-expand-toggle');
	await record(page, 'ue-button-click');
	const header = area(page, 2).locator('.expandablearea__header');
	const body = area(page, 2).locator('.expandablearea__body');
	await header.locator('.button').click();
	await attr(header, 'aria-expanded', 'true');
	await seen(body, true);
	await header.locator('.button').focus();
	await tap(page, 'Enter', 'Space');
	await attr(header, 'aria-expanded', 'true');
	assert.deepEqual(await events(page, 'ue-expand-toggle'), []);
	assert.equal((await events(page, 'ue-button-click')).length, 3);
	await header.locator('.expandablearea__title').click();
	await attr(header, 'aria-expanded', 'false');
	await seen(body, false);
	assert.deepEqual(await events(page, 'ue-expand-toggle'), [{ expanded: false }]);
});

scenario('ExpandableArea: the panel keeps its Panel fill and the header has no hover fill', 'ExpandableArea', async (page) => {
	const panel = area(page, 0);
	const header = panel.locator('.expandablearea__header');
	await paints(page, panel, 'panel');
	await pointAt(page, header);
	assert.equal(await fill(header), CLEAR);
	await paints(page, panel, 'panel');
	assert.equal(await page.locator('[data-pinned] .expandablearea').count(), 2);
});

// ---------- ResetToDefault ----------

const RD = 'ue-reset-to-default ';
const rdButton = (page: Page, index: number): Locator => page.locator(RD + 'button.resettodefault').nth(index);

scenario('ResetToDefault: the arrow shows while the value differs and an idle arrow keeps its slot invisibly', 'ResetToDefault', async (page) => {
	const live = rdButton(page, 0);
	const idle = rdButton(page, 1);
	await seen(live, true);
	await seen(idle, false);
	assert.equal((await live.boundingBox())?.width, 20);
	assert.equal((await idle.boundingBox())?.width, 20);
	assert.equal((await idle.boundingBox())?.height, 20);
	await cls(idle, 'resettodefault--idle', true);
	assert.equal(await idle.isDisabled(), true);
	assert.equal(await live.isDisabled(), false);
});

scenario('ResetToDefault: a click on the arrow emits ue-reset, an idle arrow cannot', 'ResetToDefault', async (page) => {
	await record(page, 'ue-reset');
	await rdButton(page, 1).click({ force: true });
	assert.deepEqual(await events(page, 'ue-reset'), []);
	await rdButton(page, 0).click();
	assert.deepEqual(await events(page, 'ue-reset'), [{}]);
	assert.equal(await page.locator('.resettodefault-status').textContent(), 'Reset requested');
});

scenario('ResetToDefault: the differs attribute shows or hides the arrow at run time', 'ResetToDefault', async (page) => {
	const host = page.locator('ue-reset-to-default').nth(1);
	const idle = rdButton(page, 1);
	await host.evaluate((el) => el.setAttribute('differs', ''));
	await seen(idle, true);
	assert.equal(await idle.isDisabled(), false);
	await cls(idle, 'resettodefault--idle', false);
	await host.evaluate((el) => el.removeAttribute('differs'));
	await seen(idle, false);
	assert.equal(await idle.isDisabled(), true);
});

scenario('ResetToDefault: Foreground at rest, ForegroundHover on hover, the glyph drops 1px while pressed', 'ResetToDefault', async (page) => {
	const button = rdButton(page, 0);
	await inks(page, button, 'color', 'foreground');
	assert.equal(await prop(button, 'padding-top'), '2px');
	await pointAt(page, button);
	await inks(page, button, 'color', 'foreground-hover');
	await hold(page);
	assert.equal(await prop(button, 'padding-top'), '3px');
	assert.equal(await prop(button, 'padding-bottom'), '1px');
	await release(page);
	assert.equal(await prop(button, 'padding-top'), '2px');
	const glyph = await button.locator('.resettodefault__glyph').boundingBox();
	assert.equal(glyph?.width, 16);
});

scenario('ResetToDefault: Tab reaches the arrow and shows the Primary focus ring', 'ResetToDefault', async (page) => {
	await tap(page, 'Tab');
	const button = rdButton(page, 0);
	assert.equal(await isFocused(button), true);
	await inks(page, button, 'outline-color', 'primary');
});

// ---------- variants the Content Browser needs ----------

scenario('Button: the tight variant keeps 4px sides at rest and pressed', 'Button', async (page) => {
	await page.evaluate(() => {
		const host = document.createElement('ue-button');
		host.id = 'tight';
		host.innerHTML = '<button type="button" class="button button--simple button--tight">Import</button>';
		document.body.append(host);
	});
	const tight = page.locator('#tight .button');
	assert.equal(await prop(tight, 'padding-left'), '4px');
	assert.equal(await prop(tight, 'padding-top'), '3px');
	await tight.hover();
	await hold(page);
	assert.equal(await prop(tight, 'padding-left'), '4px', 'the pressed state keeps the sides');
	assert.equal(await prop(tight, 'padding-top'), '4px', 'and drops the label 1px');
	await release(page);
});

scenario('ComboButton: the Add variant draws its plus icon in AccentGreen', 'ComboButton', async (page) => {
	await page.evaluate(() => {
		const host = document.createElement('ue-combo-button');
		host.id = 'add';
		host.setAttribute('mode', 'action');
		host.innerHTML = '<div class="combobutton-anchor"><span class="combobutton combobutton--button" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false"><svg class="combobutton__icon" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg><span class="combobutton__label">Add</span></span><div class="combobutton-menu" hidden><ue-popup-menu><div class="popupmenu" role="menu" tabindex="0"><div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">New</span></span></div></div></ue-popup-menu></div></div>';
		document.body.append(host);
	});
	const icon = page.locator('#add .combobutton__icon');
	const probe = await page.evaluate(() => {
		const el = document.createElement('i');
		el.style.color = 'var(--accent-green)';
		document.body.append(el);
		return getComputedStyle(el).color;
	});
	assert.equal(await prop(icon, 'color'), probe);
});

scenario('ExpandableArea: the source variant draws the Header block with a recessed body', 'ExpandableArea', async (page) => {
	await page.evaluate(() => {
		const host = document.createElement('ue-expandable-area');
		host.id = 'source';
		host.innerHTML = '<div class="expandablearea expandablearea--source"><div class="expandablearea__header" role="button" tabindex="0" aria-expanded="true"><svg class="expandablearea__caret" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4z"/></svg><span class="expandablearea__title">Sources</span></div><div class="expandablearea__body">Body</div></div>';
		document.body.append(host);
	});
	const area = page.locator('#source .expandablearea');
	assert.equal(await fill(area), await token(page, 'header'));
	assert.equal(await prop(area, 'border-top-left-radius'), '0px');
	assert.equal(await fill(page.locator('#source .expandablearea__body')), await token(page, 'recessed'));
	assert.equal(await prop(page.locator('#source .expandablearea__title'), 'font-weight'), '700');
	assert.equal(await prop(page.locator('#source .expandablearea__title'), 'font-size'), '13.333px');
	assert.equal(Math.round((await page.locator('#source .expandablearea__header').boundingBox())?.height ?? 0), 24);
});

// ---------- Details row additions: small variants and data APIs ----------

scenario('TextInput: the small variant sets the Details row font and nothing else', 'TextInput', async (page) => {
	const small = tiBox(page, 6);
	const normal = tiBox(page, 1);
	assert.equal(await prop(small, 'font-size'), '10.667px');
	assert.equal(await prop(normal, 'font-size'), '13.333px');
	assert.equal(await prop(small, 'padding-top'), await prop(normal, 'padding-top'));
	assert.equal(await prop(small, 'border-top-left-radius'), await prop(normal, 'border-top-left-radius'));
});

scenario('SpinBox: the small variant sets the Details row font, and value redraws the box without an event', 'SpinBox', async (page) => {
	const small = page.locator('ue-spin-box .spinbox--small');
	assert.equal(await prop(small, 'font-size'), '10.667px');
	assert.equal(await prop(sbBox(page, 0), 'font-size'), '13.333px');
	await record(page, 'ue-spin-change');
	const host = page.locator('ue-spin-box').filter({ has: page.locator('.spinbox--small') });
	type Api = HTMLElement & { value: number };
	assert.equal(await host.evaluate((el) => (el as Api).value), 12.5);
	await host.evaluate((el) => { (el as Api).value = 20; });
	assert.equal(await sbValue(small), 20);
	assert.equal(await sbText(small), '20.0');
	assert.equal(await host.evaluate((el) => (el as Api).value), 20);
	assert.deepEqual(await events(page, 'ue-spin-change'), [], 'setting value fires no event');
	await small.focus();
	await tap(page, 'ArrowUp');
	assert.deepEqual(await events(page, 'ue-spin-change'), [{ value: 20.5, text: '20.5' }], 'a key step starts from the set value');
});

scenario('ComboButton: value reads the picked row, the setter picks a row by value or label and fires no event', 'ComboButton', async (page) => {
	const host = page.locator('ue-combo-button').nth(0);
	type Api = HTMLElement & { value: string };
	assert.equal(await host.evaluate((el) => (el as Api).value), 'Location');
	await record(page, 'ue-combo-pick');
	await host.evaluate((el) => { (el as Api).value = 'Scale'; });
	assert.equal(await cbLabel(cbTrigger(page, 0)), 'Scale');
	await attr(cbRows(page, 0).nth(2), 'aria-selected', 'true');
	await attr(cbRows(page, 0).nth(0), 'aria-selected', 'false');
	assert.equal(await host.evaluate((el) => (el as Api).value), 'Scale');
	assert.deepEqual(await events(page, 'ue-combo-pick'), [], 'setting value fires no event');
	const failure = await host.evaluate((el) => {
		try {
			(el as Api).value = 'Nothing';
			return '';
		} catch (error) {
			return String(error);
		}
	});
	assert.match(failure, /no row with the value Nothing/);
	assert.equal(await cbLabel(cbTrigger(page, 0)), 'Scale', 'a failed set changes nothing');
});

