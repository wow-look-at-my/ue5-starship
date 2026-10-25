/// <reference lib="dom" />
// Behaviour tests for the Content Browser group: ContentToolbar, SourcePanel, AssetTile, AssetSearchBar, ContentBrowser.
import { strict as assert } from 'node:assert';
import type { Page, Locator } from 'playwright';
import { scenario } from './scenario.ts';
import { token, prop, fill, texts, hasClass } from './probe.ts';

const exactly = (text: string): RegExp => new RegExp('^' + text + '$');
const hasFocus = (target: Locator): Promise<boolean> => target.evaluate((el) => el === document.activeElement);
const tap = async (page: Page, ...names: string[]): Promise<void> => {
	for (const name of names) await page.keyboard.press(name);
};
const attr = (target: Locator, name: string): Promise<string | null> => target.getAttribute(name);
const pseudoShadow = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el, '::after').boxShadow);
const mouseDown = (page: Page): Promise<void> => page.mouse.down();
const mouseUp = (page: Page): Promise<void> => page.mouse.up();
const farAway = (page: Page): Promise<void> => page.mouse.move(980, 780);
const shows = (target: Locator, message?: string): Promise<void> => target.isVisible().then((v) => assert.ok(v, message ?? 'expected the element to show'));
const hides = (target: Locator, message?: string): Promise<void> => target.isVisible().then((v) => assert.ok(!v, message ?? 'expected the element to be hidden'));
const valueOf = (target: Locator): Promise<string> => target.inputValue();

// Appends a deep copy of the first element with this tag to the body.
function duplicateFirst(tag: string): void {
	const live = document.querySelector(tag);
	if (live) document.body.append(live.cloneNode(true));
}

// Records the detail of every bubbling custom event with this name.
async function recordEvents(page: Page, name: string): Promise<void> {
	await page.evaluate((type) => {
		const log: unknown[] = [];
		Object.assign(window, { [type]: log });
		document.addEventListener(type, (event) => log.push((event as CustomEvent).detail));
	}, name);
}

const recorded = (page: Page, name: string): Promise<unknown[]> => page.evaluate((type) => (window as unknown as Record<string, unknown[]>)[type], name);

// ---------------------------------------------------------------- ContentToolbar

const TB = 'ue-content-toolbar ';
const tbCrumbs = (page: Page): Promise<string[]> => texts(page, TB + '.ContentToolbar__crumb');

scenario('ContentToolbar: hover and pressed states of the buttons', 'ContentToolbar', async (page) => {
	const importButton = page.locator(TB + '.ContentToolbar__btn').first();
	await importButton.hover();
	assert.equal(await fill(importButton), await token(page, 'dropdown'));
	await mouseDown(page);
	assert.equal(await fill(importButton), await token(page, 'dropdown'));
	assert.equal(await prop(importButton, 'padding-top'), '4px', 'pressed content shifts 1px down');
	await mouseUp(page);

	const addButton = page.locator(TB + '.ContentToolbar__add');
	await addButton.hover();
	assert.equal(await fill(addButton), await token(page, 'hover'));
	await mouseDown(page);
	assert.equal(await fill(addButton), await token(page, 'header'), 'Add is a Button: pressed fill is Header');
	await mouseUp(page);
});

scenario('ContentToolbar: crumbs navigate and Back/Forward walk the history', 'ContentToolbar', async (page) => {
	const back = page.locator(TB + '.ContentToolbar__nav--back');
	const fwd = page.locator(TB + '.ContentToolbar__nav--fwd');
	assert.ok(await back.isDisabled(), 'Back starts disabled');
	assert.ok(await fwd.isDisabled(), 'Forward starts disabled');
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content', 'StarterContent']);

	await page.locator(TB + '.ContentToolbar__crumb', { hasText: 'Content' }).first().click();
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content']);
	assert.equal(await page.locator(TB + '.ContentToolbar__delim').count(), 2, 'a chevron follows each crumb');
	assert.ok(!(await back.isDisabled()), 'history enables Back');
	assert.ok(await fwd.isDisabled());

	await back.click();
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content', 'StarterContent']);
	assert.ok(await back.isDisabled());
	assert.ok(!(await fwd.isDisabled()));

	await fwd.click();
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content']);
	assert.ok(await fwd.isDisabled());
});

scenario('ContentToolbar: a chevron opens a sub-folder menu and picking extends the trail', 'ContentToolbar', async (page) => {
	await page.locator(TB + '.ContentToolbar__delim').nth(1).click();
	assert.deepEqual(await texts(page, TB + '.ContentToolbar__menuitem'), ['StarterContent', 'Developers']);
	await page.locator(TB + '.ContentToolbar__menuitem', { hasText: 'Developers' }).click();
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content', 'Developers']);
	assert.equal(await page.locator(TB + '.ContentToolbar__menu').count(), 0, 'picking closes the menu');
});

scenario('ContentToolbar: the Settings menu toggles checks and works from the keyboard', 'ContentToolbar', async (page) => {
	const settingsButton = page.locator(TB + '.ContentToolbar__settings');
	const menu = page.locator(TB + '.ContentToolbar__menu');
	const item = (label: string): Locator => page.locator(TB + '.ContentToolbar__menuitem', { hasText: label });
	await settingsButton.click();
	assert.equal(await attr(settingsButton, 'aria-expanded'), 'true');
	assert.equal(await attr(item('Show Folders'), 'aria-checked'), 'true');
	assert.equal(await attr(item('Show Empty Folders'), 'aria-checked'), 'false');
	assert.ok(await hasFocus(item('Show Folders')), 'the first item has focus');
	assert.equal(await fill(item('Show Folders')), await token(page, 'primary'), 'the focused row is Primary');

	await tap(page, 'ArrowDown', 'Enter');
	assert.equal(await menu.count(), 0);
	await settingsButton.click();
	assert.equal(await attr(item('Show Empty Folders'), 'aria-checked'), 'true', 'the toggled check persists');

	await tap(page, 'Escape');
	assert.equal(await menu.count(), 0);
	assert.ok(await hasFocus(settingsButton), 'Escape returns focus to the button');
	assert.equal(await attr(settingsButton, 'aria-expanded'), 'false');

	await settingsButton.click();
	await page.mouse.click(980, 780);
	assert.equal(await menu.count(), 0, 'an outside click closes the menu');
});

scenario('ContentToolbar: pinned specimens stay static and a copied instance is independent', 'ContentToolbar', async (page) => {
	const pinned = page.locator('.ContentToolbar:not(ue-content-toolbar .ContentToolbar)').first();
	await pinned.locator('.ContentToolbar__crumb', { hasText: 'Content' }).first().click();
	assert.equal(await pinned.locator('.ContentToolbar__crumb').count(), 3, 'a pinned toolbar does not navigate');
	assert.ok(await pinned.locator('.ContentToolbar__nav--fwd').isDisabled());

	await page.evaluate(duplicateFirst, 'ue-content-toolbar');
	assert.equal(await page.locator('ue-content-toolbar').count(), 2);
	const copy = page.locator('ue-content-toolbar').nth(1);
	await copy.locator('.ContentToolbar__crumb', { hasText: 'Content' }).first().click();
	assert.deepEqual(await copy.locator('.ContentToolbar__crumb').allTextContents(), ['All', 'Content']);
	assert.deepEqual(await page.locator('ue-content-toolbar').nth(0).locator('.ContentToolbar__crumb').allTextContents(), ['All', 'Content', 'StarterContent'], 'the original keeps its own history');
});

// ---------------------------------------------------------------- SourcePanel

const spRow = (page: Page, name: string): Locator => page.locator('ue-source-panel .SourcePanel__row', { hasText: exactly(name) });
const spSelected = (page: Page): Promise<string[]> => texts(page, 'ue-source-panel .SourcePanel__row[aria-selected="true"]');

scenario('SourcePanel: selecting a row, parent highlight and the focused/unfocused colours', 'SourcePanel', async (page) => {
	assert.equal(await fill(spRow(page, 'StarterContent')), await token(page, 'select-inactive'), 'unfocused selection is SelectInactive');

	await spRow(page, 'Architecture').click();
	assert.equal(await fill(spRow(page, 'Architecture')), await token(page, 'select'), 'focused selection is Select');
	assert.equal(await attr(spRow(page, 'Architecture'), 'aria-selected'), 'true');
	assert.equal(await attr(spRow(page, 'StarterContent'), 'aria-selected'), 'false');
	for (const ancestor of ['All', 'Content', 'StarterContent']) assert.equal(await fill(spRow(page, ancestor)), await token(page, 'select-parent'), ancestor + ' is a parent of the selection');

	await page.mouse.click(980, 780);
	assert.equal(await fill(spRow(page, 'Architecture')), await token(page, 'select-inactive'), 'leaving the panel makes the selection inactive');
});

scenario('SourcePanel: hover fill on a row', 'SourcePanel', async (page) => {
	await spRow(page, 'Props').hover();
	assert.equal(await fill(spRow(page, 'Props')), await token(page, 'select-hover'));
});

scenario('SourcePanel: the arrow expands and collapses a folder', 'SourcePanel', async (page) => {
	await hides(spRow(page, 'Music'));
	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
	await shows(spRow(page, 'Music'));
	await shows(spRow(page, 'Ambient'));
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-expanded'), 'true');
	assert.equal(await attr(spRow(page, 'Audio').locator('.SourcePanel__folder use'), 'href'), '#sp-fo', 'an open folder shows the open icon');
	assert.equal(await attr(spRow(page, 'StarterContent'), 'aria-selected'), 'true', 'the arrow does not move the selection');

	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
	await hides(spRow(page, 'Music'));
	assert.equal(await attr(spRow(page, 'Audio').locator('.SourcePanel__exp use'), 'href'), '#sp-caret-r');
});

scenario('SourcePanel: Up, Down, Left, Right, Home and End drive the tree', 'SourcePanel', async (page) => {
	await spRow(page, 'StarterContent').focus();
	await tap(page, 'ArrowDown');
	assert.deepEqual(await spSelected(page), ['Architecture']);
	await tap(page, 'ArrowDown');
	assert.deepEqual(await spSelected(page), ['Audio']);
	await tap(page, 'ArrowRight');
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-expanded'), 'true', 'Right opens a closed folder');
	await tap(page, 'ArrowRight');
	assert.deepEqual(await spSelected(page), ['Music'], 'Right on an open folder moves to its first child');
	await tap(page, 'ArrowLeft');
	assert.deepEqual(await spSelected(page), ['Audio'], 'Left on a leaf moves to the parent');
	await tap(page, 'ArrowLeft');
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-expanded'), 'false', 'Left collapses an open folder');
	await hides(spRow(page, 'Music'));
	await tap(page, 'End');
	assert.deepEqual(await spSelected(page), ['Textures']);
	await tap(page, 'Home');
	assert.deepEqual(await spSelected(page), ['All']);
	assert.ok(await hasFocus(spRow(page, 'All')), 'focus follows the selection');
});

scenario('SourcePanel: collapsing a folder that holds the selection selects the folder', 'SourcePanel', async (page) => {
	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
	await spRow(page, 'Music').click();
	assert.equal(await attr(spRow(page, 'Music'), 'aria-selected'), 'true');
	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-selected'), 'true');
	await hides(spRow(page, 'Music'));
});

scenario('SourcePanel: section headers collapse and expand', 'SourcePanel', async (page) => {
	const areas = page.locator('ue-source-panel .SourcePanel__area');
	const project = page.locator('ue-source-panel .SourcePanel__title', { hasText: 'LevelDesignProject' });
	const favorites = page.locator('ue-source-panel .SourcePanel__title', { hasText: 'Favorites' });
	const projectBody = areas.nth(1).locator('.SourcePanel__body');
	await shows(projectBody);
	await project.click();
	await hides(projectBody);
	assert.equal(await attr(project, 'aria-expanded'), 'false');
	assert.equal(await attr(areas.nth(1).locator('.SourcePanel__arrow use'), 'href'), '#sp-caret-r');
	await project.click();
	await shows(projectBody);

	await page.locator('ue-source-panel .SourcePanel__arrow').first().click();
	await shows(areas.first().locator('.SourcePanel__body'), 'clicking the caret expands the section');
	await favorites.focus();
	await tap(page, 'Enter');
	assert.equal(await attr(favorites, 'aria-expanded'), 'false', 'Enter toggles the focused header');
});

scenario('SourcePanel: search toggles show hover, pressed and checked colours; the plus adds a collection', 'SourcePanel', async (page) => {
	const tool = page.locator('ue-source-panel .SourcePanel__tool').first();
	await tool.hover();
	assert.equal(await fill(tool), await token(page, 'dropdown'));
	await tool.click();
	assert.equal(await attr(tool, 'aria-pressed'), 'true');
	assert.equal(await fill(tool), await token(page, 'primary-hover'), 'checked and hovered');
	await farAway(page);
	assert.equal(await fill(tool), await token(page, 'primary'), 'checked');
	await tool.click();
	assert.equal(await attr(tool, 'aria-pressed'), 'false');

	await page.locator('ue-source-panel .SourcePanel__add').click();
	assert.equal(await attr(page.locator('ue-source-panel .SourcePanel__title', { hasText: 'Collections' }), 'aria-expanded'), 'true');
	assert.equal(await attr(spRow(page, 'NewCollection2'), 'aria-selected'), 'true');
});

scenario('SourcePanel: the pinned panel is plain HTML and does not react', 'SourcePanel', async (page) => {
	const pinned = page.locator('.SourcePanel:not(ue-source-panel .SourcePanel)');
	const pinnedRow = pinned.locator('.SourcePanel__row', { hasText: 'Architecture' });
	await pinnedRow.click();
	assert.equal(await attr(pinnedRow, 'class'), 'SourcePanel__row');
	assert.equal(await fill(pinned.locator('.SourcePanel__row--selected')), await token(page, 'select'), 'the pinned selected row keeps the Select fill');
});

// ---------------------------------------------------------------- AssetTile

const tile = (page: Page, name: string): Locator => page.locator('ue-asset-tile .AssetTile', { has: page.locator('.AssetTile__name', { hasText: exactly(name) }) });
const tileSelection = (page: Page): Promise<string[]> => texts(page, 'ue-asset-tile .AssetTile.is-selected .AssetTile__name');
const cardOf = (target: Locator): Locator => target.locator('.AssetTile__card');

scenario('AssetTile: hover looks of folder and asset tiles', 'AssetTile', async (page) => {
	const folder = tile(page, 'Audio');
	assert.equal(await fill(cardOf(folder)), 'rgba(0, 0, 0, 0)', 'a folder has no card fill at rest');
	await folder.hover();
	assert.equal(await fill(cardOf(folder)), await token(page, 'secondary'));
	assert.match(await prop(cardOf(folder), 'box-shadow'), /rgba\(0, 0, 0, 0\.5\)/);
	assert.equal(await prop(folder.locator('.AssetTile__name'), 'color'), await token(page, 'white'));
	assert.equal(await pseudoShadow(cardOf(folder)), 'none', 'a hovered folder gets no outline');

	const asset = tile(page, 'SM_Chair');
	await asset.hover();
	assert.equal(await fill(asset.locator('.AssetTile__nameArea')), await token(page, 'hover'));
	assert.ok((await pseudoShadow(cardOf(asset))).includes(await token(page, 'hover')), 'assets get the hover outline');
});

scenario('AssetTile: click selects one tile, Ctrl/Cmd toggles and Shift selects a range', 'AssetTile', async (page) => {
	await tile(page, 'Architecture').click();
	assert.deepEqual(await tileSelection(page), ['Architecture']);
	await tile(page, 'Audio').click();
	assert.deepEqual(await tileSelection(page), ['Audio'], 'a plain click replaces the selection');
	assert.equal(await attr(tile(page, 'Audio'), 'aria-selected'), 'true');
	assert.equal(await attr(tile(page, 'Architecture'), 'aria-selected'), 'false');

	await tile(page, 'Materials').click({ modifiers: ['Control'] });
	assert.deepEqual(await tileSelection(page), ['Audio', 'Materials']);
	assert.equal(await page.locator('ue-asset-tile .AssetTilePreview__status').textContent(), '2 selected: Audio, Materials');
	await tile(page, 'Audio').click({ modifiers: ['Control'] });
	assert.deepEqual(await tileSelection(page), ['Materials'], 'Ctrl+click on a selected tile removes it');

	await tile(page, 'Architecture').click();
	await tile(page, 'Materials').click({ modifiers: ['Shift'] });
	assert.deepEqual(await tileSelection(page), ['Architecture', 'Audio', 'Blueprints', 'Materials']);
});

scenario('AssetTile: selected and selected + hovered colours', 'AssetTile', async (page) => {
	const asset = tile(page, 'SM_Table');
	const area = asset.locator('.AssetTile__nameArea');
	await asset.click();
	await farAway(page);
	assert.equal(await fill(area), await token(page, 'primary'));
	assert.ok((await pseudoShadow(cardOf(asset))).includes(await token(page, 'primary')));
	await asset.hover();
	assert.equal(await fill(area), await token(page, 'primary-hover'));
	assert.ok((await pseudoShadow(cardOf(asset))).includes(await token(page, 'primary-hover')));
});

scenario('AssetTile: double-click and Enter open a tile', 'AssetTile', async (page) => {
	await recordEvents(page, 'assettile:open');
	await tile(page, 'Audio').dblclick();
	assert.deepEqual(await recorded(page, 'assettile:open'), [{ name: 'Audio', folder: true }]);
	assert.match((await page.locator('ue-asset-tile .AssetTilePreview__status').textContent()) ?? '', /Opened: Audio/);
	await tile(page, 'SM_Chair').focus();
	await tap(page, 'Enter');
	assert.deepEqual((await recorded(page, 'assettile:open')).pop(), { name: 'SM_Chair', folder: false });
});

scenario('AssetTile: arrow keys, Home and End move the selection through the wrapped grid', 'AssetTile', async (page) => {
	await tile(page, 'Architecture').click();
	await tap(page, 'ArrowRight');
	assert.deepEqual(await tileSelection(page), ['Audio']);
	await tap(page, 'ArrowDown');
	assert.deepEqual(await tileSelection(page), ['SM_Table'], 'Down goes to the tile below');
	await tap(page, 'ArrowUp');
	assert.deepEqual(await tileSelection(page), ['Audio']);
	await tap(page, 'ArrowLeft');
	assert.deepEqual(await tileSelection(page), ['Architecture']);
	await tap(page, 'End');
	assert.deepEqual(await tileSelection(page), ['T_Brick_Clay_D']);
	await tap(page, 'Home');
	assert.deepEqual(await tileSelection(page), ['Architecture']);
	assert.ok(await hasFocus(tile(page, 'Architecture')));
	await tap(page, 'Shift+ArrowRight', 'Shift+ArrowRight');
	assert.deepEqual(await tileSelection(page), ['Architecture', 'Audio', 'Blueprints'], 'Shift+arrow extends from the anchor');
});

scenario('AssetTile: pinned tiles ignore clicks and hover', 'AssetTile', async (page) => {
	const pinned = page.locator('.AssetTile:not(ue-asset-tile .AssetTile)').first();
	await pinned.click();
	assert.equal(await attr(pinned, 'class'), 'AssetTile AssetTile--folder');
	assert.equal(await fill(cardOf(pinned)), 'rgba(0, 0, 0, 0)', 'a hovered pinned folder tile keeps its look');
});

// ---------------------------------------------------------------- AssetSearchBar

const reference = (page: Page): Locator => page.locator('ue-asset-search-bar').nth(0);
const source = (page: Page): Locator => page.locator('ue-asset-search-bar').nth(1);

scenario('AssetSearchBar: the plus and clear buttons show only with text; Escape and X clear', 'AssetSearchBar', async (page) => {
	const searchField = reference(page).locator('.AssetSearchBar__input');
	const clearButton = reference(page).locator('.AssetSearchBar__clear');
	await hides(clearButton, 'no text, no X');
	await shows(source(page).locator('.AssetSearchBar__plus'), 'the source layout starts with text and shows the plus');

	await searchField.click();
	await page.keyboard.type('chair');
	await shows(clearButton);
	await tap(page, 'Escape');
	assert.equal(await valueOf(searchField), '');
	await hides(clearButton);
	assert.ok(await hasFocus(searchField), 'Escape keeps focus in the field');

	await page.keyboard.type('sofa');
	await clearButton.click();
	assert.equal(await valueOf(searchField), '');

	const sourceField = source(page).locator('.AssetSearchBar__input');
	await sourceField.fill('');
	await hides(source(page).locator('.AssetSearchBar__plus'), 'emptying the field hides the plus');
	await hides(source(page).locator('.AssetSearchBar__clear'));
	await sourceField.fill('a');
	await shows(source(page).locator('.AssetSearchBar__plus'));
});

scenario('AssetSearchBar: the field shows hover and focus outlines', 'AssetSearchBar', async (page) => {
	const field = reference(page).locator('.AssetSearchBar__field');
	await field.hover();
	assert.ok((await prop(field, 'box-shadow')).includes(await token(page, 'hover')));
	await field.locator('input').click();
	assert.ok((await prop(field, 'box-shadow')).includes(await token(page, 'primary')));
	assert.equal(await prop(field.locator('input'), 'color'), await token(page, 'white'), 'focused text is White');
});

scenario('AssetSearchBar: the save and plus buttons show hover and pressed', 'AssetSearchBar', async (page) => {
	const saveButton = reference(page).locator('.AssetSearchBar__btn:not(.AssetSearchBar__filter)');
	await saveButton.hover();
	assert.equal(await fill(saveButton), await token(page, 'dropdown'));
	await mouseDown(page);
	assert.equal(await prop(saveButton, 'padding-top'), '2px', 'pressed content shifts 1px down');
	await mouseUp(page);

	const plus = source(page).locator('.AssetSearchBar__plus');
	await recordEvents(page, 'assetsearchbar:save');
	await plus.hover();
	assert.equal(await fill(plus), await token(page, 'dropdown'));
	await plus.click();
	assert.deepEqual(await recorded(page, 'assetsearchbar:save'), [{ text: 'chair' }]);
});

scenario('AssetSearchBar: the filter menu adds and removes filter pills', 'AssetSearchBar', async (page) => {
	const bar = reference(page);
	const pills = bar.locator('.AssetSearchBar__pillName');
	const entry = (label: string): Locator => bar.locator('.AssetSearchBar__menuitem', { hasText: label });
	await bar.locator('.AssetSearchBar__filter').click();
	assert.deepEqual(await bar.locator('.AssetSearchBar__menuitem').allTextContents(), ['Static Mesh', 'Material', 'Texture', 'Blueprint', 'Level']);
	await entry('Material').click();
	assert.equal(await bar.locator('.AssetSearchBar__menu').count(), 0);
	assert.deepEqual(await pills.allTextContents(), ['Material']);

	await bar.locator('.AssetSearchBar__filter').click();
	assert.equal(await attr(entry('Material'), 'aria-checked'), 'true', 'an active filter is checked');
	await entry('Texture').click();
	assert.deepEqual(await pills.allTextContents(), ['Material', 'Texture']);

	await bar.locator('.AssetSearchBar__pill', { hasText: 'Material' }).locator('.AssetSearchBar__pillRemove').click();
	assert.deepEqual(await pills.allTextContents(), ['Texture'], 'the X removes only its pill');
	await bar.locator('.AssetSearchBar__pillRemove').click();
	assert.equal(await bar.locator('.AssetSearchBar__pill').count(), 0);
});

scenario('AssetSearchBar: the filter menu is keyboard operable', 'AssetSearchBar', async (page) => {
	const bar = reference(page);
	const pills = bar.locator('.AssetSearchBar__pillName');
	await bar.locator('.AssetSearchBar__filter').focus();
	await tap(page, 'Enter', 'ArrowDown', 'ArrowDown', 'Enter');
	assert.deepEqual(await pills.allTextContents(), ['Texture']);
	await tap(page, 'Enter', 'Escape');
	assert.equal(await bar.locator('.AssetSearchBar__menu').count(), 0);
	assert.deepEqual(await pills.allTextContents(), ['Texture']);
});

scenario('AssetSearchBar: the pinned rows stay as drawn', 'AssetSearchBar', async (page) => {
	const pinnedClear = page.locator('.AssetSearchBar__field:not(ue-asset-search-bar .AssetSearchBar__field) .AssetSearchBar__clear');
	assert.equal(await pinnedClear.count(), 2);
	await shows(pinnedClear.first());
	await shows(pinnedClear.last());
});

// ---------------------------------------------------------------- ContentBrowser

const CB = 'ue-content-browser ';
const STARTER = ['Architecture', 'Audio', 'Blueprints', 'HDRI', 'Maps', 'Materials', 'Particles', 'Props', 'Shapes', 'Textures'];
const cbTiles = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__tile');
const cbCrumbs = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__crumb');
const cbStatus = async (page: Page): Promise<string> => ((await page.locator(CB + '.ContentBrowser__status').textContent()) ?? '').trim();
const cbRow = (page: Page, name: string): Locator => page.locator(CB + '.ContentBrowser__row', { hasText: exactly(name) });
const cbTile = (page: Page, name: string): Locator => page.locator(CB + '.ContentBrowser__tile', { hasText: exactly(name) });
const cbSelectedRow = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__row--sel');
const cbPicked = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__tile.is-sel');

scenario('ContentBrowser: opens as the reference shows', 'ContentBrowser', async (page) => {
	assert.deepEqual(await cbTiles(page), STARTER);
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent']);
	assert.equal(await cbStatus(page), '10 items (1 selected)');
	assert.deepEqual(await cbSelectedRow(page), ['StarterContent']);
	assert.equal(await fill(cbRow(page, 'StarterContent')), await token(page, 'select-inactive'));
	assert.equal(await fill(cbRow(page, 'Content')), await token(page, 'select-parent'));
	assert.ok(!(await page.locator(CB + '.ContentBrowser__nav--back').isDisabled()));
	assert.ok(await page.locator(CB + '.ContentBrowser__nav--fwd').isDisabled());
	assert.deepEqual(await cbPicked(page), ['Blueprints']);
});

scenario('ContentBrowser: a double-clicked tile navigates; breadcrumb, tree, tiles and Back/Forward follow', 'ContentBrowser', async (page) => {
	const back = page.locator(CB + '.ContentBrowser__nav--back');
	const fwd = page.locator(CB + '.ContentBrowser__nav--fwd');
	await cbTile(page, 'Audio').dblclick();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent', 'Audio']);
	assert.deepEqual(await cbTiles(page), ['Music', 'Ambient']);
	assert.deepEqual(await cbSelectedRow(page), ['Audio']);
	assert.equal(await cbStatus(page), '2 items');
	assert.equal(await attr(page.locator(CB + '.ContentBrowser__input'), 'placeholder'), 'Search Audio');
	assert.ok(await fwd.isDisabled());

	await back.click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent']);
	assert.deepEqual(await cbTiles(page), STARTER);
	assert.deepEqual(await cbSelectedRow(page), ['StarterContent']);
	assert.ok(!(await fwd.isDisabled()));
	await back.click();
	assert.deepEqual(await cbTiles(page), ['StarterContent']);
	assert.equal(await cbStatus(page), '1 item');
	assert.ok(await back.isDisabled(), 'the start of the history disables Back');
	assert.deepEqual(await cbSelectedRow(page), ['Content']);

	await fwd.click();
	await fwd.click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent', 'Audio']);
	assert.ok(await fwd.isDisabled());
});

scenario('ContentBrowser: tree clicks navigate, the arrow expands without navigating', 'ContentBrowser', async (page) => {
	await cbRow(page, 'Architecture').locator('.ContentBrowser__exp').click();
	await shows(cbRow(page, 'Walls'), 'the arrow opens the folder');
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent'], 'and does not navigate');

	await cbRow(page, 'Walls').click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent', 'Architecture', 'Walls']);
	assert.deepEqual(await cbTiles(page), []);
	assert.equal(await cbStatus(page), '0 items');
	assert.equal(await fill(cbRow(page, 'Walls')), await token(page, 'select'), 'the focused tree shows the active selection');
	assert.equal(await fill(cbRow(page, 'Architecture')), await token(page, 'select-parent'));

	await cbRow(page, 'Architecture').locator('.ContentBrowser__exp').click();
	assert.deepEqual(await cbSelectedRow(page), ['Architecture'], 'collapsing an ancestor of the selection selects it');
	assert.deepEqual(await cbTiles(page), ['Walls', 'Floors']);
});

scenario('ContentBrowser: breadcrumb crumbs navigate and the trail shortens', 'ContentBrowser', async (page) => {
	await page.locator(CB + '.ContentBrowser__crumb', { hasText: 'Content' }).first().click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content']);
	assert.equal(await page.locator(CB + '.ContentBrowser__delim').count(), 2);
	assert.deepEqual(await cbSelectedRow(page), ['Content']);
	assert.deepEqual(await cbTiles(page), ['StarterContent']);
	await page.locator(CB + '.ContentBrowser__crumb', { hasText: 'All' }).click();
	assert.deepEqual(await cbCrumbs(page), ['All']);
	assert.deepEqual(await cbTiles(page), ['Content']);
	assert.equal(await cbStatus(page), '1 item');
});

scenario('ContentBrowser: the search box filters tiles and the item count follows', 'ContentBrowser', async (page) => {
	const searchField = page.locator(CB + '.ContentBrowser__input');
	const clearButton = page.locator(CB + '.ContentBrowser__clear');
	await hides(clearButton);
	await searchField.click();
	await page.keyboard.type('ma');
	assert.deepEqual(await cbTiles(page), ['Maps', 'Materials']);
	assert.equal(await cbStatus(page), '2 items');
	await shows(clearButton);
	await searchField.fill('HDRI');
	assert.deepEqual(await cbTiles(page), ['HDRI'], 'matching ignores case');
	assert.equal(await cbStatus(page), '1 item');
	await searchField.fill('zzz');
	assert.equal(await cbStatus(page), '0 items');
	await tap(page, 'Escape');
	assert.equal(await valueOf(searchField), '');
	assert.equal(await cbStatus(page), '10 items (1 selected)');
	await searchField.fill('p');
	await clearButton.click();
	assert.deepEqual(await cbTiles(page), STARTER);
});

scenario('ContentBrowser: tiles show hover, select, multi-select and the selected count', 'ContentBrowser', async (page) => {
	const card = (name: string): Locator => cbTile(page, name).locator('.ContentBrowser__card');
	await cbTile(page, 'Props').hover();
	assert.equal(await fill(card('Props')), await token(page, 'secondary'));
	await cbTile(page, 'Audio').click();
	assert.equal(await cbStatus(page), '10 items (1 selected)');
	assert.deepEqual(await cbPicked(page), ['Audio'], 'a plain click replaces the selection');
	await cbTile(page, 'Props').click({ modifiers: ['Control'] });
	assert.equal(await cbStatus(page), '10 items (2 selected)');
	await cbTile(page, 'Textures').click({ modifiers: ['Shift'] });
	assert.equal(await cbStatus(page), '10 items (3 selected)', 'Shift+click selects from the anchor to the tile');
	assert.deepEqual(await cbPicked(page), ['Props', 'Shapes', 'Textures']);
	await farAway(page);
	assert.ok((await prop(card('Props'), 'box-shadow')).includes(await token(page, 'primary')));
});

scenario('ContentBrowser: tile and tree keyboard navigation', 'ContentBrowser', async (page) => {
	await cbTile(page, 'Architecture').click();
	await tap(page, 'ArrowRight');
	assert.deepEqual(await cbPicked(page), ['Audio']);
	await tap(page, 'Enter');
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent', 'Audio'], 'Enter opens the focused folder tile');

	await cbRow(page, 'Audio').focus();
	await tap(page, 'ArrowUp');
	assert.deepEqual(await cbSelectedRow(page), ['Architecture'], 'Up in the tree navigates to the row above');
	assert.deepEqual(await cbTiles(page), ['Walls', 'Floors']);
	await tap(page, 'ArrowUp');
	assert.deepEqual(await cbSelectedRow(page), ['StarterContent']);
	assert.deepEqual(await cbTiles(page), STARTER);
	await tap(page, 'ArrowLeft');
	assert.equal(await cbRow(page, 'Architecture').count(), 0, 'Left collapses the open folder');
	await tap(page, 'ArrowRight', 'ArrowRight');
	assert.deepEqual(await cbSelectedRow(page), ['Architecture'], 'Right opens, Right again enters the first child');
});

scenario('ContentBrowser: the splitter drags and resizes the columns', 'ContentBrowser', async (page) => {
	const split = page.locator(CB + '.ContentBrowser__split');
	const sources = page.locator(CB + '.ContentBrowser__sources');
	const assets = page.locator(CB + '.ContentBrowser__assets');
	const widthOf = async (target: Locator): Promise<number> => Math.round((await target.boundingBox())?.width ?? 0);
	assert.equal(await widthOf(sources), 340);
	const assetsBefore = await widthOf(assets);
	const box = await split.boundingBox();
	assert.ok(box);
	const y = box.y + 80;
	await page.mouse.move(box.x + 1, y);
	assert.equal(await fill(split), await token(page, 'secondary'), 'the handle highlights on hover');
	await mouseDown(page);
	await page.mouse.move(box.x + 61, y, { steps: 6 });
	await page.mouse.move(box.x + 101, y, { steps: 6 });
	assert.ok(await hasClass(split, 'is-dragging'));
	await mouseUp(page);
	assert.equal(await widthOf(sources), 440);
	assert.equal(await widthOf(assets), assetsBefore - 100, 'the asset area gives up the same width');
	assert.equal(await attr(split, 'aria-valuenow'), '440');

	const moved = (await split.boundingBox())?.x ?? 0;
	await page.mouse.move(moved + 1, y);
	await mouseDown(page);
	await page.mouse.move(moved - 600, y, { steps: 8 });
	await mouseUp(page);
	assert.equal(await widthOf(sources), 120, 'the source column stops at its minimum');

	await split.focus();
	await tap(page, 'ArrowRight');
	assert.equal(await widthOf(sources), 130);
});

scenario('ContentBrowser: tiles wrap and the area scrolls when the asset column shrinks', 'ContentBrowser', async (page) => {
	const box = await page.locator(CB + '.ContentBrowser__split').boundingBox();
	assert.ok(box);
	await page.mouse.move(box.x + 1, box.y + 80);
	await mouseDown(page);
	await page.mouse.move(box.x + 601, box.y + 80, { steps: 12 });
	await mouseUp(page);
	const scrolls = await page.locator(CB + '.ContentBrowser__tiles').evaluate((el) => el.scrollHeight > el.clientHeight);
	assert.ok(scrolls, 'ten tiles no longer fit one row');
});

scenario('ContentBrowser: section headers collapse, search toggles press, menus open, buttons press', 'ContentBrowser', async (page) => {
	const project = page.locator(CB + '.ContentBrowser__title', { hasText: 'LevelDesignProject' });
	const folders = page.locator(CB + '.ContentBrowser__tree[data-folders]');
	await project.click();
	await hides(folders);
	await project.click();
	await shows(folders);

	const tool = page.locator(CB + '.ContentBrowser__tool').first();
	await tool.click();
	assert.equal(await attr(tool, 'aria-pressed'), 'true');
	assert.equal(await fill(tool), await token(page, 'primary-hover'));

	const items = page.locator(CB + '.ContentBrowser__menuitem');
	await page.locator(CB + '.ContentBrowser__settings').click();
	assert.equal(await items.count(), 6);
	await tap(page, 'Escape');
	await page.locator(CB + '.ContentBrowser__add').click();
	assert.equal(await items.first().textContent(), 'Import to Current Folder');
	await tap(page, 'Escape');
	assert.equal(await page.locator(CB + '.ContentBrowser__menu').count(), 0);

	const importButton = page.locator(CB + '.ContentBrowser__btn').first();
	await importButton.hover();
	assert.equal(await fill(importButton), await token(page, 'dropdown'));
	await mouseDown(page);
	assert.equal(await prop(importButton, 'padding-top'), '4px');
	await mouseUp(page);
	await cbRow(page, 'Props').hover();
	assert.equal(await fill(cbRow(page, 'Props')), await token(page, 'select-hover'));
});
