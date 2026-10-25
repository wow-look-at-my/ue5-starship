/// <reference lib="dom" />
// Behaviour tests for the Outliner group: TreeRow, HeaderRow, SceneOutliner and Scrollbar previews.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locator, Page } from 'playwright';
import { bgOf, centre, classes, clickBlank, colorOf, holdPointer, inPreview, keys, movePointer, parkPointer, releasePointer, rgb, rowIn, settle, shown, spin, visibleLabels, widthOf } from './preview-kit.ts';

// ---------------------------------------------------------------------------------------------------------------- TreeRow

const treeRow = (page: Page, label: string): Locator => rowIn(page, 'ue-tree-row', '.tr-row', '.tr-text', label);
const treeLabels = (page: Page): Promise<string[]> => visibleLabels(page, 'ue-tree-row', '.tr-row', '.tr-text');
const treeSelected = (page: Page): Promise<string[]> => page.$$eval('ue-tree-row .tr-row.is-selected .tr-text', (els) => els.map((el) => el.textContent ?? ''));

test('TreeRow: click selects, active while focused and inactive after focus leaves', async () => {
	await inPreview('TreeRow', async (page) => {
		const chair = treeRow(page, 'Chair');
		assert.equal(await chair.getAttribute('aria-selected'), 'false');
		await chair.click();
		assert.ok((await classes(chair)).includes('is-selected'));
		assert.equal(await chair.getAttribute('aria-selected'), 'true');
		assert.equal(await bgOf(chair), rgb('select'));
		assert.equal(await colorOf(chair), rgb('foreground-hover'));
		await clickBlank(page);
		await settle(page);
		assert.equal(await bgOf(chair), rgb('select-inactive'));
		assert.ok((await classes(chair)).includes('is-selected'), 'selection stays while the tree is unfocused');
		await chair.click();
		assert.equal(await bgOf(chair), rgb('select'), 'focus returns, active again');
	});
});

test('TreeRow: hover fills an unselected row and leaves a selected row alone', async () => {
	await inPreview('TreeRow', async (page) => {
		const skylight = treeRow(page, 'SkyLight');
		await parkPointer(page);
		assert.equal(await bgOf(skylight), rgb('recessed'));
		await skylight.hover();
		assert.equal(await bgOf(skylight), rgb('select-hover'));
		await skylight.click();
		assert.equal(await bgOf(skylight), rgb('select'));
		await skylight.hover();
		assert.equal(await bgOf(skylight), rgb('select'), 'selected row keeps its fill on hover');
	});
});

test('TreeRow: ctrl-click toggles, shift-click selects a range', async () => {
	await inPreview('TreeRow', async (page) => {
		await treeRow(page, 'Chair').click();
		await treeRow(page, 'Table').click({ modifiers: ['Control'] });
		assert.deepEqual(await treeSelected(page), ['Chair', 'Table']);
		await treeRow(page, 'Chair').click({ modifiers: ['Control'] });
		assert.deepEqual(await treeSelected(page), ['Table']);
		await treeRow(page, 'Light Source').click();
		await treeRow(page, 'PointLight').click({ modifiers: ['Shift'] });
		assert.deepEqual(await treeSelected(page), ['Light Source', 'SkyLight', 'PointLight']);
		await treeRow(page, 'Chair').click();
		assert.deepEqual(await treeSelected(page), ['Chair'], 'a plain click replaces the selection');
	});
});

test('TreeRow: the caret collapses and expands, and indents 12px per level', async () => {
	await inPreview('TreeRow', async (page) => {
		const meshes = treeRow(page, 'StaticMeshes');
		const indent = (label: string): Promise<number> => widthOf(treeRow(page, label).locator('.tr-indent'));
		assert.equal(await indent('Lights'), 6);
		assert.equal(await indent('Chair'), 18);
		assert.ok(!(await treeLabels(page)).includes('Sofa'));
		await treeRow(page, 'Furniture').locator('.tr-arrow').click();
		assert.ok((await treeLabels(page)).includes('Sofa'));
		assert.equal(await indent('Sofa'), 30);
		await meshes.locator('.tr-arrow').click();
		assert.equal(await meshes.getAttribute('aria-expanded'), 'false');
		const labels = await treeLabels(page);
		for (const hidden of ['Chair', 'Table', 'Furniture', 'Sofa', 'Bookshelf']) assert.ok(!labels.includes(hidden), hidden + ' hidden');
		assert.ok(labels.includes('Audio'));
		await meshes.locator('.tr-arrow').click();
		assert.ok((await treeLabels(page)).includes('Chair'));
		assert.equal(await meshes.getAttribute('aria-expanded'), 'true');
	});
});

test('TreeRow: double-click expands, the folder icon opens and closes with it', async () => {
	await inPreview('TreeRow', async (page) => {
		const furniture = treeRow(page, 'Furniture');
		assert.equal(await furniture.locator('.tr-icon use').getAttribute('href'), '#tr-folder');
		await furniture.locator('.tr-text').dblclick();
		assert.ok((await treeLabels(page)).includes('Sofa'));
		assert.equal(await furniture.locator('.tr-icon use').getAttribute('href'), '#tr-folder-open');
		assert.equal(await furniture.locator('.tr-arrow use').getAttribute('href'), '#tr-caret-down');
	});
});

test('TreeRow: a parent of the selection takes the parent tint, collapsed or not', async () => {
	await inPreview('TreeRow', async (page) => {
		await treeRow(page, 'Furniture').locator('.tr-arrow').click();
		await treeRow(page, 'Sofa').click();
		await parkPointer(page);
		const meshes = treeRow(page, 'StaticMeshes');
		assert.equal(await bgOf(meshes), rgb('select-parent'));
		assert.equal(await bgOf(treeRow(page, 'Furniture')), rgb('select-parent'));
		assert.equal(await bgOf(treeRow(page, 'Lights')), rgb('recessed'));
		await meshes.locator('.tr-arrow').click();
		await parkPointer(page);
		assert.ok(!(await treeLabels(page)).includes('Sofa'));
		assert.equal(await bgOf(meshes), rgb('select-parent'), 'collapsed parent keeps the tint');
		await meshes.hover();
		assert.equal(await bgOf(meshes), rgb('select-hover'), 'a hovered parent uses the hover fill');
	});
});

test('TreeRow: keyboard moves, collapses, expands and jumps', async () => {
	await inPreview('TreeRow', async (page) => {
		await treeRow(page, 'Lights').click();
		await keys(page, 'ArrowDown');
		assert.deepEqual(await treeSelected(page), ['Light Source']);
		await keys(page, 'ArrowLeft');
		assert.deepEqual(await treeSelected(page), ['Lights'], 'Left on a leaf selects the parent');
		await keys(page, 'ArrowLeft');
		assert.equal(await treeRow(page, 'Lights').getAttribute('aria-expanded'), 'false');
		assert.ok(!(await treeLabels(page)).includes('Light Source'));
		await keys(page, 'ArrowDown');
		assert.deepEqual(await treeSelected(page), ['StaticMeshes'], 'Down skips the hidden children');
		await keys(page, 'ArrowUp', 'ArrowRight');
		assert.equal(await treeRow(page, 'Lights').getAttribute('aria-expanded'), 'true');
		await keys(page, 'ArrowRight');
		assert.deepEqual(await treeSelected(page), ['Light Source'], 'Right on an open parent selects the first child');
		await keys(page, 'End');
		assert.deepEqual(await treeSelected(page), ['Starter_Background']);
		await keys(page, 'Home');
		assert.deepEqual(await treeSelected(page), ['Lights']);
		await keys(page, 'Shift+ArrowDown', 'Shift+ArrowDown');
		assert.deepEqual(await treeSelected(page), ['Lights', 'Light Source', 'SkyLight']);
		await keys(page, 'ArrowDown');
		assert.deepEqual(await treeSelected(page), ['PointLight']);
		await keys(page, 'Control+Space');
		assert.deepEqual(await treeSelected(page), [], 'Ctrl+Space toggles the focused row off');
		await keys(page, 'Space');
		assert.deepEqual(await treeSelected(page), ['PointLight']);
		await keys(page, 'Enter');
		assert.deepEqual(await treeSelected(page), ['PointLight']);
	});
});

test('TreeRow: rows alternate even and odd by visible position', async () => {
	await inPreview('TreeRow', async (page) => {
		await treeRow(page, 'Lights').locator('.tr-arrow').click();
		const odd = await page.$$eval('ue-tree-row .tr-row:not([hidden])', (els) => els.map((el) => el.classList.contains('is-odd')));
		assert.deepEqual(odd, odd.map((_, i) => i % 2 === 1));
		await parkPointer(page);
		assert.equal(await bgOf(page.locator('ue-tree-row .tr-row:not([hidden])').nth(1)), rgb('background'));
	});
});

test('TreeRow: pinned specimens stay pinned', async () => {
	await inPreview('TreeRow', async (page) => {
		const first = page.locator('.tr-page > .tr-row').first();
		const specimen = page.locator('.tr-page > .tr-row.is-selected:not(.is-inactive)');
		await first.click();
		await first.hover();
		assert.equal(await bgOf(first), rgb('recessed'));
		assert.equal(await bgOf(specimen), rgb('select'));
		await clickBlank(page);
		assert.equal(await bgOf(specimen), rgb('select'), 'a pinned active row never turns inactive');
		assert.equal(await bgOf(page.locator('.tr-page > .tr-row.is-selected.is-inactive')), rgb('select-inactive'));
		assert.equal(await bgOf(page.locator('.tr-page > .tr-row.is-parent')), rgb('select-parent'));
		assert.equal(await page.locator('ue-tree-row .tr-row.is-selected').count(), 0, 'nothing in the live tree got selected');
	});
});

// -------------------------------------------------------------------------------------------------------------- HeaderRow

const labelHead = (page: Page): Locator => page.locator('ue-header-row .hr-cell[data-column="label"]');
const typeHead = (page: Page): Locator => page.locator('ue-header-row .hr-cell[data-column="type"]');
const arrowHref = (cell: Locator): Promise<string | null> => cell.locator('.hr-sort use').getAttribute('href');
const arrowShown = (cell: Locator): Promise<boolean> => cell.locator('.hr-sort').evaluate((el) => getComputedStyle(el).display !== 'none');

test('HeaderRow: clicking a sortable header cycles ascending and descending, and the arrow flips', async () => {
	await inPreview('HeaderRow', async (page) => {
		const head = labelHead(page);
		assert.equal(await head.getAttribute('aria-sort'), 'ascending');
		assert.equal(await arrowHref(head), '#hr-up');
		assert.equal(await arrowShown(typeHead(page)), false);
		await head.click();
		assert.equal(await head.getAttribute('aria-sort'), 'descending');
		assert.equal(await arrowHref(head), '#hr-down');
		await head.click();
		assert.equal(await head.getAttribute('aria-sort'), 'ascending');
		assert.equal(await arrowHref(head), '#hr-up');
	});
});

test('HeaderRow: sorting another column moves the primary arrow, shift adds a secondary one', async () => {
	await inPreview('HeaderRow', async (page) => {
		const head = labelHead(page);
		const type = typeHead(page);
		await type.click();
		assert.equal(await type.getAttribute('aria-sort'), 'ascending');
		assert.equal(await arrowShown(type), true);
		assert.equal(await head.getAttribute('aria-sort'), 'none');
		assert.equal(await arrowShown(head), false);
		await head.click({ modifiers: ['Shift'] });
		assert.equal(await head.getAttribute('aria-sort'), 'ascending');
		assert.equal(await arrowHref(head), '#hr-up2', 'secondary arrow');
		assert.equal(await arrowHref(type), '#hr-up', 'primary stays');
		await head.click({ modifiers: ['Shift'] });
		assert.equal(await arrowHref(head), '#hr-down2');
	});
});

test('HeaderRow: Enter and Space on a focused header sort it', async () => {
	await inPreview('HeaderRow', async (page) => {
		const type = typeHead(page);
		await type.focus();
		await keys(page, 'Enter');
		assert.equal(await type.getAttribute('aria-sort'), 'ascending');
		await keys(page, 'Space');
		assert.equal(await type.getAttribute('aria-sort'), 'descending');
		assert.equal(await arrowHref(type), '#hr-down');
	});
});

test('HeaderRow: a sortable cell takes the Dropdown fill on hover, a fixed cell does not', async () => {
	await inPreview('HeaderRow', async (page) => {
		const type = typeHead(page);
		await parkPointer(page);
		assert.equal(await bgOf(type), rgb('header'));
		await type.hover();
		assert.equal(await bgOf(type), rgb('dropdown'));
		const gutter = page.locator('ue-header-row .hr-cell.is-gutter');
		await gutter.hover();
		assert.equal(await bgOf(gutter), rgb('header'));
	});
});

async function dragGrip(page: Page, dx: number): Promise<void> {
	const from = centre(await page.locator('ue-header-row .hr-grip').boundingBox());
	await movePointer(page, from.x, from.y);
	await holdPointer(page);
	await movePointer(page, from.x + dx / 2, from.y, 4);
	await movePointer(page, from.x + dx, from.y, 4);
	await releasePointer(page);
}

test('HeaderRow: dragging the splitter resizes the two columns and keeps their sum', async () => {
	await inPreview('HeaderRow', async (page) => {
		const head = labelHead(page);
		const type = typeHead(page);
		const before = [await widthOf(head), await widthOf(type)];
		await dragGrip(page, -60);
		const after = [await widthOf(head), await widthOf(type)];
		assert.ok(Math.abs(after[0] - (before[0] - 60)) < 1.5, 'label shrank by 60: ' + before[0] + ' to ' + after[0]);
		assert.ok(Math.abs(after[1] - (before[1] + 60)) < 1.5, 'type grew by 60');
		assert.ok(Math.abs(after[0] + after[1] - (before[0] + before[1])) < 1);
		assert.equal(await head.getAttribute('aria-sort'), 'ascending', 'a drag does not sort');
	});
});

test('HeaderRow: a column never gets narrower than 20px', async () => {
	await inPreview('HeaderRow', async (page) => {
		const head = labelHead(page);
		const type = typeHead(page);
		const total = (await widthOf(head)) + (await widthOf(type));
		await dragGrip(page, -300);
		assert.ok(Math.abs((await widthOf(head)) - 20) < 0.5, 'label stops at 20');
		assert.ok(Math.abs((await widthOf(type)) - (total - 20)) < 0.5);
		await page.locator('ue-header-row .hr-grip').focus();
		await keys(page, ...Array<string>(60).fill('ArrowRight'));
		assert.ok(Math.abs((await widthOf(type)) - 20) < 0.5, 'type stops at 20');
	});
});

test('HeaderRow: the splitter resizes from the keyboard', async () => {
	await inPreview('HeaderRow', async (page) => {
		const head = labelHead(page);
		const before = await widthOf(head);
		await page.locator('ue-header-row .hr-grip').focus();
		await keys(page, 'ArrowRight');
		assert.ok(Math.abs((await widthOf(head)) - (before + 8)) < 1);
		await keys(page, 'ArrowLeft', 'ArrowLeft');
		assert.ok(Math.abs((await widthOf(head)) - (before - 8)) < 1);
	});
});

test('HeaderRow: pinned specimens keep their forced state', async () => {
	await inPreview('HeaderRow', async (page) => {
		assert.equal(await bgOf(page.locator('.hr-page > .hr-row .hr-cell.is-hover')), rgb('dropdown'));
		const cell = page.locator('.hr-page > .hr-row').nth(1).locator('.hr-cell.is-text').nth(1);
		await cell.hover();
		assert.equal(await bgOf(cell), rgb('header'), 'a pinned cell has no sort and no hover');
		await cell.click();
		assert.equal(await cell.getAttribute('aria-sort'), null);
	});
});

// --------------------------------------------------------------------------------------------------------- SceneOutliner

const MIN_THUMB = 35;
const PAD = 2;
const outlinerRow = (page: Page, label: string): Locator => rowIn(page, 'ue-scene-outliner', '.so-row', '.so-text', label);
const outlinerLabels = (page: Page): Promise<string[]> => visibleLabels(page, 'ue-scene-outliner', '.so-row', '.so-text');
const status = (page: Page): Promise<string> => page.locator('ue-scene-outliner .so-status').innerText();
const selectedLabels = (page: Page): Promise<string[]> => page.$$eval('ue-scene-outliner .so-row.is-selected .so-text', (els) => els.map((el) => el.textContent ?? ''));

test('SceneOutliner: starts with Chair selected and inactive, parents tinted, footer from the real count', async () => {
	await inPreview('SceneOutliner', async (page) => {
		assert.deepEqual(await selectedLabels(page), ['Chair']);
		assert.equal(await status(page), '15 actors (1 selected)');
		assert.equal(await bgOf(outlinerRow(page, 'Chair')), rgb('select-inactive'));
		await parkPointer(page);
		for (const parent of ['Furniture', 'StaticMeshes', 'Minimal_Default']) assert.equal(await bgOf(outlinerRow(page, parent)), rgb('select-parent'), parent);
		assert.equal(await bgOf(outlinerRow(page, 'Lights')), rgb('recessed'));
		assert.equal(await bgOf(outlinerRow(page, 'Audio')), rgb('background'));
	});
});

test('SceneOutliner: click selects active, focus loss turns it inactive, folders do not count as actors', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const wind = outlinerRow(page, 'Ambient_Wind');
		await wind.click();
		assert.deepEqual(await selectedLabels(page), ['Ambient_Wind']);
		assert.equal(await bgOf(wind), rgb('select'));
		assert.equal(await status(page), '15 actors (1 selected)');
		await clickBlank(page);
		await settle(page);
		assert.equal(await bgOf(wind), rgb('select-inactive'));
		await outlinerRow(page, 'Audio').click();
		assert.equal(await status(page), '15 actors');
		assert.equal(await bgOf(outlinerRow(page, 'Audio')), rgb('select'));
	});
});

test('SceneOutliner: ctrl toggles, shift selects a range, the footer follows', async () => {
	await inPreview('SceneOutliner', async (page) => {
		await outlinerRow(page, 'Ambient_Wind').click();
		await outlinerRow(page, 'Player Start').click({ modifiers: ['Control'] });
		assert.deepEqual(await selectedLabels(page), ['Ambient_Wind', 'Player Start']);
		assert.equal(await status(page), '15 actors (2 selected)');
		await outlinerRow(page, 'Light Source').click();
		await outlinerRow(page, 'SkyLight').click({ modifiers: ['Shift'] });
		assert.deepEqual(await selectedLabels(page), ['Light Source', 'PointLight', 'SkyLight']);
		assert.equal(await status(page), '15 actors (3 selected)');
		await outlinerRow(page, 'PointLight').click({ modifiers: ['Control'] });
		assert.equal(await status(page), '15 actors (2 selected)');
	});
});

test('SceneOutliner: the caret collapses a folder and indents 12px per level', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const indent = (label: string): Promise<number> => widthOf(outlinerRow(page, label).locator('.so-indent'));
		assert.equal(await indent('Minimal_Default'), 6);
		assert.equal(await indent('Lights'), 18);
		assert.equal(await indent('Light Source'), 30);
		assert.equal(await indent('Chair'), 42);
		const before = (await outlinerLabels(page)).length;
		await outlinerRow(page, 'Lights').locator('.so-arrow').click();
		const after = await outlinerLabels(page);
		assert.equal(after.length, before - 4);
		assert.ok(!after.includes('Light Source'));
		assert.equal(await outlinerRow(page, 'Lights').getAttribute('aria-expanded'), 'false');
		await outlinerRow(page, 'Lights').locator('.so-arrow').click();
		assert.equal((await outlinerLabels(page)).length, before);
	});
});

test('SceneOutliner: a collapsed folder that holds the selection keeps the parent tint', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const meshes = outlinerRow(page, 'StaticMeshes');
		await meshes.locator('.so-arrow').click();
		await parkPointer(page);
		assert.ok(!(await outlinerLabels(page)).includes('Chair'));
		assert.equal(await bgOf(meshes), rgb('select-parent'));
		assert.deepEqual(await selectedLabels(page), ['Chair'], 'the hidden selection survives');
		assert.equal(await status(page), '15 actors (1 selected)');
	});
});

test('SceneOutliner: keyboard navigation', async () => {
	await inPreview('SceneOutliner', async (page) => {
		await outlinerRow(page, 'Audio').click();
		await keys(page, 'ArrowDown');
		assert.deepEqual(await selectedLabels(page), ['Ambient_Wind']);
		await keys(page, 'ArrowLeft');
		assert.deepEqual(await selectedLabels(page), ['Audio']);
		await keys(page, 'ArrowLeft');
		assert.equal(await outlinerRow(page, 'Audio').getAttribute('aria-expanded'), 'false');
		assert.ok(!(await outlinerLabels(page)).includes('Ambient_Wind'));
		await keys(page, 'ArrowRight', 'ArrowRight');
		assert.deepEqual(await selectedLabels(page), ['Ambient_Wind']);
		await keys(page, 'End');
		assert.deepEqual(await selectedLabels(page), ['Lamp_Floor']);
		await keys(page, 'Home');
		assert.deepEqual(await selectedLabels(page), ['Minimal_Default']);
		await keys(page, 'ArrowDown', 'Shift+ArrowDown');
		assert.deepEqual(await selectedLabels(page), ['Audio', 'Ambient_Wind']);
		assert.equal(await status(page), '15 actors (1 selected)');
		await keys(page, 'Enter');
		assert.deepEqual(await selectedLabels(page), ['Ambient_Wind']);
	});
});

test('SceneOutliner: the eye shows on a hovered row and toggles open and closed', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const eyeOf = (label: string): Locator => outlinerRow(page, label).locator('.so-eye');
		const visibility = (label: string): Promise<string> => eyeOf(label).evaluate((el) => getComputedStyle(el).visibility);
		await parkPointer(page);
		assert.equal(await visibility('Player Start'), 'hidden');
		await outlinerRow(page, 'Player Start').hover();
		assert.equal(await visibility('Player Start'), 'visible');
		assert.equal(await visibility('Light Source'), 'hidden');
		await eyeOf('Player Start').click();
		assert.deepEqual(await selectedLabels(page), ['Chair'], 'the eye does not select');
		assert.equal(await eyeOf('Player Start').locator('use').getAttribute('href'), '#so-eye-off');
		await parkPointer(page);
		assert.equal(await visibility('Player Start'), 'visible', 'a hidden item keeps its closed eye');
		await eyeOf('Player Start').click();
		assert.equal(await eyeOf('Player Start').locator('use').getAttribute('href'), '#so-eye');
		await outlinerRow(page, 'Lights').locator('.so-gutter').click();
		await parkPointer(page);
		for (const child of ['Light Source', 'PointLight', 'SkyLight', 'SpotLight']) assert.equal(await visibility(child), 'visible', child + ' hidden with its folder');
		assert.equal(await visibility('Chair'), 'visible', 'a selected row shows its eye');
		assert.equal(await visibility('Player Start'), 'hidden');
	});
});

test('SceneOutliner: the search box filters, keeps ancestors, opens them and restores on clear', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const input = page.locator('ue-scene-outliner .so-input');
		const wipe = page.locator('ue-scene-outliner .so-clear');
		assert.equal(await shown(wipe), false);
		await outlinerRow(page, 'Lights').locator('.so-arrow').click();
		await input.fill('skylight');
		assert.deepEqual(await outlinerLabels(page), ['Minimal_Default', 'Lights', 'SkyLight']);
		assert.equal(await outlinerRow(page, 'Lights').getAttribute('aria-expanded'), 'true', 'the ancestor opens');
		assert.equal(await status(page), 'Showing 1 of 15 actors (1 selected)');
		assert.equal(await colorOf(page.locator('ue-scene-outliner .so-status')), rgb('accent-green'));
		assert.equal(await shown(wipe), true);
		await wipe.click();
		assert.equal(await input.inputValue(), '');
		assert.equal((await outlinerLabels(page)).length, 19, 'Lights is collapsed again: 23 rows minus 4');
		assert.equal(await outlinerRow(page, 'Lights').getAttribute('aria-expanded'), 'false');
		assert.equal(await status(page), '15 actors (1 selected)');
		await input.fill('SKY');
		assert.deepEqual(await outlinerLabels(page), ['Minimal_Default', 'Lights', 'SkyLight', 'Sky and Fog', 'BP_Sky_Sphere']);
		assert.equal(await status(page), 'Showing 2 of 15 actors (1 selected)');
	});
});

test('SceneOutliner: a filter with no match reads red, Escape clears it', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const input = page.locator('ue-scene-outliner .so-input');
		const line = page.locator('ue-scene-outliner .so-status');
		await input.fill('zzz');
		assert.deepEqual(await outlinerLabels(page), []);
		assert.equal(await status(page), 'No matching actors (15 total)');
		assert.equal(await colorOf(line), rgb('accent-red'));
		await keys(page, 'Escape');
		assert.equal(await input.inputValue(), '');
		assert.equal((await outlinerLabels(page)).length, 23);
		assert.equal(await colorOf(line), rgb('foreground'));
		assert.equal(await page.locator('ue-scene-outliner .so-search').evaluate((el) => getComputedStyle(el).borderTopColor), rgb('primary'), 'focused outline is Primary');
	});
});

test('SceneOutliner: sorting by Item Label or Type reorders rows within each parent', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const head = page.locator('ue-scene-outliner .so-hcell[data-column="label"]');
		const type = page.locator('ue-scene-outliner .so-hcell[data-column="type"]');
		const initial = await outlinerLabels(page);
		assert.deepEqual(initial.slice(0, 4), ['Minimal_Default', 'Audio', 'Ambient_Wind', 'Starter_Background']);
		await head.click();
		assert.equal(await head.getAttribute('aria-sort'), 'descending');
		assert.equal(await head.locator('use').getAttribute('href'), '#so-down');
		const desc = await outlinerLabels(page);
		assert.deepEqual(desc.slice(0, 9), ['Minimal_Default', 'StaticMeshes', 'Lamp_Floor', 'Bookshelf', 'Furniture', 'Table', 'Sofa', 'Chair', 'Sky and Fog']);
		assert.deepEqual([...desc].sort(), [...initial].sort(), 'same rows');
		await head.click();
		assert.deepEqual(await outlinerLabels(page), initial, 'ascending restores the first order');
		await type.click();
		assert.equal(await type.getAttribute('aria-sort'), 'ascending');
		assert.equal(await head.getAttribute('aria-sort'), 'none');
		assert.equal(await head.locator('.so-sort').evaluate((el) => getComputedStyle(el).display), 'none');
		const byType = await outlinerLabels(page);
		const lightsAt = byType.indexOf('Lights');
		assert.deepEqual(byType.slice(lightsAt + 1, lightsAt + 5), ['Light Source', 'PointLight', 'SkyLight', 'SpotLight'], 'DirectionalLight, PointLight, SkyLight, SpotLight');
		await type.click();
		const byTypeDesc = await outlinerLabels(page);
		const lightsDesc = byTypeDesc.indexOf('Lights');
		assert.deepEqual(byTypeDesc.slice(lightsDesc + 1, lightsDesc + 5), ['SpotLight', 'SkyLight', 'PointLight', 'Light Source']);
		assert.deepEqual(await selectedLabels(page), ['Chair'], 'sorting keeps the selection');
	});
});

test('SceneOutliner: stripes follow the visible order after a sort', async () => {
	await inPreview('SceneOutliner', async (page) => {
		await page.locator('ue-scene-outliner .so-hcell[data-column="type"]').click();
		const odd = await page.$$eval('ue-scene-outliner .so-row:not([hidden])', (els) => els.map((el) => el.classList.contains('is-odd')));
		assert.deepEqual(odd, odd.map((_, i) => i % 2 === 1));
	});
});

test('SceneOutliner: the header cell takes the Dropdown fill on hover', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const type = page.locator('ue-scene-outliner .so-hcell[data-column="type"]');
		await parkPointer(page);
		assert.equal(await bgOf(type), rgb('header'));
		await type.hover();
		assert.equal(await bgOf(type), rgb('dropdown'));
	});
});

interface Geometry {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
	top: number;
	height: number;
}

const geometry = (page: Page): Promise<Geometry> =>
	page.evaluate(() => {
		const view = document.querySelector<HTMLElement>('ue-scene-outliner .so-rows');
		const thumb = document.querySelector<HTMLElement>('ue-scene-outliner .so-thumb');
		const bar = thumb?.parentElement;
		if (!view || !thumb || !bar) throw new Error('outliner parts');
		const t = thumb.getBoundingClientRect();
		const b = bar.getBoundingClientRect();
		return { scrollTop: view.scrollTop, scrollHeight: view.scrollHeight, clientHeight: view.clientHeight, top: t.top - b.top, height: t.height };
	});

function expectedThumb(g: Geometry): { top: number; height: number } {
	const biased = g.clientHeight - 2 * PAD - MIN_THUMB;
	return { top: PAD + biased * (g.scrollTop / g.scrollHeight), height: MIN_THUMB + biased * (g.clientHeight / g.scrollHeight) };
}

test('SceneOutliner: the scrollbar thumb follows the rows, wheel, drag and track click scroll them', async () => {
	await inPreview('SceneOutliner', async (page) => {
		let g = await geometry(page);
		assert.ok(g.scrollHeight > g.clientHeight, 'real overflow');
		assert.equal(g.scrollTop, 0);
		assert.ok(Math.abs(g.top - PAD) < 0.5);
		assert.ok(Math.abs(g.height - expectedThumb(g).height) < 0.5, 'thumb length 35 + (track - 35) x fraction');

		await movePointer(page, 100, 200);
		await spin(page, 0, 60);
		await page.waitForFunction(() => (document.querySelector('ue-scene-outliner .so-rows')?.scrollTop ?? 0) > 0);
		await settle(page);
		g = await geometry(page);
		assert.ok(g.scrollTop > 0, 'wheel scrolls');
		assert.ok(Math.abs(g.top - expectedThumb(g).top) < 0.5, 'thumb follows');

		const bar = page.locator('ue-scene-outliner .so-sb');
		const thumb = page.locator('ue-scene-outliner .so-thumb');
		const barBox = await bar.boundingBox();
		assert.ok(barBox);
		const grab = centre(await thumb.boundingBox());
		const start = g.scrollTop;
		await movePointer(page, grab.x, grab.y);
		assert.equal(await bgOf(thumb), rgb('hover-2'), 'hovered thumb');
		await holdPointer(page);
		await movePointer(page, grab.x, grab.y + 10, 3);
		await movePointer(page, grab.x, grab.y + 30, 3);
		assert.ok((await classes(bar)).includes('is-drag'));
		assert.equal(await bgOf(thumb), rgb('hover-2'), 'dragged thumb');
		await releasePointer(page);
		await settle(page);
		g = await geometry(page);
		const biased = g.clientHeight - 2 * PAD - MIN_THUMB;
		assert.ok(Math.abs(g.scrollTop - Math.min(g.scrollHeight - g.clientHeight, start + (30 * g.scrollHeight) / biased)) < 4, 'drag scrolls: ' + start + ' to ' + g.scrollTop);
		assert.ok(!(await classes(bar)).includes('is-drag'));

		await page.mouse.click(barBox.x + barBox.width / 2, barBox.y + 8);
		await settle(page);
		g = await geometry(page);
		assert.equal(g.scrollTop, 0, 'clicking the top of the track scrolls to the top');
		await page.mouse.click(barBox.x + barBox.width / 2, barBox.y + barBox.height - 3);
		await settle(page);
		g = await geometry(page);
		assert.equal(g.scrollTop, g.scrollHeight - g.clientHeight, 'clicking the bottom scrolls to the end');
		assert.ok(Math.abs(g.top + g.height - (g.clientHeight - PAD)) < 0.5, 'thumb ends at the track end');
	});
});

test('SceneOutliner: the bar and the header spacer go away while the rows fit', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const bar = page.locator('ue-scene-outliner .so-sb');
		const spacer = page.locator('ue-scene-outliner .so-hspacer');
		assert.equal(await shown(bar), true);
		assert.equal(await shown(spacer), true);
		const withBar = await widthOf(outlinerRow(page, 'Audio'));
		await page.locator('ue-scene-outliner .so-input').fill('chair');
		await settle(page);
		assert.equal(await shown(bar), false);
		assert.equal(await shown(spacer), false);
		assert.ok((await classes(page.locator('ue-scene-outliner .so-hcells'))).includes('is-no-bar'));
		assert.ok((await widthOf(outlinerRow(page, 'Chair'))) >= withBar + 15.5, 'rows take the freed 16px');
		await page.locator('ue-scene-outliner .so-input').fill('');
		await settle(page);
		assert.equal(await shown(bar), true);
		assert.equal(await shown(spacer), true);
	});
});

test('SceneOutliner: the pinned specimen stays pinned', async () => {
	await inPreview('SceneOutliner', async (page) => {
		const specimen = page.locator('.so-col').nth(1);
		assert.equal(await bgOf(specimen.locator('.so-row.is-selected.is-inactive')), rgb('select-inactive'));
		const row = specimen.locator('.so-row').nth(2);
		await parkPointer(page);
		const before = await bgOf(row);
		await row.hover();
		assert.equal(await bgOf(row), before, 'a pinned row has no hover');
		await row.click();
		assert.equal(await specimen.locator('.so-row.is-selected').count(), 1);
		assert.equal(await specimen.locator('.so-eye').count(), 2);
	});
});

// ------------------------------------------------------------------------------------------------------------ Scrollbar

interface BarState {
	scroll: number;
	content: number;
	view: number;
	start: number;
	size: number;
	slot: number;
}

// Reads the nth live box: scroll offset, sizes and thumb placement along the scroll axis.
function barState(page: Page, index: number, vertical: boolean): Promise<BarState> {
	return page.evaluate(([i, v]) => {
		const host = document.querySelectorAll<HTMLElement>('ue-scrollbar .sb-scroll')[i];
		const view = host.querySelector<HTMLElement>('.sb-view');
		const bar = host.querySelector<HTMLElement>('.sb');
		const thumb = host.querySelector<HTMLElement>('.sb-thumb');
		if (!view || !bar || !thumb) throw new Error('box parts');
		const b = bar.getBoundingClientRect();
		const t = thumb.getBoundingClientRect();
		return v
			? { scroll: view.scrollTop, content: view.scrollHeight, view: view.clientHeight, start: t.top - b.top, size: t.height, slot: b.height }
			: { scroll: view.scrollLeft, content: view.scrollWidth, view: view.clientWidth, start: t.left - b.left, size: t.width, slot: b.width };
	}, [index, vertical] as [number, boolean]);
}

function expectedBar(s: BarState): { start: number; size: number } {
	const biased = s.slot - 2 * PAD - MIN_THUMB;
	return { start: PAD + biased * (s.scroll / s.content), size: MIN_THUMB + biased * (s.view / s.content) };
}

const live = (page: Page, index: number): Locator => page.locator('ue-scrollbar .sb-scroll').nth(index);

async function dragBy(page: Page, thumb: Locator, dx: number, dy: number): Promise<void> {
	const from = centre(await thumb.boundingBox());
	await movePointer(page, from.x, from.y);
	await holdPointer(page);
	await movePointer(page, from.x + dx / 2, from.y + dy / 2, 3);
	await movePointer(page, from.x + dx, from.y + dy, 3);
	await releasePointer(page);
	await settle(page);
}

test('Scrollbar: the vertical thumb length and position follow the content', async () => {
	await inPreview('Scrollbar', async (page) => {
		let s = await barState(page, 0, true);
		assert.ok(s.content > s.view);
		assert.ok(Math.abs(s.size - expectedBar(s).size) < 0.5, 'length: ' + s.size);
		assert.ok(Math.abs(s.start - PAD) < 0.5);
		await live(page, 0).locator('.sb-view').evaluate((el) => { el.scrollTop = 120; });
		await settle(page);
		s = await barState(page, 0, true);
		assert.equal(s.scroll, 120);
		assert.ok(Math.abs(s.start - expectedBar(s).start) < 0.5, 'position ' + s.start);
		await live(page, 0).locator('.sb-view').evaluate((el) => { el.scrollTop = el.scrollHeight; });
		await settle(page);
		s = await barState(page, 0, true);
		assert.ok(Math.abs(s.start + s.size - (s.slot - PAD)) < 0.5, 'thumb ends 2px from the slot end');
	});
});

test('Scrollbar: dragging the thumb scrolls the view', async () => {
	await inPreview('Scrollbar', async (page) => {
		const first = live(page, 0);
		await dragBy(page, first.locator('.sb-thumb'), 0, 30);
		const s = await barState(page, 0, true);
		const biased = s.slot - 2 * PAD - MIN_THUMB;
		assert.ok(Math.abs(s.scroll - (30 * s.content) / biased) < 4, 'scrolled ' + s.scroll);
		assert.ok(!(await classes(first.locator('.sb'))).includes('is-drag'));
		await dragBy(page, first.locator('.sb-thumb'), 0, -500);
		assert.equal((await barState(page, 0, true)).scroll, 0, 'dragging past the top stops at the top');
		await dragBy(page, first.locator('.sb-thumb'), 0, 500);
		const end = await barState(page, 0, true);
		assert.equal(end.scroll, end.content - end.view);
	});
});

test('Scrollbar: the thumb is Hover at rest, Hover2 on bar hover and while dragged', async () => {
	await inPreview('Scrollbar', async (page) => {
		const first = live(page, 0);
		const thumb = first.locator('.sb-thumb');
		await parkPointer(page);
		assert.equal(await bgOf(thumb), rgb('hover'));
		await first.locator('.sb').hover({ position: { x: 8, y: 140 } });
		assert.equal(await bgOf(thumb), rgb('hover-2'), 'the whole bar is the hover target');
		await parkPointer(page);
		const grab = centre(await thumb.boundingBox());
		await movePointer(page, grab.x, grab.y);
		await holdPointer(page);
		await movePointer(page, grab.x + 200, grab.y + 40, 4);
		assert.ok((await classes(first.locator('.sb'))).includes('is-drag'));
		assert.equal(await bgOf(thumb), rgb('hover-2'), 'dragged, pointer outside the bar');
		await releasePointer(page);
		await parkPointer(page);
		assert.equal(await bgOf(thumb), rgb('hover'));
		assert.equal(await thumb.evaluate((el) => getComputedStyle(el).width), '8px');
		assert.equal(await thumb.evaluate((el) => getComputedStyle(el).borderTopLeftRadius), '4px');
	});
});

test('Scrollbar: the wheel scrolls over the view and over the bar', async () => {
	await inPreview('Scrollbar', async (page) => {
		const over = centre(await live(page, 0).locator('.sb-view').boundingBox());
		const onBar = centre(await live(page, 0).locator('.sb').boundingBox());
		await movePointer(page, over.x, over.y);
		await spin(page, 0, 50);
		await page.waitForFunction(() => (document.querySelector('ue-scrollbar .sb-view')?.scrollTop ?? 0) > 0);
		await settle(page);
		let s = await barState(page, 0, true);
		assert.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
		const afterView = s.scroll;
		await movePointer(page, onBar.x, onBar.y);
		await spin(page, 0, 50);
		await page.waitForFunction((before) => (document.querySelector('ue-scrollbar .sb-view')?.scrollTop ?? 0) > before, afterView);
		s = await barState(page, 0, true);
		assert.ok(s.scroll > afterView, 'the bar forwards the wheel');
	});
});

test('Scrollbar: clicking the track centres the thumb on the pointer', async () => {
	await inPreview('Scrollbar', async (page) => {
		const bar = await live(page, 0).locator('.sb').boundingBox();
		assert.ok(bar);
		await page.mouse.click(bar.x + 8, bar.y + 100);
		await settle(page);
		const s = await barState(page, 0, true);
		assert.ok(Math.abs(s.start + s.size / 2 - 100) < 6, 'thumb centre ' + (s.start + s.size / 2));
		assert.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
	});
});

test('Scrollbar: a very long content keeps the 35px minimum thumb', async () => {
	await inPreview('Scrollbar', async (page) => {
		const s = await barState(page, 1, true);
		assert.ok(s.size >= MIN_THUMB && s.size < MIN_THUMB + 2, 'thumb ' + s.size);
		assert.ok(Math.abs(s.size - expectedBar(s).size) < 0.5);
		await dragBy(page, live(page, 1).locator('.sb-thumb'), 0, 60);
		const moved = await barState(page, 1, true);
		assert.ok(moved.scroll > 1000, 'a small drag scrolls far: ' + moved.scroll);
	});
});

test('Scrollbar: the 12px ScrollBox slot places the thumb 2px from the edge', async () => {
	await inPreview('Scrollbar', async (page) => {
		const boxed = live(page, 2);
		assert.equal(await widthOf(boxed.locator('.sb')), 12);
		assert.equal(await boxed.locator('.sb-thumb').evaluate((el) => getComputedStyle(el).left), '2px');
		const s = await barState(page, 2, true);
		assert.ok(Math.abs(s.size - expectedBar(s).size) < 0.5);
		assert.equal(await widthOf(live(page, 0).locator('.sb')), 16);
		assert.equal(await live(page, 0).locator('.sb-thumb').evaluate((el) => getComputedStyle(el).left), '4px');
	});
});

test('Scrollbar: the horizontal bar follows scrollLeft, drags and takes the wheel', async () => {
	await inPreview('Scrollbar', async (page) => {
		const sideways = live(page, 3);
		let s = await barState(page, 3, false);
		assert.ok(s.content > s.view);
		assert.ok(Math.abs(s.size - expectedBar(s).size) < 0.5);
		assert.equal(await sideways.locator('.sb-thumb').evaluate((el) => getComputedStyle(el).top), '4px');
		assert.equal(await sideways.locator('.sb-thumb').evaluate((el) => getComputedStyle(el).height), '8px');
		await sideways.locator('.sb-view').evaluate((el) => { el.scrollLeft = 100; });
		await settle(page);
		s = await barState(page, 3, false);
		assert.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
		await dragBy(page, sideways.locator('.sb-thumb'), -500, 0);
		assert.equal((await barState(page, 3, false)).scroll, 0);
		await dragBy(page, sideways.locator('.sb-thumb'), 20, 0);
		const dragged = await barState(page, 3, false);
		const biased = dragged.slot - 2 * PAD - MIN_THUMB;
		assert.ok(Math.abs(dragged.scroll - (20 * dragged.content) / biased) < 4, 'scrolled ' + dragged.scroll);
		const over = centre(await sideways.locator('.sb-view').boundingBox());
		await movePointer(page, over.x, over.y);
		await spin(page, 60, 0);
		await page.waitForFunction((before) => (document.querySelectorAll('ue-scrollbar .sb-view')[3]?.scrollLeft ?? 0) > before, dragged.scroll);
		assert.ok((await barState(page, 3, false)).scroll > dragged.scroll, 'sideways wheel scrolls');
	});
});

test('Scrollbar: a focused view scrolls from the keyboard and the thumb follows', async () => {
	await inPreview('Scrollbar', async (page) => {
		await live(page, 0).locator('.sb-view').focus();
		await keys(page, 'PageDown');
		await settle(page);
		let s = await barState(page, 0, true);
		assert.ok(s.scroll > 0);
		assert.ok(Math.abs(s.start - expectedBar(s).start) < 0.5);
		await keys(page, 'End');
		await page.waitForFunction(() => {
			const view = document.querySelector('ue-scrollbar .sb-view');
			return view !== null && view.scrollTop >= view.scrollHeight - view.clientHeight - 1;
		});
		await settle(page);
		s = await barState(page, 0, true);
		assert.ok(Math.abs(s.scroll - (s.content - s.view)) < 1);
		assert.ok(Math.abs(s.start + s.size - (s.slot - PAD)) < 0.5, 'thumb at the end');
		await keys(page, 'Home');
		await page.waitForFunction(() => (document.querySelector('ue-scrollbar .sb-view')?.scrollTop ?? 1) === 0);
		await settle(page);
		assert.ok(Math.abs((await barState(page, 0, true)).start - PAD) < 0.5);
	});
});

test('Scrollbar: pinned specimens do not react to the pointer', async () => {
	await inPreview('Scrollbar', async (page) => {
		const specimen = page.locator('.sb-page > .sb-group').nth(1).locator('.sb').first();
		const thumb = specimen.locator('.sb-thumb');
		assert.equal(await bgOf(thumb), rgb('hover'));
		await specimen.hover();
		assert.equal(await bgOf(thumb), rgb('hover'), 'a pinned normal specimen stays normal under the pointer');
		assert.equal(await bgOf(page.locator('.sb.is-hover .sb-thumb').first()), rgb('hover-2'));
		assert.equal(await bgOf(page.locator('.sb.is-drag .sb-thumb').first()), rgb('hover-2'));
	});
});
