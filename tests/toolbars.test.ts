// Interaction tests for the toolbar group: MenuBar, ToolBar, PlaceActorsPanel, StatusBar.
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { Locator, Page } from 'playwright';
import { root } from './lib.ts';
import { assertInert, clickAt, hoverAt } from './pinned.ts';
import { CLEAR, token, prop, fill, ink, texts, focusedText, after, press, hold, release, away, clickAway } from './probe.ts';
import { scenario } from './scenario.ts';

// ---------- the composites hold no primitive ----------

const COMPOSITES = ['MenuBar', 'ToolBar', 'PlaceActorsPanel', 'StatusBar'];
const read = (...parts: string[]): string => fs.readFileSync(path.join(root, ...parts), 'utf8');
const styleOf = (name: string): string => Array.from(read('components', name, 'preview.html').matchAll(/<style>([\s\S]*?)<\/style>/g), (m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');

// The classes of the primitives a composite nests. A composite style may carry its own layout classes only.
const PRIMITIVE_RULE = /\.(button|combobutton|combobutton-anchor|combobutton-menu|popupmenu|textinput|SegmentedControl|SegmentedControl-seg)(__[a-zA-Z-]+|--[a-zA-Z-]+)?\s*[,{:[>+~.]|\.(button|combobutton|popupmenu|textinput|SegmentedControl)(__[a-zA-Z-]+|--[a-zA-Z-]+)?\s*[\w.#[]/;
// The duplicate classes the composites used to draw their own controls with.
const OLD_CLASS = /\b(menuBar-(item|menu|row|label|keys|sep)|toolBar-(btn|modes|wrap|menu|row|label|arrow|ico|sep-row|svgdefs)|statusBar-(btn|combo|menu|row|ico|arrow|txt|field)|placeActors-(cat|rail|searchbox|field|clear|hint))\b/;

for (const name of COMPOSITES) {
	test(name + ': the preview style holds no rule for a primitive class', () => {
		const hit = PRIMITIVE_RULE.exec(styleOf(name));
		assert.equal(hit, null, 'a primitive rule in the preview style: ' + hit?.[0]);
	});
	test(name + ': no duplicate control class remains in the preview or the element source', () => {
		for (const source of [read('components', name, 'preview.html'), read('src', name, name + '.ts')]) {
			const hit = OLD_CLASS.exec(source.replace(/\/\*[\s\S]*?\*\//g, ''));
			assert.equal(hit, null, 'an old class: ' + hit?.[0]);
		}
	});
	test(name + ': the element source holds no menu or search behaviour of its own', () => {
		const source = read('src', name, name + '.ts');
		assert.doesNotMatch(source, /enabledRows|moveRowFocus|aria-expanded|\.hidden\s*=\s*true/, 'a primitive behaviour in ' + name);
	});
}

// ---------- MenuBar ----------

const MB = 'ue-menu-bar ';
const item = (page: Page, label: string): Locator => page.locator(MB + '.combobutton').filter({ hasText: new RegExp('^' + label + '$') });
const menuOf = (page: Page, label: string): Locator => after(item(page, label));
const listOf = (page: Page, label: string): Locator => menuOf(page, label).locator('.popupmenu');
const currentRow = (page: Page): Promise<string> => page.locator(MB + '.popupmenu__row--hover .popupmenu__label').first().textContent().then((text) => text ?? '');
const openItems = (page: Page): Promise<number> => page.locator(MB + '.combobutton--open').count();

scenario('MenuBar: hovering an item fills Hover with ForegroundHover text', 'MenuBar', async (page) => {
	const file = item(page, 'File');
	assert.equal(await fill(file), CLEAR);
	await file.hover();
	assert.equal(await fill(file), await token(page, 'hover'));
	assert.equal(await ink(file), await token(page, 'foreground-hover'));
});

scenario('MenuBar: a click opens the dropdown, Escape closes it', 'MenuBar', async (page) => {
	const file = item(page, 'File');
	const menu = menuOf(page, 'File');
	assert.equal(await menu.isVisible(), false);
	await file.click();
	assert.equal(await menu.isVisible(), true);
	assert.equal(await file.getAttribute('aria-expanded'), 'true');
	assert.equal(await fill(file), await token(page, 'primary'));
	assert.equal(await fill(listOf(page, 'File')), await token(page, 'dropdown'));
	await press(page, 'Escape');
	assert.equal(await menu.isVisible(), false);
	assert.equal(await file.getAttribute('aria-expanded'), 'false');
});

scenario('MenuBar: a click on the open item and a click outside both close the menu', 'MenuBar', async (page) => {
	const edit = item(page, 'Edit');
	const menu = menuOf(page, 'Edit');
	await edit.click();
	assert.equal(await menu.isVisible(), true);
	await edit.click();
	assert.equal(await menu.isVisible(), false);
	await edit.click();
	assert.equal(await menu.isVisible(), true);
	await clickAway(page);
	assert.equal(await menu.isVisible(), false);
	assert.equal(await openItems(page), 0);
});

scenario('MenuBar: hovering another item while a menu is open switches to it', 'MenuBar', async (page) => {
	await item(page, 'File').click();
	await item(page, 'Edit').hover();
	assert.equal(await menuOf(page, 'Edit').isVisible(), true);
	assert.equal(await menuOf(page, 'File').isVisible(), false);
	assert.equal(await openItems(page), 1);
	await item(page, 'Help').hover();
	assert.equal(await menuOf(page, 'Help').isVisible(), true);
	assert.equal(await menuOf(page, 'Edit').isVisible(), false);
});

scenario('MenuBar: hovering a dropdown row fills it with Primary; a disabled row does not react', 'MenuBar', async (page) => {
	await item(page, 'Edit').click();
	const menu = menuOf(page, 'Edit');
	const undo = menu.locator('.popupmenu__row').filter({ hasText: 'Undo' });
	const redo = menu.locator('.popupmenu__row').filter({ hasText: 'Redo' });
	assert.equal(await fill(undo), CLEAR);
	await undo.hover();
	assert.equal(await fill(undo), await token(page, 'primary'));
	assert.equal(await prop(redo, 'opacity'), '0.45');
	await redo.hover();
	assert.equal(await fill(redo), CLEAR, 'a disabled row does not highlight');
	assert.equal(await menu.isVisible(), true);
	await clickAt(page, redo);
	assert.equal(await menu.isVisible(), true, 'a disabled row does not close the menu');
});

scenario('MenuBar: clicking a row closes the menu and reports the label', 'MenuBar', async (page) => {
	await page.evaluate(() => {
		const picked: string[] = [];
		(window as unknown as { picked: string[] }).picked = picked;
		document.addEventListener('ue-menu-select', (e) => picked.push((e as CustomEvent<{ label: string }>).detail.label));
	});
	await item(page, 'File').click();
	await menuOf(page, 'File').locator('.popupmenu__row').filter({ hasText: 'Save All' }).click();
	assert.equal(await menuOf(page, 'File').isVisible(), false);
	assert.deepEqual(await page.evaluate(() => (window as unknown as { picked: string[] }).picked), ['Save All']);
});

scenario('MenuBar: arrow keys move between items and into the dropdown', 'MenuBar', async (page) => {
	await item(page, 'File').focus();
	await press(page, 'ArrowRight');
	assert.equal(await focusedText(page), 'Edit');
	await press(page, 'ArrowDown');
	assert.equal(await menuOf(page, 'Edit').isVisible(), true);
	assert.equal(await currentRow(page), 'Undo');
	await press(page, 'ArrowDown');
	assert.equal(await currentRow(page), 'Cut', 'the disabled Redo row is skipped');
	await press(page, 'ArrowRight');
	assert.equal(await menuOf(page, 'Window').isVisible(), true);
	assert.equal(await currentRow(page), 'Content Browser', 'the next menu opens on its first row');
	assert.equal(await menuOf(page, 'Edit').isVisible(), false);
	await press(page, 'Escape');
	assert.equal(await menuOf(page, 'Window').isVisible(), false);
	assert.equal(await focusedText(page), 'Window');
});

scenario('MenuBar: pinned specimens ignore clicks and keep their forced states', 'MenuBar', async (page) => {
	const pinned = page.locator('[data-pinned] .menuBar');
	assert.equal(await pinned.count(), 2);
	await assertInert(pinned.nth(0));
	assert.equal(await fill(pinned.nth(1).locator('.combobutton--open')), await token(page, 'primary'));
	await clickAt(page, pinned.nth(0).locator('.combobutton').nth(0));
	assert.equal(await page.locator('[data-pinned] .menuBar .combobutton--open').count(), 1);
	assert.equal(await fill(pinned.nth(0).locator('.combobutton--hover')), await token(page, 'hover'));
	await hoverAt(page, pinned.nth(0).locator('.combobutton').nth(0));
	assert.equal(await fill(pinned.nth(0).locator('.combobutton').nth(0)), CLEAR, 'a pinned item does not react to the pointer');
});

scenario('MenuBar: every top item is a ue-combo-button whose panel is a ue-popup-menu', 'MenuBar', async (page) => {
	assert.equal(await page.locator(MB + 'ue-combo-button').count(), 8);
	assert.equal(await page.locator(MB + 'ue-combo-button > .combobutton-anchor > .combobutton-menu > ue-popup-menu').count(), 8);
	assert.equal(await page.locator(MB + '.combobutton--menubar').count(), 8);
});

// ---------- ToolBar ----------

const TB = 'ue-tool-bar ';
const openMenus = (page: Page): Promise<number> => page.locator(TB + '.combobutton--open').count();

scenario('ToolBar: every button is a ue-button and every combo a ue-combo-button with a ue-popup-menu panel', 'ToolBar', async (page) => {
	assert.equal(await page.locator(TB + 'ue-button').count(), 7, 'save, two toggles and the four plate buttons');
	assert.equal(await page.locator(TB + 'ue-button > .button').count(), 7);
	assert.equal(await page.locator(TB + 'ue-combo-button').count(), 5, 'modes, add, play options, more and settings');
	assert.equal(await page.locator(TB + 'ue-combo-button .combobutton-menu > ue-popup-menu').count(), 5);
});

scenario('ToolBar: a combo never wraps its label and never shrinks', 'ToolBar', async (page) => {
	for (const trigger of await page.locator(TB + '.combobutton').all()) {
		assert.equal(await prop(trigger, 'white-space'), 'nowrap');
		assert.equal(await prop(trigger, 'flex-shrink'), '0');
	}
	const settings = page.locator(TB + '.toolBar-slot--settings .combobutton');
	const before = await settings.boundingBox();
	await page.setViewportSize({ width: 380, height: 700 });
	assert.equal((await settings.boundingBox())?.width, before?.width, 'the Settings combo keeps its width in a narrow bar');
	assert.equal((await settings.boundingBox())?.height, before?.height, 'its label stays on one line');
});

scenario('ToolBar: an icon button shows Dropdown on hover and shifts its padding while pressed', 'ToolBar', async (page) => {
	const save = page.locator(TB + '.button[aria-label="Save"]');
	assert.equal(await fill(save), CLEAR);
	await save.hover();
	assert.equal(await fill(save), await token(page, 'dropdown'));
	assert.equal(await prop(save, 'padding-top'), '4px');
	await hold(page);
	assert.equal(await prop(save, 'padding-top'), '5px');
	assert.equal(await prop(save, 'padding-bottom'), '3px');
	await release(page);
	assert.equal(await prop(save, 'padding-top'), '4px');
});

scenario('ToolBar: toggle buttons toggle checked, by mouse and by keyboard', 'ToolBar', async (page) => {
	const select = page.locator(TB + '.button--toggle[aria-label="Select"]');
	const blueprints = page.locator(TB + '.button--toggle[aria-label="Blueprints"]');
	assert.equal(await select.getAttribute('aria-pressed'), 'true');
	assert.equal(await fill(select), await token(page, 'primary'));
	await select.click();
	assert.equal(await select.getAttribute('aria-pressed'), 'false');
	await away(page);
	assert.equal(await fill(select), CLEAR);
	await blueprints.click();
	assert.equal(await blueprints.getAttribute('aria-pressed'), 'true');
	assert.equal(await fill(blueprints), await token(page, 'primary-hover'), 'checked and hovered');
	await away(page);
	assert.equal(await fill(blueprints), await token(page, 'primary'));
	await blueprints.focus();
	await press(page, 'Enter');
	assert.equal(await blueprints.getAttribute('aria-pressed'), 'false');
	await press(page, 'Space');
	assert.equal(await blueprints.getAttribute('aria-pressed'), 'true');
});

scenario('ToolBar: combo buttons open a menu, Escape and an outside click close it', 'ToolBar', async (page) => {
	const add = page.locator(TB + '.combobutton[aria-label="Add"]');
	const menu = after(add);
	assert.equal(await menu.isVisible(), false);
	await add.click();
	assert.equal(await menu.isVisible(), true);
	assert.equal(await add.getAttribute('aria-expanded'), 'true');
	assert.equal(await fill(menu.locator('.popupmenu')), await token(page, 'dropdown'));
	await press(page, 'Escape');
	assert.equal(await menu.isVisible(), false);
	await add.click();
	await clickAway(page);
	assert.equal(await menu.isVisible(), false);
	assert.equal(await add.getAttribute('aria-expanded'), 'false');
});

scenario('ToolBar: one menu at a time; the mode, overflow and settings menus open and pick', 'ToolBar', async (page) => {
	const modes = page.locator(TB + '.toolBar-slot--modes .combobutton');
	const wrap = page.locator(TB + '.combobutton--overflow');
	const settings = page.locator(TB + '.toolBar-slot--settings .combobutton');
	await modes.click();
	assert.equal(await openMenus(page), 1);
	assert.equal(await after(modes).isVisible(), true);
	await wrap.click();
	assert.equal(await openMenus(page), 1);
	assert.equal(await after(wrap).isVisible(), true);
	assert.equal(await after(modes).isVisible(), false);
	await settings.click();
	const menu = after(settings);
	assert.equal(await menu.isVisible(), true);
	const box = await menu.boundingBox();
	assert.ok(box && box.x + box.width <= 1000, 'the settings menu stays inside the page');
	await menu.locator('.popupmenu__row').filter({ hasText: 'World Settings' }).click();
	assert.equal(await openMenus(page), 0);
});

scenario('ToolBar: Play presses itself and enables Stop; Stop returns to idle', 'ToolBar', async (page) => {
	const play = page.locator(TB + '.toolBar-plate--play .button');
	const stop = page.locator(TB + '.toolBar-plate--stop .button');
	const stopPlate = page.locator(TB + '.toolBar-plate--stop');
	assert.equal(await prop(stopPlate, 'opacity'), '0.45');
	assert.equal(await stop.isDisabled(), true);
	assert.equal(await ink(play), await token(page, 'accent-green'));
	await play.click();
	assert.equal(await play.getAttribute('aria-pressed'), 'true');
	assert.equal(await ink(play), 'rgb(101, 142, 52)');
	assert.equal(await prop(stopPlate, 'opacity'), '1');
	assert.equal(await stop.isDisabled(), false);
	assert.equal(await ink(stop), await token(page, 'accent-red'));
	await play.click();
	assert.equal(await play.getAttribute('aria-pressed'), 'true', 'a second Play press keeps the game running');
	await stop.click();
	await away(page);
	assert.equal(await play.getAttribute('aria-pressed'), 'false');
	assert.equal(await ink(play), await token(page, 'accent-green'));
	assert.equal(await prop(stopPlate, 'opacity'), '0.45');
	assert.equal(await stop.isDisabled(), true);
});

scenario('ToolBar: the plates change only their colour on hover and press', 'ToolBar', async (page) => {
	const play = page.locator(TB + '.toolBar-plate--play .button');
	await play.hover();
	assert.equal(await ink(play), 'rgb(169, 194, 150)');
	assert.equal(await fill(play), CLEAR, 'the button has no fill of its own');
	await hold(page);
	assert.equal(await ink(play), 'rgb(101, 142, 52)');
	await release(page);
	const step = page.locator(TB + '.toolBar-plate--step').first();
	await step.hover();
	assert.equal(await ink(step.locator('.button')), await token(page, 'foreground-hover'));
	assert.equal(await fill(step), await token(page, 'dropdown'));
	assert.equal(await fill(step.locator('.button')), CLEAR);
});

scenario('ToolBar: the Play options dots open a menu and Left and Right move between the controls', 'ToolBar', async (page) => {
	const dots = page.locator(TB + '.combobutton--plate');
	const menu = page.locator(TB + '.toolBar-slot--plate .combobutton-menu');
	await dots.click();
	assert.equal(await menu.isVisible(), true);
	await press(page, 'Escape');
	assert.equal(await menu.isVisible(), false);
	assert.equal(await dots.evaluate((el) => el === document.activeElement), true, 'Escape returns the focus to the trigger');
	await page.locator(TB + '.button[aria-label="Save"]').focus();
	await press(page, 'ArrowRight');
	assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Select');
	await press(page, 'ArrowLeft');
	assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Save');
});

scenario('ToolBar: pinned specimens ignore clicks', 'ToolBar', async (page) => {
	const pinned = page.locator('[data-pinned] .toolBar');
	assert.equal(await pinned.count(), 2);
	await assertInert(pinned.nth(0));
	await assertInert(pinned.nth(1));
	const toggle = pinned.nth(1).locator('.button--toggle').first();
	await clickAt(page, toggle);
	assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
	assert.equal(await prop(pinned.nth(1).locator('.button--pressed'), 'padding-top'), '5px');
	assert.equal(await fill(pinned.nth(1).locator('.button--checked.button--hover')), await token(page, 'primary-hover'));
	assert.equal(await fill(pinned.nth(1).locator('.combobutton--hover')), await token(page, 'dropdown'));
	await hoverAt(page, pinned.nth(0).locator('.toolBar-plate--play .button'));
	assert.equal(await ink(pinned.nth(0).locator('.toolBar-plate--play .button')), await token(page, 'accent-green'), 'a pinned plate does not react to the pointer');
});

// ---------- PlaceActorsPanel ----------

const PA = 'ue-place-actors-panel ';
const cat = (page: Page, name: string): Locator => page.locator(PA + '.SegmentedControl-seg[data-value="' + name + '"]');
const visibleRows = (page: Page): Promise<string[]> => texts(page, PA + '.placeActors-group:not([hidden]) .placeActors-row:not([hidden]) .placeActors-name');

scenario('PlaceActorsPanel: clicking a category activates it and swaps the list and the label', 'PlaceActorsPanel', async (page) => {
	assert.deepEqual(await visibleRows(page), ['Actor', 'Character', 'Pawn', 'Point Light', 'Player Start']);
	await cat(page, 'Lights').click();
	assert.deepEqual(await visibleRows(page), ['Directional Light', 'Point Light', 'Spot Light', 'Rect Light', 'Sky Light']);
	assert.equal(await page.locator(PA + '.placeActors-header').textContent(), 'Lights');
	assert.equal(await cat(page, 'Lights').getAttribute('aria-checked'), 'true');
	assert.equal(await cat(page, 'Basic').getAttribute('aria-checked'), 'false');
	await away(page);
	assert.equal(await fill(cat(page, 'Lights')), await token(page, 'primary'));
	assert.equal(await fill(cat(page, 'Basic')), CLEAR);
	assert.equal(await page.locator(PA + '.SegmentedControl-seg.is-checked').count(), 1);
	await cat(page, 'Volumes').click();
	assert.deepEqual(await visibleRows(page), ['Trigger Volume', 'Blocking Volume']);
});

scenario('PlaceActorsPanel: an inactive category fills Dropdown on hover, the active one PrimaryHover', 'PlaceActorsPanel', async (page) => {
	await cat(page, 'Shapes').hover();
	assert.equal(await fill(cat(page, 'Shapes')), await token(page, 'dropdown'));
	await cat(page, 'Basic').hover();
	assert.equal(await fill(cat(page, 'Basic')), await token(page, 'primary-hover'));
});

scenario('PlaceActorsPanel: typing filters the rows and shows the clear button', 'PlaceActorsPanel', async (page) => {
	const field = page.locator(PA + '.textinput__field');
	const clear = page.locator(PA + '.textinput__clear');
	const box = page.locator(PA + '.textinput--search');
	assert.equal(await clear.isVisible(), false);
	await field.click();
	assert.ok((await prop(box, 'box-shadow')).includes(await token(page, 'primary')), 'focus outline is Primary');
	await page.keyboard.type('light');
	assert.deepEqual(await visibleRows(page), ['Point Light']);
	assert.equal(await clear.isVisible(), true);
	await field.fill('PA');
	assert.deepEqual(await visibleRows(page), ['Pawn']);
	await field.fill('zzz');
	assert.deepEqual(await visibleRows(page), []);
	assert.equal(await page.locator(PA + '.placeActors-empty').isVisible(), true);
	await clear.click();
	assert.equal(await field.inputValue(), '');
	assert.equal(await clear.isVisible(), false);
	assert.equal((await visibleRows(page)).length, 5);
	assert.equal(await page.locator(PA + '.placeActors-empty').isVisible(), false);
});

scenario('PlaceActorsPanel: the filter follows the category and Escape clears it', 'PlaceActorsPanel', async (page) => {
	const field = page.locator(PA + '.textinput__field');
	await field.fill('light');
	await cat(page, 'Lights').click();
	assert.equal((await visibleRows(page)).length, 5);
	await cat(page, 'Shapes').click();
	assert.deepEqual(await visibleRows(page), []);
	await field.focus();
	await press(page, 'Escape');
	assert.equal(await field.inputValue(), '');
	assert.equal((await visibleRows(page)).length, 5);
});

scenario('PlaceActorsPanel: rows show hover and pressed outlines, the info button fills on hover', 'PlaceActorsPanel', async (page) => {
	const row = page.locator(PA + '.placeActors-group[data-category="Basic"] .placeActors-row').nth(1);
	const info = row.locator('.placeActors-info');
	assert.ok((await prop(row, 'box-shadow')).includes(await token(page, 'dropdown')));
	await row.hover({ position: { x: 60, y: 10 } });
	assert.ok((await prop(row, 'box-shadow')).includes(await token(page, 'hover')));
	await hold(page);
	assert.ok((await prop(row, 'box-shadow')).includes(await token(page, 'primary')));
	await release(page);
	assert.equal(await fill(info), CLEAR);
	await info.hover();
	assert.equal(await fill(info), await token(page, 'hover'));
	assert.equal(await ink(info), await token(page, 'foreground-hover'));
});

scenario('PlaceActorsPanel: arrow keys move the category and activate it', 'PlaceActorsPanel', async (page) => {
	await cat(page, 'Basic').focus();
	await press(page, 'ArrowRight');
	assert.equal(await cat(page, 'Lights').getAttribute('aria-checked'), 'true');
	assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.value), 'Lights');
	await press(page, 'End');
	assert.equal(await page.locator(PA + '.placeActors-header').textContent(), 'All');
});

scenario('PlaceActorsPanel: the search is a ue-text-input search and the rail a ue-segmented-control rail', 'PlaceActorsPanel', async (page) => {
	assert.equal(await page.locator(PA + 'ue-text-input > .textinput--search').count(), 1);
	assert.equal(await page.locator(PA + 'ue-segmented-control > .SegmentedControl--rail').count(), 1);
	assert.equal(await page.locator(PA + '.SegmentedControl-seg').count(), 7);
	assert.equal(await prop(page.locator(PA + '.textinput--search'), 'border-radius'), '999px', 'the search box is a pill');
});

scenario('PlaceActorsPanel: pinned specimens ignore clicks and keep their forced rows', 'PlaceActorsPanel', async (page) => {
	const pinned = page.locator('ue-place-actors-panel[data-pinned]').first();
	await assertInert(pinned);
	await clickAt(page, pinned.locator('.SegmentedControl-seg').nth(2));
	assert.equal(await pinned.locator('.SegmentedControl-seg.is-checked').count(), 1);
	assert.equal(await pinned.locator('.SegmentedControl-seg.is-checked svg path').first().getAttribute('d'), 'M5 2.5L8.5 6h-7z', 'the Basic category stays checked');
	assert.equal(await pinned.locator('.placeActors-header').textContent(), 'Basic');
	assert.equal(await pinned.locator('.placeActors-row.is-hover').count(), 1);
	assert.equal(await pinned.locator('.placeActors-row.is-pressed').count(), 1);
});

// ---------- StatusBar ----------

const SB = 'ue-status-bar ';
const drawer = (page: Page, label: string): Locator => page.locator(SB + '.statusBar-seg--drawer .button').filter({ hasText: label });

scenario('StatusBar: the drawers are ue-buttons, the combos ue-combo-buttons, the console a ue-text-input', 'StatusBar', async (page) => {
	assert.equal(await page.locator(SB + 'ue-button > .button--status').count(), 2);
	assert.equal(await page.locator(SB + 'ue-combo-button .combobutton--simple').count(), 3);
	assert.equal(await page.locator(SB + 'ue-combo-button .combobutton-menu > ue-popup-menu').count(), 3);
	assert.equal(await page.locator(SB + 'ue-text-input > .textinput--console').count(), 1);
});

scenario('StatusBar: the drawer buttons toggle an open look, one at a time', 'StatusBar', async (page) => {
	const content = drawer(page, 'Content Drawer');
	const log = drawer(page, 'Output Log');
	const changes = await page.evaluate(() => {
		const seen: Array<string | null> = [];
		(window as unknown as { drawers: Array<string | null> }).drawers = seen;
		document.addEventListener('ue-drawer-change', (e) => seen.push((e as CustomEvent<{ drawer: string | null }>).detail.drawer));
		return seen.length;
	});
	assert.equal(changes, 0);
	assert.equal(await ink(content), await token(page, 'foreground'));
	await content.click();
	assert.equal(await content.getAttribute('aria-pressed'), 'true');
	await away(page);
	assert.equal(await ink(content), await token(page, 'foreground-hover'));
	assert.equal(await prop(content, 'padding-top'), '5px');
	await log.click();
	assert.equal(await content.getAttribute('aria-pressed'), 'false');
	assert.equal(await log.getAttribute('aria-pressed'), 'true');
	await log.click();
	await away(page);
	assert.equal(await log.getAttribute('aria-pressed'), 'false');
	assert.equal(await ink(log), await token(page, 'foreground'));
	assert.deepEqual(await page.evaluate(() => (window as unknown as { drawers: Array<string | null> }).drawers), ['Content Drawer', 'Output Log', null]);
});

scenario('StatusBar: a drawer button turns white on hover and shifts down while pressed', 'StatusBar', async (page) => {
	const log = drawer(page, 'Output Log');
	await log.hover();
	assert.equal(await ink(log), await token(page, 'foreground-hover'));
	assert.equal(await fill(log), CLEAR, 'drawer buttons have no hover fill');
	assert.equal(await prop(log, 'padding-top'), '4px');
	await hold(page);
	assert.equal(await prop(log, 'padding-top'), '5px');
	await release(page);
});

scenario('StatusBar: the Cmd combo opens an upward menu; choosing an entry renames it', 'StatusBar', async (page) => {
	const cmd = page.locator(SB + '.statusBar-cmd .combobutton');
	const menu = page.locator(SB + '.statusBar-cmd .combobutton-menu');
	const executors = await page.evaluate(() => {
		const seen: string[] = [];
		(window as unknown as { executors: string[] }).executors = seen;
		document.addEventListener('ue-executor-change', (e) => seen.push((e as CustomEvent<{ executor: string }>).detail.executor));
		return seen.length;
	});
	assert.equal(executors, 0);
	assert.equal(await menu.isVisible(), false);
	await cmd.click();
	assert.equal(await menu.isVisible(), true);
	const menuBox = await menu.boundingBox();
	const cmdBox = await cmd.boundingBox();
	assert.ok(menuBox && cmdBox && menuBox.y + menuBox.height <= cmdBox.y, 'the menu opens above the combo');
	assert.equal(await fill(cmd), await token(page, 'dropdown'));
	await press(page, 'Escape');
	assert.equal(await menu.isVisible(), false);
	await cmd.click();
	await clickAway(page);
	assert.equal(await menu.isVisible(), false);
	await cmd.click();
	await menu.locator('.popupmenu__row').filter({ hasText: 'Python' }).click();
	assert.equal(await menu.isVisible(), false);
	assert.equal((await cmd.textContent())?.trim(), 'Python');
	assert.deepEqual(await page.evaluate(() => (window as unknown as { executors: string[] }).executors), ['Python']);
	await cmd.click();
	assert.equal(await menu.locator('.popupmenu__row[aria-checked="true"] .popupmenu__label').textContent(), 'Python');
});

scenario('StatusBar: the Derived Data and Source Control combos open an upward menu', 'StatusBar', async (page) => {
	for (const label of ['Derived Data', 'Source Control Off']) {
		const combo = page.locator(SB + '.statusBar-seg--tools .combobutton').filter({ hasText: label });
		const menu = after(combo);
		await combo.click();
		const menuBox = await menu.boundingBox();
		const comboBox = await combo.boundingBox();
		assert.ok(menuBox && comboBox && menuBox.y + menuBox.height <= comboBox.y, 'the menu opens above ' + label);
		await press(page, 'Escape');
		assert.equal(await menu.isVisible(), false);
	}
});

scenario('StatusBar: the console box takes focus, Enter logs the command and clears the box', 'StatusBar', async (page) => {
	const field = page.locator(SB + '.textinput__field');
	const box = page.locator(SB + '.textinput--console');
	const history = SB + '.statusBar-history-line';
	assert.ok(!(await prop(box, 'box-shadow')).includes(await token(page, 'primary')));
	await field.click();
	assert.ok((await prop(box, 'box-shadow')).includes(await token(page, 'primary')), 'focus ring is Primary');
	await page.keyboard.type('stat fps');
	assert.equal(await field.inputValue(), 'stat fps');
	await press(page, 'Enter');
	assert.equal(await field.inputValue(), '');
	await page.keyboard.type('t.MaxFPS 30');
	await press(page, 'Enter');
	assert.deepEqual(await texts(page, history), ['> stat fps', '> t.MaxFPS 30']);
	await press(page, 'ArrowUp');
	assert.equal(await field.inputValue(), 't.MaxFPS 30');
	await press(page, 'ArrowUp');
	assert.equal(await field.inputValue(), 'stat fps');
	await field.fill('   ');
	await press(page, 'Enter');
	assert.equal((await texts(page, history)).length, 2, 'a blank line is not a command');
	for (const command of ['a', 'b', 'c', 'd']) {
		await field.fill(command);
		await press(page, 'Enter');
	}
	assert.deepEqual(await texts(page, history), ['> a', '> b', '> c', '> d']);
});

scenario('StatusBar: Derived Data and Source Control fill Dropdown on hover', 'StatusBar', async (page) => {
	for (const label of ['Derived Data', 'Source Control Off']) {
		const combo = page.locator(SB + '.combobutton--wide').filter({ hasText: label });
		assert.equal(await fill(combo), CLEAR);
		await combo.hover();
		assert.equal(await fill(combo), await token(page, 'dropdown'));
		assert.equal(await ink(combo), await token(page, 'foreground-hover'));
	}
});

scenario('StatusBar: pinned specimens ignore clicks and keep their hover state', 'StatusBar', async (page) => {
	const pinned = page.locator('[data-pinned] .statusBar');
	assert.equal(await pinned.count(), 2);
	await assertInert(pinned.nth(0));
	await clickAt(page, pinned.nth(0).locator('.button').first());
	assert.equal(await page.locator('[data-pinned] .statusBar .button[aria-pressed="true"]').count(), 0);
	assert.equal(await ink(pinned.nth(1).locator('.button--hover')), await token(page, 'foreground-hover'));
	assert.equal(await fill(pinned.nth(1).locator('.combobutton--hover')), await token(page, 'dropdown'));
	await hoverAt(page, pinned.nth(0).locator('.combobutton').first());
	assert.equal(await fill(pinned.nth(0).locator('.combobutton').first()), CLEAR, 'a pinned combo does not react to the pointer');
});
