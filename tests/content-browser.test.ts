/// <reference lib="dom" />
// Behaviour tests for the Content Browser group: ContentToolbar, SourcePanel, AssetTile, AssetSearchBar, ContentBrowser.
import { strict as assert } from 'node:assert';
<<<<<<< HEAD
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { Page, Locator } from 'playwright';
import { root } from './lib.ts';
import { scenario } from './scenario.ts';
import { token, prop, fill, texts, hasClass, after } from './probe.ts';
import { assertInert, clickAt } from './pinned.ts';
=======
import type { Page, Locator } from 'playwright';
import { scenario } from './scenario.ts';
import { token, prop, fill, texts, hasClass } from './probe.ts';
>>>>>>> origin/master

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
<<<<<<< HEAD
	const live = document.querySelector(tag + ':not([data-pinned], [data-pinned] *)');
=======
	const live = document.querySelector(tag);
>>>>>>> origin/master
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

<<<<<<< HEAD
// ---------------------------------------------------------------- composition

const COMPOSITES = ['ContentToolbar', 'AssetSearchBar', 'SourcePanel', 'ContentBrowser'];
const read = (...parts: string[]): string => fs.readFileSync(path.join(root, ...parts), 'utf8');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

// A composite style may hold its own layout only. The primitives own their classes.
const PRIMITIVE_CLASS = /\.(button|combobutton|combobutton-anchor|combobutton-menu|popupmenu|textinput|expandablearea|tr-[a-z-]+|is-compact|splitter|splitter-pane|splitter-handle|AssetTile|AssetTile-grid|AssetTile__[A-Za-z]+|FilterPills-[A-Za-z]+)(__[a-z-]+|--[A-Za-z-]+)?(?![\w-])/;
// The classes the composites drew before they were built from the primitives.
const OLD_CLASS = /\b(ContentBrowser__(top|tools|sep|add2?|btn|nav|path|folder|crumb|delim|settings|split|sourcesFrame|area|head|arrow|title|tool|tree|row|exp|fi|name|search|field|hint|ibtn|input|clear|tile|card|thumb|label|menu\w*)|ContentToolbar__(add|btn|crumb|delim|settings|menu\w*|nav--\w+)|AssetSearchBar__(input|clear|btn|filter\w*|glass|inputText|pill\w*|menu\w*)|SourcePanel__(row\w*|exp|folder|name|tool|add|header|arrow|tree|indent|scroll))\b/;

for (const name of COMPOSITES) {
	test(name + ': its style holds layout only and no class of the old copies remains', () => {
		const sources = [read('src', name, name + '.css'), ...Array.from(read('components', name, 'preview.html').matchAll(/<style>([\s\S]*?)<\/style>/g), (m) => m[1])];
		const hit = PRIMITIVE_CLASS.exec(stripComments(sources.join('\n')));
		assert.equal(hit, null, 'a primitive class in a composite style: ' + hit?.[0]);
		for (const file of [read('src', name, name + '.ts'), read('src', name, name + '.css'), read('components', name, 'preview.html')]) {
			const old = OLD_CLASS.exec(file);
			assert.equal(old, null, 'an old duplicate class: ' + old?.[0]);
		}
	});
}

test('the Content Browser menu helper is gone', () => {
	assert.equal(fs.existsSync(path.join(root, 'src', '_shared', 'contentMenu.ts')), false);
});

// ---------------------------------------------------------------- ContentToolbar

const TB = 'ue-content-toolbar ';
const tbAction = (page: Page, name: string): Locator => page.locator(TB + '[data-action="' + name + '"]');
const tbButton = (page: Page, name: string): Locator => tbAction(page, name).locator('.button');
const tbTrigger = (page: Page, name: string): Locator => tbAction(page, name).locator('.combobutton');
const tbPanel = (page: Page, name: string): Locator => tbAction(page, name).locator('.combobutton-menu');
const tbRow = (page: Page, name: string, label: string): Locator => tbAction(page, name).locator('.popupmenu__row', { hasText: label });
const tbCrumb = (page: Page): Locator => page.locator(TB + 'ue-button[data-crumb] .button');
const tbCrumbs = (page: Page): Promise<string[]> => texts(page, TB + 'ue-button[data-crumb] .button');

scenario('ContentToolbar: hover and pressed states of the buttons', 'ContentToolbar', async (page) => {
	const importButton = tbButton(page, 'import');
=======
// ---------------------------------------------------------------- ContentToolbar

const TB = 'ue-content-toolbar ';
const tbCrumbs = (page: Page): Promise<string[]> => texts(page, TB + '.ContentToolbar__crumb');

scenario('ContentToolbar: hover and pressed states of the buttons', 'ContentToolbar', async (page) => {
	const importButton = page.locator(TB + '.ContentToolbar__btn').first();
>>>>>>> origin/master
	await importButton.hover();
	assert.equal(await fill(importButton), await token(page, 'dropdown'));
	await mouseDown(page);
	assert.equal(await fill(importButton), await token(page, 'dropdown'));
	assert.equal(await prop(importButton, 'padding-top'), '4px', 'pressed content shifts 1px down');
<<<<<<< HEAD
	assert.equal(await prop(importButton, 'padding-left'), '4px', 'the toolbar button keeps its tight side padding while pressed');
	await mouseUp(page);

	const addButton = tbTrigger(page, 'add');
=======
	await mouseUp(page);

	const addButton = page.locator(TB + '.ContentToolbar__add');
>>>>>>> origin/master
	await addButton.hover();
	assert.equal(await fill(addButton), await token(page, 'hover'));
	await mouseDown(page);
	assert.equal(await fill(addButton), await token(page, 'header'), 'Add is a Button: pressed fill is Header');
	await mouseUp(page);
});

scenario('ContentToolbar: crumbs navigate and Back/Forward walk the history', 'ContentToolbar', async (page) => {
<<<<<<< HEAD
	const back = tbButton(page, 'back');
	const fwd = tbButton(page, 'forward');
=======
	const back = page.locator(TB + '.ContentToolbar__nav--back');
	const fwd = page.locator(TB + '.ContentToolbar__nav--fwd');
>>>>>>> origin/master
	assert.ok(await back.isDisabled(), 'Back starts disabled');
	assert.ok(await fwd.isDisabled(), 'Forward starts disabled');
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content', 'StarterContent']);

<<<<<<< HEAD
	await tbCrumb(page).filter({ hasText: 'Content' }).first().click();
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content']);
	assert.equal(await page.locator(TB + 'ue-combo-button[data-crumb-menu]').count(), 2, 'a chevron follows each crumb');
=======
	await page.locator(TB + '.ContentToolbar__crumb', { hasText: 'Content' }).first().click();
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content']);
	assert.equal(await page.locator(TB + '.ContentToolbar__delim').count(), 2, 'a chevron follows each crumb');
>>>>>>> origin/master
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
<<<<<<< HEAD
	const chevron = page.locator(TB + '[data-crumb-menu="1"] .combobutton');
	const rows = page.locator(TB + '[data-crumb-menu="1"] .popupmenu__row');
	await chevron.click();
	assert.equal(await attr(chevron, 'aria-expanded'), 'true');
	await shows(page.locator(TB + '[data-crumb-menu="1"] .combobutton-menu'), 'the sub-folder menu opens');
	assert.deepEqual(await rows.allTextContents(), ['StarterContent', 'Developers']);
	await rows.filter({ hasText: 'Developers' }).click();
	assert.deepEqual(await tbCrumbs(page), ['All', 'Content', 'Developers']);
	assert.equal(await page.locator(TB + '.combobutton-menu:visible').count(), 0, 'picking closes the menu');
});

scenario('ContentToolbar: the Add menu fires its rows and the button keeps its label', 'ContentToolbar', async (page) => {
	await recordEvents(page, 'ue-combo-pick');
	await tbTrigger(page, 'add').click();
	assert.deepEqual(await tbAction(page, 'add').locator('.popupmenu__row').allTextContents(), ['Import to Current Folder', 'New Folder', 'Blueprint Class', 'Level', 'Material']);
	await tbRow(page, 'add', 'New Folder').click();
	assert.deepEqual(await recorded(page, 'ue-combo-pick'), [{ value: 'New Folder', label: 'New Folder', checked: null }]);
	assert.equal((await tbTrigger(page, 'add').textContent())?.trim(), 'Add', 'an action menu never changes the label');
});

scenario('ContentToolbar: the Settings menu toggles checks and works from the keyboard', 'ContentToolbar', async (page) => {
	const settingsButton = tbTrigger(page, 'settings');
	const panel = tbPanel(page, 'settings');
	await settingsButton.click();
	assert.equal(await attr(settingsButton, 'aria-expanded'), 'true');
	await shows(panel);
	assert.equal(await attr(tbRow(page, 'settings', 'Show Folders'), 'aria-checked'), 'true');
	assert.equal(await attr(tbRow(page, 'settings', 'Show Empty Folders'), 'aria-checked'), 'false');

	await tap(page, 'Escape');
	await hides(panel);
	assert.ok(await hasFocus(settingsButton), 'Escape returns focus to the button');
	assert.equal(await attr(settingsButton, 'aria-expanded'), 'false');

	await tap(page, 'Enter');
	assert.equal(await fill(tbRow(page, 'settings', 'Show Folders')), await token(page, 'primary'), 'a keyboard open makes the first row current: Primary');
	await tap(page, 'ArrowDown', 'Enter');
	await hides(panel);
	await settingsButton.click();
	assert.equal(await attr(tbRow(page, 'settings', 'Show Empty Folders'), 'aria-checked'), 'true', 'the toggled check persists');

	await page.mouse.click(980, 780);
	await hides(panel, 'an outside click closes the menu');
});

scenario('ContentToolbar: pinned specimens stay static and a copied instance is independent', 'ContentToolbar', async (page) => {
	const pinned = page.locator('[data-pinned] .ContentToolbar').first();
	await assertInert(pinned);
	await clickAt(page, pinned.locator('.button', { hasText: 'Content' }).first());
	assert.equal(await pinned.locator('.button--tight').filter({ hasText: /^(All|Content|StarterContent)$/ }).count(), 3, 'a pinned toolbar does not navigate');
	assert.ok((await pinned.locator('[disabled]').count()) > 0, 'the pinned forward arrow stays disabled');
=======
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
>>>>>>> origin/master

	await page.evaluate(duplicateFirst, 'ue-content-toolbar');
	assert.equal(await page.locator('ue-content-toolbar').count(), 2);
	const copy = page.locator('ue-content-toolbar').nth(1);
<<<<<<< HEAD
	await copy.locator('ue-button[data-crumb] .button', { hasText: 'Content' }).first().click();
	assert.deepEqual(await copy.locator('ue-button[data-crumb] .button').allTextContents(), ['All', 'Content']);
	assert.deepEqual(await page.locator('ue-content-toolbar').nth(0).locator('ue-button[data-crumb] .button').allTextContents(), ['All', 'Content', 'StarterContent'], 'the original keeps its own history');
=======
	await copy.locator('.ContentToolbar__crumb', { hasText: 'Content' }).first().click();
	assert.deepEqual(await copy.locator('.ContentToolbar__crumb').allTextContents(), ['All', 'Content']);
	assert.deepEqual(await page.locator('ue-content-toolbar').nth(0).locator('.ContentToolbar__crumb').allTextContents(), ['All', 'Content', 'StarterContent'], 'the original keeps its own history');
>>>>>>> origin/master
});

// ---------------------------------------------------------------- SourcePanel

<<<<<<< HEAD
const SP = 'ue-source-panel ';
const spRow = (page: Page, name: string): Locator => page.locator(SP + '.tr-row', { hasText: exactly(name) });
const spSelected = (page: Page): Promise<string[]> => texts(page, SP + '.tr-row[aria-selected="true"]');
const spHeader = (page: Page, title: string): Locator => page.locator(SP + '.expandablearea__header', { hasText: title });
=======
const spRow = (page: Page, name: string): Locator => page.locator('ue-source-panel .SourcePanel__row', { hasText: exactly(name) });
const spSelected = (page: Page): Promise<string[]> => texts(page, 'ue-source-panel .SourcePanel__row[aria-selected="true"]');
>>>>>>> origin/master

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
<<<<<<< HEAD
	await spRow(page, 'Audio').locator('.tr-arrow').click();
	await shows(spRow(page, 'Music'));
	await shows(spRow(page, 'Ambient'));
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-expanded'), 'true');
	assert.ok(await hasClass(spRow(page, 'Audio'), 'is-open'), 'an open folder shows the open icon');
	assert.equal(await prop(spRow(page, 'Audio').locator('.tr-folder-closed'), 'display'), 'none');
	assert.equal(await attr(spRow(page, 'StarterContent'), 'aria-selected'), 'true', 'the arrow does not move the selection');

	await spRow(page, 'Audio').locator('.tr-arrow').click();
	await hides(spRow(page, 'Music'));
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-expanded'), 'false');
=======
	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
	await shows(spRow(page, 'Music'));
	await shows(spRow(page, 'Ambient'));
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-expanded'), 'true');
	assert.equal(await attr(spRow(page, 'Audio').locator('.SourcePanel__folder use'), 'href'), '#sp-fo', 'an open folder shows the open icon');
	assert.equal(await attr(spRow(page, 'StarterContent'), 'aria-selected'), 'true', 'the arrow does not move the selection');

	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
	await hides(spRow(page, 'Music'));
	assert.equal(await attr(spRow(page, 'Audio').locator('.SourcePanel__exp use'), 'href'), '#sp-caret-r');
>>>>>>> origin/master
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
<<<<<<< HEAD
	await spRow(page, 'Audio').locator('.tr-arrow').click();
	await spRow(page, 'Music').click();
	assert.equal(await attr(spRow(page, 'Music'), 'aria-selected'), 'true');
	await spRow(page, 'Audio').locator('.tr-arrow').click();
=======
	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
	await spRow(page, 'Music').click();
	assert.equal(await attr(spRow(page, 'Music'), 'aria-selected'), 'true');
	await spRow(page, 'Audio').locator('.SourcePanel__exp').click();
>>>>>>> origin/master
	assert.equal(await attr(spRow(page, 'Audio'), 'aria-selected'), 'true');
	await hides(spRow(page, 'Music'));
});

<<<<<<< HEAD
scenario('SourcePanel: one selection spans all the trees and sourcepanel:select reports it', 'SourcePanel', async (page) => {
	await recordEvents(page, 'sourcepanel:select');
	await spHeader(page, 'Favorites').click();
	await spRow(page, 'PropsLibrary').click();
	assert.deepEqual(await spSelected(page), ['PropsLibrary'], 'selecting in another tree clears the project selection');
	await spRow(page, 'Props').click();
	assert.deepEqual(await spSelected(page), ['Props']);
	assert.deepEqual(await recorded(page, 'sourcepanel:select'), [{ id: 'Favorites/PropsLibrary', name: 'PropsLibrary' }, { id: 'All/Content/StarterContent/Props', name: 'Props' }]);
});

scenario('SourcePanel: section headers collapse and expand', 'SourcePanel', async (page) => {
	const project = spHeader(page, 'LevelDesignProject');
	const favorites = spHeader(page, 'Favorites');
	const projectBody = after(project);
=======
scenario('SourcePanel: section headers collapse and expand', 'SourcePanel', async (page) => {
	const areas = page.locator('ue-source-panel .SourcePanel__area');
	const project = page.locator('ue-source-panel .SourcePanel__title', { hasText: 'LevelDesignProject' });
	const favorites = page.locator('ue-source-panel .SourcePanel__title', { hasText: 'Favorites' });
	const projectBody = areas.nth(1).locator('.SourcePanel__body');
>>>>>>> origin/master
	await shows(projectBody);
	await project.click();
	await hides(projectBody);
	assert.equal(await attr(project, 'aria-expanded'), 'false');
<<<<<<< HEAD
	await project.click();
	await shows(projectBody);

	await page.locator(SP + '.expandablearea__caret').first().click();
	await shows(after(favorites), 'clicking the caret expands the section');
=======
	assert.equal(await attr(areas.nth(1).locator('.SourcePanel__arrow use'), 'href'), '#sp-caret-r');
	await project.click();
	await shows(projectBody);

	await page.locator('ue-source-panel .SourcePanel__arrow').first().click();
	await shows(areas.first().locator('.SourcePanel__body'), 'clicking the caret expands the section');
>>>>>>> origin/master
	await favorites.focus();
	await tap(page, 'Enter');
	assert.equal(await attr(favorites, 'aria-expanded'), 'false', 'Enter toggles the focused header');
});

scenario('SourcePanel: search toggles show hover, pressed and checked colours; the plus adds a collection', 'SourcePanel', async (page) => {
<<<<<<< HEAD
	const tool = page.locator(SP + 'ue-button[data-action="search"] .button').first();
=======
	const tool = page.locator('ue-source-panel .SourcePanel__tool').first();
>>>>>>> origin/master
	await tool.hover();
	assert.equal(await fill(tool), await token(page, 'dropdown'));
	await tool.click();
	assert.equal(await attr(tool, 'aria-pressed'), 'true');
	assert.equal(await fill(tool), await token(page, 'primary-hover'), 'checked and hovered');
	await farAway(page);
	assert.equal(await fill(tool), await token(page, 'primary'), 'checked');
<<<<<<< HEAD
	assert.equal(await attr(spHeader(page, 'Favorites'), 'aria-expanded'), 'false', 'a header button does not fold its section');
	await tool.click();
	assert.equal(await attr(tool, 'aria-pressed'), 'false');

	await page.locator(SP + 'ue-button[data-action="add-collection"] .button').click();
	assert.equal(await attr(spHeader(page, 'Collections'), 'aria-expanded'), 'true');
	assert.equal(await attr(spRow(page, 'NewCollection2'), 'aria-selected'), 'true');
});

scenario('SourcePanel: the pinned panel runs no setup and does not react', 'SourcePanel', async (page) => {
	const pinned = page.locator('[data-pinned] .SourcePanel');
	await assertInert(pinned);
	const pinnedRow = pinned.locator('.tr-row', { hasText: 'Architecture' });
	await clickAt(page, pinnedRow);
	assert.equal(await attr(pinnedRow, 'class'), 'tr-row');
	const selected = pinned.locator('.tr-row.is-selected');
	assert.equal(await selected.count(), 1, 'the click selected nothing');
	assert.equal(await fill(selected), await token(page, 'select-inactive'), 'the pinned selected row keeps its drawn fill');
	assert.equal(await fill(pinned.locator('.tr-row.is-hover')), await token(page, 'select-hover'));
=======
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
>>>>>>> origin/master
});

// ---------------------------------------------------------------- AssetTile

const tile = (page: Page, name: string): Locator => page.locator('ue-asset-tile .AssetTile', { has: page.locator('.AssetTile__name', { hasText: exactly(name) }) });
const tileSelection = (page: Page): Promise<string[]> => texts(page, 'ue-asset-tile .AssetTile.is-selected .AssetTile__name');
const cardOf = (target: Locator): Locator => target.locator('.AssetTile__card');
<<<<<<< HEAD
const liveStatus = (page: Page, index: number): Locator => page.locator('ue-asset-tile').first().locator('ue-event-status').nth(index);
=======
>>>>>>> origin/master

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
<<<<<<< HEAD
	assert.equal(await liveStatus(page, 0).textContent(), 'Selected: Audio,Materials. ');
=======
	assert.equal(await page.locator('ue-asset-tile .AssetTilePreview__status').textContent(), '2 selected: Audio, Materials');
>>>>>>> origin/master
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
<<<<<<< HEAD
	await recordEvents(page, 'ue-tile-open');
	await tile(page, 'Audio').dblclick();
	assert.deepEqual(await recorded(page, 'ue-tile-open'), [{ id: 'Audio' }]);
	assert.equal(await liveStatus(page, 1).textContent(), 'Opened: Audio');
	await tile(page, 'SM_Chair').focus();
	await tap(page, 'Enter');
	assert.deepEqual((await recorded(page, 'ue-tile-open')).pop(), { id: 'SM_Chair' });
});

scenario('AssetTile: ue-tile-select reports the ids and fires only when the selection changes', 'AssetTile', async (page) => {
	await recordEvents(page, 'ue-tile-select');
	await tile(page, 'Audio').click();
	await tile(page, 'Audio').click();
	await tile(page, 'SM_Table').click({ modifiers: ['Control'] });
	await tap(page, 'Control+a');
	assert.deepEqual(await recorded(page, 'ue-tile-select'), [
		{ ids: ['Audio'] },
		{ ids: ['Audio', 'SM_Table'] },
		{ ids: ['Architecture', 'Audio', 'Blueprints', 'Materials', 'SM_Chair', 'SM_Table', 'M_Wood_Floor_Walnut_Polished', 'T_Brick_Clay_D'] },
	], 'a click on the selected tile changes nothing, so it fires nothing');
});

scenario('AssetTile: a single-select grid picks one tile whatever the modifiers', 'AssetTile', async (page) => {
	const single = page.locator('ue-asset-tile[select="single"]');
	const item = (name: string): Locator => single.locator('.AssetTile', { has: page.locator('.AssetTile__name', { hasText: exactly(name) }) });
	await recordEvents(page, 'ue-tile-select');
	await item('Textures').click();
	await item('M_Metal').click({ modifiers: ['Control'] });
	await item('SM_Lamp').click({ modifiers: ['Shift'] });
	assert.deepEqual(await texts(page, 'ue-asset-tile[select="single"] .AssetTile.is-selected .AssetTile__name'), ['SM_Lamp']);
	assert.deepEqual(await recorded(page, 'ue-tile-select'), [{ ids: ['textures'] }, { ids: ['m_metal'] }, { ids: ['sm_lamp'] }], 'data-id is the id');
	await tap(page, 'ArrowRight');
	await tap(page, 'Control+a');
	assert.deepEqual(await texts(page, 'ue-asset-tile[select="single"] .AssetTile.is-selected .AssetTile__name'), ['M_Metal'], 'Ctrl+A selects nothing extra');
	assert.equal(await single.locator('.AssetTile-grid').getAttribute('aria-multiselectable'), 'false');
	assert.deepEqual(await tileSelection(page), ['M_Metal'], 'the other grid kept nothing selected');
});

scenario('AssetTile: setTiles draws folder and asset tiles from data, and select() and the ids follow', 'AssetTile', async (page) => {
	await page.evaluate(() => {
		const grid = document.createElement('ue-asset-tile') as HTMLElement & { setTiles(tiles: object[]): void };
		grid.id = 'at-data';
		document.body.append(grid);
		grid.setTiles([
			{ id: 'f1', label: 'Maps', kind: 'folder' },
			{ id: 'a1', label: 'SM_Rock_With_A_Rather_Long_Name', kind: 'asset', typeLabel: 'Static Mesh', strip: '#ff0000' },
			{ id: 'a2', label: 'T_Noise', kind: 'asset', typeLabel: 'Texture', thumb: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', selected: true },
		]);
	});
	const data = page.locator('#at-data');
	assert.equal(await data.locator('.AssetTile-grid').getAttribute('role'), 'listbox');
	assert.equal(await data.locator('.AssetTile').count(), 3);
	assert.equal(await data.locator('.AssetTile--folder .AssetTile__folderIcon').count(), 1);
	assert.equal(await data.locator('.AssetTile--asset').nth(0).locator('.AssetTile__class').textContent(), 'Static Mesh');
	assert.equal(await data.locator('.AssetTile--asset').nth(0).locator('.AssetTile__strip').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(255, 0, 0)');
	assert.equal(await data.locator('.AssetTile__image').count(), 1, 'a thumb URL draws an image');
	assert.equal(await data.locator('.AssetTile--asset').nth(0).locator('svg').count(), 1, 'an asset without a thumb draws the cube');
	assert.equal(await data.locator('.AssetTile.is-selected').getAttribute('data-id'), 'a2');
	assert.equal(await data.locator('.AssetTile').nth(0).getAttribute('role'), 'option');
	assert.equal(await data.locator('.AssetTile[tabindex="0"]').getAttribute('data-id'), 'a2', 'the selected tile takes the Tab stop');
	await recordEvents(page, 'ue-tile-select');
	await data.locator('.AssetTile--folder').click();
	await data.locator('.AssetTile[data-id="a1"]').click({ modifiers: ['Control'] });
	assert.deepEqual(await recorded(page, 'ue-tile-select'), [{ ids: ['f1'] }, { ids: ['f1', 'a1'] }]);
	assert.deepEqual(await page.evaluate(() => (document.querySelector('#at-data') as HTMLElement & { getSelectedIds(): string[] }).getSelectedIds()), ['f1', 'a1']);
	await page.evaluate(() => (document.querySelector('#at-data') as HTMLElement & { select(ids: string[]): void }).select(['a2']));
	assert.deepEqual(await recorded(page, 'ue-tile-select').then((all) => all.at(-1)), { ids: ['a2'] });
	await data.locator('.AssetTile[data-id="a2"]').focus();
	await recordEvents(page, 'ue-tile-open');
	await tap(page, 'Enter');
	assert.deepEqual(await recorded(page, 'ue-tile-open'), [{ id: 'a2' }]);
=======
	await recordEvents(page, 'assettile:open');
	await tile(page, 'Audio').dblclick();
	assert.deepEqual(await recorded(page, 'assettile:open'), [{ name: 'Audio', folder: true }]);
	assert.match((await page.locator('ue-asset-tile .AssetTilePreview__status').textContent()) ?? '', /Opened: Audio/);
	await tile(page, 'SM_Chair').focus();
	await tap(page, 'Enter');
	assert.deepEqual((await recorded(page, 'assettile:open')).pop(), { name: 'SM_Chair', folder: false });
>>>>>>> origin/master
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
<<<<<<< HEAD
	await assertInert(pinned);
	await clickAt(page, pinned);
=======
	await pinned.click();
>>>>>>> origin/master
	assert.equal(await attr(pinned, 'class'), 'AssetTile AssetTile--folder');
	assert.equal(await fill(cardOf(pinned)), 'rgba(0, 0, 0, 0)', 'a hovered pinned folder tile keeps its look');
});

// ---------------------------------------------------------------- AssetSearchBar

const reference = (page: Page): Locator => page.locator('ue-asset-search-bar').nth(0);
const source = (page: Page): Locator => page.locator('ue-asset-search-bar').nth(1);

scenario('AssetSearchBar: the plus and clear buttons show only with text; Escape and X clear', 'AssetSearchBar', async (page) => {
<<<<<<< HEAD
	const searchField = reference(page).locator('.textinput__field');
	const clearButton = reference(page).locator('.textinput__clear');
=======
	const searchField = reference(page).locator('.AssetSearchBar__input');
	const clearButton = reference(page).locator('.AssetSearchBar__clear');
>>>>>>> origin/master
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

<<<<<<< HEAD
	const sourceField = source(page).locator('.textinput__field');
	await sourceField.fill('');
	await hides(source(page).locator('.AssetSearchBar__plus'), 'emptying the field hides the plus');
	await hides(source(page).locator('.textinput__clear'));
=======
	const sourceField = source(page).locator('.AssetSearchBar__input');
	await sourceField.fill('');
	await hides(source(page).locator('.AssetSearchBar__plus'), 'emptying the field hides the plus');
	await hides(source(page).locator('.AssetSearchBar__clear'));
>>>>>>> origin/master
	await sourceField.fill('a');
	await shows(source(page).locator('.AssetSearchBar__plus'));
});

scenario('AssetSearchBar: the field shows hover and focus outlines', 'AssetSearchBar', async (page) => {
<<<<<<< HEAD
	const field = reference(page).locator('.textinput');
=======
	const field = reference(page).locator('.AssetSearchBar__field');
>>>>>>> origin/master
	await field.hover();
	assert.ok((await prop(field, 'box-shadow')).includes(await token(page, 'hover')));
	await field.locator('input').click();
	assert.ok((await prop(field, 'box-shadow')).includes(await token(page, 'primary')));
	assert.equal(await prop(field.locator('input'), 'color'), await token(page, 'white'), 'focused text is White');
});

scenario('AssetSearchBar: the save and plus buttons show hover and pressed', 'AssetSearchBar', async (page) => {
<<<<<<< HEAD
	const saveButton = reference(page).locator('[data-action="save"] .button');
	await saveButton.hover();
	assert.equal(await fill(saveButton), await token(page, 'dropdown'));
	const rest = Number.parseFloat(await prop(saveButton, 'padding-top'));
	await mouseDown(page);
	assert.equal(Number.parseFloat(await prop(saveButton, 'padding-top')), rest + 1, 'pressed content shifts 1px down');
	await mouseUp(page);

	const plus = source(page).locator('.AssetSearchBar__plus .button');
=======
	const saveButton = reference(page).locator('.AssetSearchBar__btn:not(.AssetSearchBar__filter)');
	await saveButton.hover();
	assert.equal(await fill(saveButton), await token(page, 'dropdown'));
	await mouseDown(page);
	assert.equal(await prop(saveButton, 'padding-top'), '2px', 'pressed content shifts 1px down');
	await mouseUp(page);

	const plus = source(page).locator('.AssetSearchBar__plus');
>>>>>>> origin/master
	await recordEvents(page, 'assetsearchbar:save');
	await plus.hover();
	assert.equal(await fill(plus), await token(page, 'dropdown'));
	await plus.click();
	assert.deepEqual(await recorded(page, 'assetsearchbar:save'), [{ text: 'chair' }]);
});

<<<<<<< HEAD
scenario('AssetSearchBar: the filter menu adds and removes filter chips', 'AssetSearchBar', async (page) => {
	const bar = reference(page);
	const chips = bar.locator('.FilterPills-chipName');
	const trigger = bar.locator('[data-action="filter"] .combobutton');
	const entry = (label: string): Locator => bar.locator('.popupmenu__row', { hasText: label });
	await trigger.click();
	assert.deepEqual(await bar.locator('.popupmenu__row').allTextContents(), ['Static Mesh', 'Material', 'Texture', 'Blueprint', 'Level']);
	await entry('Material').click();
	await hides(bar.locator('.combobutton-menu'), 'picking closes the menu');
	assert.deepEqual(await chips.allTextContents(), ['Material']);

	await trigger.click();
	assert.equal(await attr(entry('Material'), 'aria-checked'), 'true', 'an active filter is checked');
	await entry('Texture').click();
	assert.deepEqual(await chips.allTextContents(), ['Material', 'Texture']);

	await bar.locator('.FilterPills-chip', { hasText: 'Material' }).locator('.FilterPills-chipRemove').click();
	assert.deepEqual(await chips.allTextContents(), ['Texture'], 'the X removes only its chip');
	assert.equal(await attr(entry('Material'), 'aria-checked'), 'false', 'the removed filter is unchecked in the menu');
	await bar.locator('.FilterPills-chipRemove').click();
	assert.equal(await bar.locator('.FilterPills-chip').count(), 0);
});

scenario('AssetSearchBar: assetsearchbar:change reports the text and the filters', 'AssetSearchBar', async (page) => {
	const bar = reference(page);
	await recordEvents(page, 'assetsearchbar:change');
	await bar.locator('.textinput__field').fill('ab');
	await bar.locator('[data-action="filter"] .combobutton').click();
	await bar.locator('.popupmenu__row', { hasText: 'Level' }).click();
	await bar.locator('.FilterPills-chipRemove').click();
	assert.deepEqual(await recorded(page, 'assetsearchbar:change'), [
		{ text: 'ab', filters: [] },
		{ text: 'ab', filters: ['Level'] },
		{ text: 'ab', filters: [] },
	]);
=======
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
>>>>>>> origin/master
});

scenario('AssetSearchBar: the filter menu is keyboard operable', 'AssetSearchBar', async (page) => {
	const bar = reference(page);
<<<<<<< HEAD
	const chips = bar.locator('.FilterPills-chipName');
	await bar.locator('[data-action="filter"] .combobutton').focus();
	await tap(page, 'Enter', 'ArrowDown', 'ArrowDown', 'Enter');
	assert.deepEqual(await chips.allTextContents(), ['Texture']);
	await tap(page, 'Enter', 'Escape');
	await hides(bar.locator('.combobutton-menu'));
	assert.deepEqual(await chips.allTextContents(), ['Texture']);
});

scenario('AssetSearchBar: the pinned rows stay as drawn', 'AssetSearchBar', async (page) => {
	const pinnedBars = page.locator('[data-pinned] .AssetSearchBar');
	assert.equal(await pinnedBars.count(), 2);
	await assertInert(pinnedBars.first());
	const pinnedClear = pinnedBars.locator('.textinput__clear');
=======
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
>>>>>>> origin/master
	assert.equal(await pinnedClear.count(), 2);
	await shows(pinnedClear.first());
	await shows(pinnedClear.last());
});

// ---------------------------------------------------------------- ContentBrowser

const CB = 'ue-content-browser ';
const STARTER = ['Architecture', 'Audio', 'Blueprints', 'HDRI', 'Maps', 'Materials', 'Particles', 'Props', 'Shapes', 'Textures'];
<<<<<<< HEAD
const cbTiles = (page: Page): Promise<string[]> => texts(page, CB + '.AssetTile__name');
const cbCrumbs = (page: Page): Promise<string[]> => texts(page, CB + 'ue-button[data-crumb] .button');
const cbStatus = async (page: Page): Promise<string> => ((await page.locator(CB + '.ContentBrowser__status').textContent()) ?? '').trim();
const cbRow = (page: Page, name: string): Locator => page.locator(CB + '.tr-row', { hasText: exactly(name) });
const cbTile = (page: Page, name: string): Locator => page.locator(CB + '.AssetTile', { hasText: exactly(name) });
const cbSelectedRow = (page: Page): Promise<string[]> => texts(page, CB + '.tr-row.is-selected');
const cbPicked = (page: Page): Promise<string[]> => texts(page, CB + '.AssetTile.is-selected');
const cbNav = (page: Page, action: string): Locator => page.locator(CB + 'ue-button[data-action="' + action + '"] .button');
const cbField = (page: Page): Locator => page.locator(CB + '.textinput__field');
=======
const cbTiles = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__tile');
const cbCrumbs = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__crumb');
const cbStatus = async (page: Page): Promise<string> => ((await page.locator(CB + '.ContentBrowser__status').textContent()) ?? '').trim();
const cbRow = (page: Page, name: string): Locator => page.locator(CB + '.ContentBrowser__row', { hasText: exactly(name) });
const cbTile = (page: Page, name: string): Locator => page.locator(CB + '.ContentBrowser__tile', { hasText: exactly(name) });
const cbSelectedRow = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__row--sel');
const cbPicked = (page: Page): Promise<string[]> => texts(page, CB + '.ContentBrowser__tile.is-sel');
>>>>>>> origin/master

scenario('ContentBrowser: opens as the reference shows', 'ContentBrowser', async (page) => {
	assert.deepEqual(await cbTiles(page), STARTER);
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent']);
	assert.equal(await cbStatus(page), '10 items (1 selected)');
	assert.deepEqual(await cbSelectedRow(page), ['StarterContent']);
	assert.equal(await fill(cbRow(page, 'StarterContent')), await token(page, 'select-inactive'));
	assert.equal(await fill(cbRow(page, 'Content')), await token(page, 'select-parent'));
<<<<<<< HEAD
	assert.ok(!(await cbNav(page, 'back').isDisabled()));
	assert.ok(await cbNav(page, 'forward').isDisabled());
	assert.deepEqual(await cbPicked(page), ['Blueprints']);
});

scenario('ContentBrowser: the nested composites and primitives are the only parts', 'ContentBrowser', async (page) => {
	const count = (selector: string): Promise<number> => page.locator(CB + selector).count();
	assert.equal(await count('ue-content-toolbar'), 1);
	assert.equal(await count('ue-source-panel'), 1);
	assert.equal(await count('ue-asset-search-bar'), 1);
	assert.equal(await count('ue-splitter'), 1);
	assert.equal(await count('ue-asset-tile'), 1);
	assert.equal(await count('ue-tree-row[data-tree="project"]'), 1);
});

scenario('ContentBrowser: a double-clicked tile navigates; breadcrumb, tree, tiles and Back/Forward follow', 'ContentBrowser', async (page) => {
	const back = cbNav(page, 'back');
	const fwd = cbNav(page, 'forward');
=======
	assert.ok(!(await page.locator(CB + '.ContentBrowser__nav--back').isDisabled()));
	assert.ok(await page.locator(CB + '.ContentBrowser__nav--fwd').isDisabled());
	assert.deepEqual(await cbPicked(page), ['Blueprints']);
});

scenario('ContentBrowser: a double-clicked tile navigates; breadcrumb, tree, tiles and Back/Forward follow', 'ContentBrowser', async (page) => {
	const back = page.locator(CB + '.ContentBrowser__nav--back');
	const fwd = page.locator(CB + '.ContentBrowser__nav--fwd');
>>>>>>> origin/master
	await cbTile(page, 'Audio').dblclick();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent', 'Audio']);
	assert.deepEqual(await cbTiles(page), ['Music', 'Ambient']);
	assert.deepEqual(await cbSelectedRow(page), ['Audio']);
	assert.equal(await cbStatus(page), '2 items');
<<<<<<< HEAD
	assert.equal(await attr(cbField(page), 'placeholder'), 'Search Audio');
=======
	assert.equal(await attr(page.locator(CB + '.ContentBrowser__input'), 'placeholder'), 'Search Audio');
>>>>>>> origin/master
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
<<<<<<< HEAD
	await cbRow(page, 'Architecture').locator('.tr-arrow').click();
=======
	await cbRow(page, 'Architecture').locator('.ContentBrowser__exp').click();
>>>>>>> origin/master
	await shows(cbRow(page, 'Walls'), 'the arrow opens the folder');
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent'], 'and does not navigate');

	await cbRow(page, 'Walls').click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent', 'Architecture', 'Walls']);
	assert.deepEqual(await cbTiles(page), []);
	assert.equal(await cbStatus(page), '0 items');
	assert.equal(await fill(cbRow(page, 'Walls')), await token(page, 'select'), 'the focused tree shows the active selection');
	assert.equal(await fill(cbRow(page, 'Architecture')), await token(page, 'select-parent'));

<<<<<<< HEAD
	await cbRow(page, 'Architecture').locator('.tr-arrow').click();
=======
	await cbRow(page, 'Architecture').locator('.ContentBrowser__exp').click();
>>>>>>> origin/master
	assert.deepEqual(await cbSelectedRow(page), ['Architecture'], 'collapsing an ancestor of the selection selects it');
	assert.deepEqual(await cbTiles(page), ['Walls', 'Floors']);
});

scenario('ContentBrowser: breadcrumb crumbs navigate and the trail shortens', 'ContentBrowser', async (page) => {
<<<<<<< HEAD
	await page.locator(CB + 'ue-button[data-crumb] .button', { hasText: 'Content' }).first().click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content']);
	assert.equal(await page.locator(CB + 'ue-combo-button[data-crumb-menu]').count(), 2);
	assert.deepEqual(await cbSelectedRow(page), ['Content']);
	assert.deepEqual(await cbTiles(page), ['StarterContent']);
	await page.locator(CB + 'ue-button[data-crumb] .button', { hasText: 'All' }).click();
=======
	await page.locator(CB + '.ContentBrowser__crumb', { hasText: 'Content' }).first().click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content']);
	assert.equal(await page.locator(CB + '.ContentBrowser__delim').count(), 2);
	assert.deepEqual(await cbSelectedRow(page), ['Content']);
	assert.deepEqual(await cbTiles(page), ['StarterContent']);
	await page.locator(CB + '.ContentBrowser__crumb', { hasText: 'All' }).click();
>>>>>>> origin/master
	assert.deepEqual(await cbCrumbs(page), ['All']);
	assert.deepEqual(await cbTiles(page), ['Content']);
	assert.equal(await cbStatus(page), '1 item');
});

<<<<<<< HEAD
scenario('ContentBrowser: a toolbar chevron lists the sub-folders of the model and picking navigates', 'ContentBrowser', async (page) => {
	await page.locator(CB + '[data-crumb-menu="2"] .combobutton').click();
	assert.deepEqual(await page.locator(CB + '[data-crumb-menu="2"] .popupmenu__row').allTextContents(), STARTER);
	await page.locator(CB + '[data-crumb-menu="2"] .popupmenu__row', { hasText: 'Maps' }).click();
	assert.deepEqual(await cbCrumbs(page), ['All', 'Content', 'StarterContent', 'Maps']);
	assert.deepEqual(await cbTiles(page), ['Overview', 'Test']);
	assert.deepEqual(await cbSelectedRow(page), ['Maps']);
});

scenario('ContentBrowser: the search box filters tiles and the item count follows', 'ContentBrowser', async (page) => {
	const searchField = cbField(page);
	const clearButton = page.locator(CB + '.textinput__clear');
=======
scenario('ContentBrowser: the search box filters tiles and the item count follows', 'ContentBrowser', async (page) => {
	const searchField = page.locator(CB + '.ContentBrowser__input');
	const clearButton = page.locator(CB + '.ContentBrowser__clear');
>>>>>>> origin/master
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
<<<<<<< HEAD
	const card = (name: string): Locator => cbTile(page, name).locator('.AssetTile__card');
=======
	const card = (name: string): Locator => cbTile(page, name).locator('.ContentBrowser__card');
>>>>>>> origin/master
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
<<<<<<< HEAD
	assert.ok((await pseudoShadow(card('Props'))).includes(await token(page, 'primary')));
=======
	assert.ok((await prop(card('Props'), 'box-shadow')).includes(await token(page, 'primary')));
>>>>>>> origin/master
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
<<<<<<< HEAD
	await hides(cbRow(page, 'Architecture'), 'Left collapses the open folder');
=======
	assert.equal(await cbRow(page, 'Architecture').count(), 0, 'Left collapses the open folder');
>>>>>>> origin/master
	await tap(page, 'ArrowRight', 'ArrowRight');
	assert.deepEqual(await cbSelectedRow(page), ['Architecture'], 'Right opens, Right again enters the first child');
});

scenario('ContentBrowser: the splitter drags and resizes the columns', 'ContentBrowser', async (page) => {
<<<<<<< HEAD
	const split = page.locator(CB + '.splitter-handle');
=======
	const split = page.locator(CB + '.ContentBrowser__split');
>>>>>>> origin/master
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
<<<<<<< HEAD
	assert.ok(await hasClass(split, 'splitter-handle--highlight'));
=======
	assert.ok(await hasClass(split, 'is-dragging'));
>>>>>>> origin/master
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
<<<<<<< HEAD
	const box = await page.locator(CB + '.splitter-handle').boundingBox();
=======
	const box = await page.locator(CB + '.ContentBrowser__split').boundingBox();
>>>>>>> origin/master
	assert.ok(box);
	await page.mouse.move(box.x + 1, box.y + 80);
	await mouseDown(page);
	await page.mouse.move(box.x + 601, box.y + 80, { steps: 12 });
	await mouseUp(page);
	const scrolls = await page.locator(CB + '.ContentBrowser__tiles').evaluate((el) => el.scrollHeight > el.clientHeight);
	assert.ok(scrolls, 'ten tiles no longer fit one row');
});

scenario('ContentBrowser: section headers collapse, search toggles press, menus open, buttons press', 'ContentBrowser', async (page) => {
<<<<<<< HEAD
	const project = page.locator(CB + '.expandablearea__header', { hasText: 'LevelDesignProject' });
	await project.click();
	await hides(after(project));
	await project.click();
	await shows(after(project));

	const tool = page.locator(CB + 'ue-button[data-action="search"] .button').first();
=======
	const project = page.locator(CB + '.ContentBrowser__title', { hasText: 'LevelDesignProject' });
	const folders = page.locator(CB + '.ContentBrowser__tree[data-folders]');
	await project.click();
	await hides(folders);
	await project.click();
	await shows(folders);

	const tool = page.locator(CB + '.ContentBrowser__tool').first();
>>>>>>> origin/master
	await tool.click();
	assert.equal(await attr(tool, 'aria-pressed'), 'true');
	assert.equal(await fill(tool), await token(page, 'primary-hover'));

<<<<<<< HEAD
	const settings = page.locator(CB + '[data-action="settings"]');
	await settings.locator('.combobutton').click();
	await shows(settings.locator('.combobutton-menu'));
	assert.equal(await settings.locator('.popupmenu__row').count(), 6);
	await tap(page, 'Escape');
	const add = page.locator(CB + '[data-action="add"]');
	await add.locator('.combobutton').click();
	assert.equal(await add.locator('.popupmenu__row').first().textContent(), 'Import to Current Folder');
	await tap(page, 'Escape');
	assert.equal(await page.locator(CB + '.combobutton-menu:visible').count(), 0);

	const importButton = cbNav(page, 'import');
=======
	const items = page.locator(CB + '.ContentBrowser__menuitem');
	await page.locator(CB + '.ContentBrowser__settings').click();
	assert.equal(await items.count(), 6);
	await tap(page, 'Escape');
	await page.locator(CB + '.ContentBrowser__add').click();
	assert.equal(await items.first().textContent(), 'Import to Current Folder');
	await tap(page, 'Escape');
	assert.equal(await page.locator(CB + '.ContentBrowser__menu').count(), 0);

	const importButton = page.locator(CB + '.ContentBrowser__btn').first();
>>>>>>> origin/master
	await importButton.hover();
	assert.equal(await fill(importButton), await token(page, 'dropdown'));
	await mouseDown(page);
	assert.equal(await prop(importButton, 'padding-top'), '4px');
	await mouseUp(page);
	await cbRow(page, 'Props').hover();
	assert.equal(await fill(cbRow(page, 'Props')), await token(page, 'select-hover'));
});
<<<<<<< HEAD

// ---------------------------------------------------------------- AssetList

const listRow = (page: Page, id: string): Locator => page.locator('ue-asset-list .AssetList__row[data-id="' + id + '"]');
const shownIds = (page: Page): Promise<string[]> => page.$$eval('ue-asset-list .AssetList__row:not([hidden])', (els) => els.map((el) => (el as HTMLElement).dataset.id ?? ''));
const listCount = (page: Page): Promise<string> => page.locator('ue-asset-list .AssetList__count').innerText();
const GAME = ['SM_Bookshelf', 'SM_Chair', 'SM_Couch', 'SM_Lamp', 'SM_Rug', 'SM_Table'];

scenario('AssetList: 36px rows striped Recessed and Background, a hidden engine set, and the count line', 'AssetList', async (page) => {
	assert.deepEqual(await shownIds(page), GAME, 'engine content stays hidden by default');
	assert.equal(await listCount(page), '6 items (1 selected)');
	const rows = page.locator('ue-asset-list .AssetList__row:not([hidden])');
	assert.equal((await rows.first().boundingBox())?.height, 36);
	assert.equal(await fill(rows.nth(0)), await token(page, 'recessed'));
	assert.equal(await fill(rows.nth(2)), await token(page, 'recessed'));
	assert.equal(await fill(rows.nth(3)), await token(page, 'background'), 'stripes skip the hidden rows');
	assert.equal(await fill(listRow(page, 'SM_Chair')), await token(page, 'select-inactive'), 'the selection without the focus');
	await listRow(page, 'SM_Lamp').hover();
	assert.equal(await fill(listRow(page, 'SM_Lamp')), await token(page, 'select-hover'));
	assert.equal(await prop(listRow(page, 'SM_Lamp').locator('.AssetList__name'), 'color'), await token(page, 'white'));
	assert.equal(await prop(listRow(page, 'SM_Lamp').locator('.AssetList__name'), 'font-size'), '12px');
	assert.equal(await prop(listRow(page, 'SM_Lamp').locator('.AssetList__class'), 'font-size'), '13.333px');
	const thumb = await listRow(page, 'SM_Lamp').locator('.AssetList__thumb').boundingBox();
	assert.deepEqual([thumb?.width, thumb?.height], [36, 36], 'the thumbnail is as tall as the row');
	const rc = await listRow(page, 'SM_Lamp').locator('.AssetList__rc').boundingBox();
	assert.equal(rc?.width, 30, 'the revision control column');
});

scenario('AssetList: a click selects and activates, keys move with wrap, Enter activates, the focused selection is Select', 'AssetList', async (page) => {
	await recordEvents(page, 'ue-asset-list-select');
	await recordEvents(page, 'ue-asset-list-activate');
	await listRow(page, 'SM_Lamp').click();
	assert.equal(await attr(listRow(page, 'SM_Lamp'), 'aria-selected'), 'true');
	assert.equal(await attr(listRow(page, 'SM_Chair'), 'aria-selected'), 'false');
	assert.deepEqual(await recorded(page, 'ue-asset-list-select'), [{ id: 'SM_Lamp' }]);
	assert.deepEqual(await recorded(page, 'ue-asset-list-activate'), [{ id: 'SM_Lamp' }]);

	const rows = page.locator('ue-asset-list .AssetList__rows');
	await rows.focus();
	await farAway(page);
	assert.equal(await fill(listRow(page, 'SM_Lamp')), await token(page, 'select'), 'the list holds the focus');
	await tap(page, 'ArrowDown', 'ArrowDown', 'ArrowDown');
	assert.equal(await attr(listRow(page, 'SM_Bookshelf'), 'aria-selected'), 'true', 'Down wraps past the last row');
	await tap(page, 'ArrowUp');
	assert.equal(await attr(listRow(page, 'SM_Table'), 'aria-selected'), 'true', 'Up wraps past the first row');
	await tap(page, 'Home');
	assert.equal(await attr(listRow(page, 'SM_Bookshelf'), 'aria-selected'), 'true');
	await tap(page, 'End', 'Enter');
	assert.deepEqual((await recorded(page, 'ue-asset-list-activate')).slice(-1), [{ id: 'SM_Table' }]);
	assert.equal(await page.locator('ue-asset-list ue-event-status').nth(1).textContent(), 'Activated: SM_Table');
});

scenario('AssetList: the Name header flips the order', 'AssetList', async (page) => {
	await page.locator('ue-asset-list .hr-cell[data-column="name"]').click();
	assert.deepEqual(await shownIds(page), [...GAME].reverse());
	assert.equal(await fill(page.locator('ue-asset-list .AssetList__row:not([hidden])').first()), await token(page, 'recessed'), 'the stripes follow the new order');
	await page.locator('ue-asset-list .hr-cell[data-column="name"]').click();
	assert.deepEqual(await shownIds(page), GAME);
});

scenario('AssetList: query, showEngine, select, move, activate and setItems drive the list', 'AssetList', async (page) => {
	type Api = HTMLElement & { query: string; showEngine: boolean; selectedId: string | null; select(id: string | null): void; move(d: number): void; activate(): string | null; pathOf(id: string): string | null; setItems(items: unknown[]): void };
	const api = <T>(body: (el: Api) => T): Promise<T> => page.locator('ue-asset-list').first().evaluate(body as (el: Element) => T);
	await api((el) => {
		el.showEngine = true;
	});
	assert.equal(await listCount(page), '11 items (1 selected)');
	assert.equal(await api((el) => el.pathOf('Cube')), '/Engine/BasicShapes/Cube.Cube');
	await api((el) => {
		el.query = 'c';
	});
	assert.deepEqual(await shownIds(page), ['Cone', 'Cube', 'Cylinder', 'SM_Chair', 'SM_Couch'], 'the query ignores case');
	await api((el) => {
		el.query = 'sm_c';
	});
	assert.equal(await listCount(page), '2 items (1 selected)');
	await api((el) => {
		el.query = 'zz';
	});
	assert.equal(await listCount(page), '0 items');
	assert.equal(await api((el) => el.selectedId), null, 'a filtered-out row loses the selection');
	assert.equal(await api((el) => el.activate()), null, 'nothing to activate');
	await api((el) => {
		el.query = '';
		el.showEngine = false;
	});
	await api((el) => el.select(null));
	await api((el) => el.move(1));
	assert.equal(await api((el) => el.selectedId), 'SM_Bookshelf', 'with no selection a move selects the first row');
	assert.equal(await api((el) => el.activate()), 'SM_Bookshelf');
	await api((el) => el.setItems([{ id: 'T_Brick', label: 'T_Brick', typeLabel: 'Texture', path: '/Game/T_Brick.T_Brick', strip: '#c00' }, { id: 'M_Wall', label: 'M_Wall', typeLabel: 'Material' }]));
	assert.deepEqual(await shownIds(page), ['M_Wall', 'T_Brick'], 'setItems sorts by name');
	assert.equal(await listCount(page), '2 items');
	assert.equal(await listRow(page, 'T_Brick').locator('.AssetList__class').textContent(), 'Texture');
	assert.equal(await listRow(page, 'T_Brick').locator('svg').count(), 1, 'a row without an image draws the cube');
});

scenario('AssetList: the pinned specimen shows a hovered and a selected row and ignores the pointer', 'AssetList', async (page) => {
	const pinned = page.locator('ue-asset-list[data-pinned]');
	await assertInert(pinned);
	const row = (id: string): Locator => pinned.locator('.AssetList__row[data-id="' + id + '"]');
	assert.equal(await fill(row('SM_Lamp')), await token(page, 'select-hover'));
	assert.equal(await fill(row('SM_Chair')), await token(page, 'select-inactive'));
	assert.equal(await fill(row('SM_Couch')), await token(page, 'recessed'));
	assert.equal(await fill(row('SM_Bookshelf')), await token(page, 'recessed'));
	assert.equal(await fill(row('SM_Rug')), await token(page, 'recessed'));
	assert.equal(await fill(row('SM_Table')), await token(page, 'background'));
	await clickAt(page, row('SM_Rug'));
	assert.equal(await attr(row('SM_Rug'), 'aria-selected'), 'false', 'a real click changes nothing');
});
=======
>>>>>>> origin/master
