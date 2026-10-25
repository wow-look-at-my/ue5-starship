// Interaction tests for the toolbar group: MenuBar, ToolBar, PlaceActorsPanel, StatusBar.
import { strict as assert } from 'node:assert';
import type { Locator, Page } from 'playwright';
import { CLEAR, token, prop, fill, ink, hasClass, texts, focusedText, after, press, hold, release, away, clickAway } from './probe.ts';
import { scenario } from './scenario.ts';

// ---------- MenuBar ----------

const MB = 'ue-menu-bar ';
const item = (page: Page, label: string): Locator => page.locator(MB + '.menuBar-item').filter({ hasText: new RegExp('^' + label + '$') });
const menuOf = (page: Page, label: string): Locator => after(item(page, label));

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
	assert.equal(await fill(menu), await token(page, 'dropdown'));
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
	assert.equal(await page.locator(MB + '.menuBar-item.is-open').count(), 0);
});

scenario('MenuBar: hovering another item while a menu is open switches to it', 'MenuBar', async (page) => {
	await item(page, 'File').click();
	await item(page, 'Edit').hover();
	assert.equal(await menuOf(page, 'Edit').isVisible(), true);
	assert.equal(await menuOf(page, 'File').isVisible(), false);
	assert.equal(await page.locator(MB + '.menuBar-item.is-open').count(), 1);
	await item(page, 'Help').hover();
	assert.equal(await menuOf(page, 'Help').isVisible(), true);
	assert.equal(await menuOf(page, 'Edit').isVisible(), false);
});

scenario('MenuBar: hovering a dropdown row fills it with Primary; a disabled row does not react', 'MenuBar', async (page) => {
	await item(page, 'Edit').click();
	const menu = menuOf(page, 'Edit');
	const undo = menu.locator('.menuBar-row').filter({ hasText: 'Undo' });
	const redo = menu.locator('.menuBar-row').filter({ hasText: 'Redo' });
	assert.equal(await fill(undo), CLEAR);
	await undo.hover();
	assert.equal(await fill(undo), await token(page, 'primary'));
	assert.equal(await prop(redo, 'pointer-events'), 'none');
	assert.equal(await prop(redo, 'opacity'), '0.45');
});

scenario('MenuBar: clicking a row closes the menu and reports the label', 'MenuBar', async (page) => {
	await page.evaluate(() => {
		const picked: string[] = [];
		(window as unknown as { picked: string[] }).picked = picked;
		document.addEventListener('ue-menu-select', (e) => picked.push((e as CustomEvent<{ label: string }>).detail.label));
	});
	await item(page, 'File').click();
	await menuOf(page, 'File').locator('.menuBar-row').filter({ hasText: 'Save All' }).click();
	assert.equal(await menuOf(page, 'File').isVisible(), false);
	assert.deepEqual(await page.evaluate(() => (window as unknown as { picked: string[] }).picked), ['Save All']);
});

scenario('MenuBar: arrow keys move between items and into the dropdown', 'MenuBar', async (page) => {
	await item(page, 'File').focus();
	await press(page, 'ArrowRight');
	assert.equal(await focusedText(page), 'Edit');
	await press(page, 'ArrowDown');
	assert.equal(await menuOf(page, 'Edit').isVisible(), true);
	assert.ok((await focusedText(page)).startsWith('Undo'));
	await press(page, 'ArrowDown');
	assert.ok((await focusedText(page)).startsWith('Cut'), 'the disabled Redo row is skipped');
	await press(page, 'ArrowRight');
	assert.equal(await menuOf(page, 'Window').isVisible(), true);
	assert.equal(await menuOf(page, 'Edit').isVisible(), false);
	await press(page, 'Escape');
	assert.equal(await menuOf(page, 'Window').isVisible(), false);
	assert.equal(await focusedText(page), 'Window');
});

scenario('MenuBar: pinned specimens ignore clicks and keep their forced states', 'MenuBar', async (page) => {
	const pinned = page.locator('.menuBar[data-pinned]');
	assert.equal(await pinned.count(), 2);
	assert.equal(await fill(pinned.nth(1).locator('.menuBar-item.is-open')), await token(page, 'primary'));
	await pinned.nth(0).locator('.menuBar-item').nth(0).click();
	assert.equal(await page.locator('.menuBar[data-pinned] .menuBar-item.is-open').count(), 1);
	assert.equal(await fill(pinned.nth(0).locator('.menuBar-item.is-hover')), await token(page, 'hover'));
});

// ---------- ToolBar ----------

const TB = 'ue-tool-bar ';
const openMenus = (page: Page): Promise<number> => page.locator(TB + '.toolBar-menu.is-open').count();

scenario('ToolBar: an icon button shows Dropdown on hover and shifts its padding while pressed', 'ToolBar', async (page) => {
	const save = page.locator(TB + '.toolBar-btn[aria-label="Save"]');
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
	const select = page.locator(TB + '.toolBar-btn--toggle[aria-label="Select"]');
	const blueprints = page.locator(TB + '.toolBar-btn--toggle[aria-label="Blueprints"]');
	assert.equal(await select.getAttribute('aria-pressed'), 'true');
	await select.click();
	assert.equal(await select.getAttribute('aria-pressed'), 'false');
	assert.equal(await hasClass(select, 'is-checked'), false);
	await blueprints.click();
	assert.equal(await hasClass(blueprints, 'is-checked'), true);
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
	const add = page.locator(TB + '.toolBar-btn[aria-label="Add"]');
	const menu = after(add);
	assert.equal(await menu.isVisible(), false);
	await add.click();
	assert.equal(await menu.isVisible(), true);
	assert.equal(await add.getAttribute('aria-expanded'), 'true');
	assert.equal(await fill(menu), await token(page, 'dropdown'));
	await press(page, 'Escape');
	assert.equal(await menu.isVisible(), false);
	await add.click();
	await clickAway(page);
	assert.equal(await menu.isVisible(), false);
	assert.equal(await add.getAttribute('aria-expanded'), 'false');
});

scenario('ToolBar: one menu at a time; the mode, overflow and settings menus open and pick', 'ToolBar', async (page) => {
	const modes = page.locator(TB + '.toolBar-modes');
	const wrap = page.locator(TB + '.toolBar-wrap');
	const settings = page.locator(TB + '.toolBar-slot--settings .toolBar-btn');
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
	await menu.locator('.toolBar-row').filter({ hasText: 'World Settings' }).click();
	assert.equal(await openMenus(page), 0);
});

scenario('ToolBar: Play presses itself and enables Stop; Stop returns to idle', 'ToolBar', async (page) => {
	const play = page.locator(TB + '.toolBar-plate--play');
	const stop = page.locator(TB + '.toolBar-plate--stop');
	assert.equal(await prop(stop, 'opacity'), '0.45');
	assert.equal(await stop.getAttribute('aria-disabled'), 'true');
	assert.equal(await ink(play), await token(page, 'accent-green'));
	await play.click();
	assert.equal(await play.getAttribute('aria-pressed'), 'true');
	assert.equal(await ink(play), 'rgb(101, 142, 52)');
	assert.equal(await prop(stop, 'opacity'), '1');
	assert.equal(await stop.getAttribute('aria-disabled'), 'false');
	assert.equal(await ink(stop), await token(page, 'accent-red'));
	await stop.click();
	await away(page);
	assert.equal(await play.getAttribute('aria-pressed'), 'false');
	assert.equal(await ink(play), await token(page, 'accent-green'));
	assert.equal(await prop(stop, 'opacity'), '0.45');
});

scenario('ToolBar: the plates change only their colour on hover and press', 'ToolBar', async (page) => {
	const play = page.locator(TB + '.toolBar-plate--play');
	await play.hover();
	assert.equal(await ink(play), 'rgb(169, 194, 150)');
	await hold(page);
	assert.equal(await ink(play), 'rgb(101, 142, 52)');
	await release(page);
	const step = page.locator(TB + '.toolBar-plate--step').first();
	await step.hover();
	assert.equal(await ink(step), await token(page, 'foreground-hover'));
	assert.equal(await fill(step), await token(page, 'dropdown'));
});

scenario('ToolBar: pinned specimens ignore clicks', 'ToolBar', async (page) => {
	const pinned = page.locator('.toolBar[data-pinned]');
	assert.equal(await pinned.count(), 2);
	const toggle = pinned.nth(1).locator('.toolBar-btn--toggle').first();
	await toggle.click();
	assert.equal(await hasClass(toggle, 'is-checked'), false);
	assert.equal(await prop(pinned.nth(1).locator('.toolBar-btn.is-pressed'), 'padding-top'), '5px');
});

// ---------- PlaceActorsPanel ----------

const PA = 'ue-place-actors-panel ';
const cat = (page: Page, name: string): Locator => page.locator(PA + '.placeActors-cat[data-category="' + name + '"]');
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
	assert.equal(await page.locator(PA + '.placeActors-cat.is-active').count(), 1);
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
	const field = page.locator(PA + '.placeActors-field');
	const clear = page.locator(PA + '.placeActors-clear');
	const box = page.locator(PA + '.placeActors-searchbox');
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
	const field = page.locator(PA + '.placeActors-field');
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
	const row = page.locator(PA + '.placeActors-row').nth(1);
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
	assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-category')), 'Lights');
	await press(page, 'End');
	assert.equal(await page.locator(PA + '.placeActors-header').textContent(), 'All');
});

scenario('PlaceActorsPanel: pinned specimens ignore clicks and keep their forced rows', 'PlaceActorsPanel', async (page) => {
	const pinned = page.locator('div[data-pinned]').first();
	await pinned.locator('.placeActors-cat').nth(2).click();
	assert.equal(await pinned.locator('.placeActors-cat.is-active use').getAttribute('href'), '#placeActors-i-basic');
	assert.equal(await pinned.locator('.placeActors-header').textContent(), 'Basic');
	assert.equal(await pinned.locator('.placeActors-row.is-hover').count(), 1);
	assert.equal(await pinned.locator('.placeActors-row.is-pressed').count(), 1);
});

// ---------- StatusBar ----------

const SB = 'ue-status-bar ';
const drawer = (page: Page, label: string): Locator => page.locator(SB + '.statusBar-btn').filter({ hasText: label });

scenario('StatusBar: the drawer buttons toggle an open look, one at a time', 'StatusBar', async (page) => {
	const content = drawer(page, 'Content Drawer');
	const log = drawer(page, 'Output Log');
	assert.equal(await ink(content), await token(page, 'foreground'));
	await content.click();
	assert.equal(await content.getAttribute('aria-expanded'), 'true');
	await away(page);
	assert.equal(await ink(content), await token(page, 'foreground-hover'));
	assert.equal(await prop(content, 'padding-top'), '3px');
	await log.click();
	assert.equal(await content.getAttribute('aria-expanded'), 'false');
	assert.equal(await log.getAttribute('aria-expanded'), 'true');
	await log.click();
	await away(page);
	assert.equal(await log.getAttribute('aria-expanded'), 'false');
	assert.equal(await ink(log), await token(page, 'foreground'));
});

scenario('StatusBar: a drawer button turns white on hover and shifts down while pressed', 'StatusBar', async (page) => {
	const log = drawer(page, 'Output Log');
	await log.hover();
	assert.equal(await ink(log), await token(page, 'foreground-hover'));
	assert.equal(await fill(log), CLEAR, 'drawer buttons have no hover fill');
	assert.equal(await prop(log, 'padding-top'), '2px');
	await hold(page);
	assert.equal(await prop(log, 'padding-top'), '3px');
	await release(page);
});

scenario('StatusBar: the Cmd combo opens an upward menu; choosing an entry renames it', 'StatusBar', async (page) => {
	const cmd = page.locator(SB + '.statusBar-cmd');
	const menu = page.locator(SB + '.statusBar-menu');
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
	await menu.locator('.statusBar-row').filter({ hasText: 'Python' }).click();
	assert.equal(await menu.isVisible(), false);
	assert.equal((await cmd.textContent())?.trim(), 'Python');
});

scenario('StatusBar: the console box takes focus, Enter logs the command and clears the box', 'StatusBar', async (page) => {
	const field = page.locator(SB + '.statusBar-field');
	const box = page.locator(SB + '.statusBar-input');
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
		const combo = page.locator(SB + '.statusBar-combo--status').filter({ hasText: label });
		assert.equal(await fill(combo), CLEAR);
		await combo.hover();
		assert.equal(await fill(combo), await token(page, 'dropdown'));
		assert.equal(await ink(combo), await token(page, 'foreground-hover'));
	}
});

scenario('StatusBar: pinned specimens ignore clicks and keep their hover state', 'StatusBar', async (page) => {
	const pinned = page.locator('.statusBar[data-pinned]');
	assert.equal(await pinned.count(), 2);
	await pinned.nth(0).locator('.statusBar-btn').first().click();
	assert.equal(await page.locator('.statusBar[data-pinned] .statusBar-btn.is-open').count(), 0);
	assert.equal(await ink(pinned.nth(1).locator('.statusBar-btn.is-hover')), await token(page, 'foreground-hover'));
});
