/// <reference lib="dom" />
// Interaction tests for the Details group: the previews run their custom elements in a real browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { Locator, Page } from 'playwright';
import { root as ds } from './lib.ts';
import { assertInert, clickAt, hoverAt } from './pinned.ts';
import { bgOf, inPreview, rgb } from './preview-kit.ts';
import { scenario } from './scenario.ts';

const CLEAR = 'rgba(0, 0, 0, 0)';

const shadowOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).boxShadow);
const colorOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).color);
const visibilityOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).visibility);
const trimmed = async (target: Locator): Promise<string> => ((await target.textContent()) ?? '').trim();
const dataValue = (target: Locator): Promise<number> => target.evaluate((el) => Number((el as HTMLElement).dataset.value));
const key = (page: Page, name: string): Promise<void> => page.keyboard.press(name);
const typeIn = (page: Page, text: string): Promise<void> => page.keyboard.type(text);
const replaceText = async (page: Page, text: string): Promise<void> => {
	await key(page, 'Control+a');
	await typeIn(page, text);
};
const triple = (fields: Locator): Promise<number[]> => Promise.all([0, 1, 2].map((i) => dataValue(fields.nth(i))));
const pointerDown = (page: Page): Promise<void> => page.mouse.down();
const pointerUp = (page: Page): Promise<void> => page.mouse.up();
const pointerTo = (page: Page, x: number, y: number): Promise<void> => page.mouse.move(x, y);

// Computes a colour the way the page does, for values the token file cannot express such as color-mix().
const computedColor = (page: Page, css: string): Promise<string> =>
	page.evaluate((value) => {
		const swatch = document.body.appendChild(document.createElement('i'));
		swatch.style.color = value;
		const resolved = getComputedStyle(swatch).color;
		swatch.remove();
		return resolved;
	}, css);

async function centerOf(target: Locator): Promise<{ x: number; y: number }> {
	const box = await target.boundingBox();
	assert.ok(box, 'target has a box');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('DetailsHeader: the buttons are ue-button primitives with their hover and pressed looks, the lock closes the padlock, the name edits', async () => {
	await inPreview('DetailsHeader', async (page) => {
		const header = page.locator('ue-details-header');
		const add = header.locator('[data-role="add"]');
		assert.equal(await bgOf(add), rgb('secondary'));
		await add.hover();
		assert.equal(await bgOf(add), rgb('hover'));
		await pointerDown(page);
		assert.equal(await bgOf(add), rgb('header'));
		await pointerUp(page);

		const help = header.locator('[data-role="help"]');
		assert.equal(await bgOf(help), CLEAR);
		await help.hover();
		assert.equal(await bgOf(help), rgb('dropdown'));

		const lock = header.locator('[data-role="lock"]');
		const open = lock.locator('.DetailsHeader-shackle--open');
		const shut = lock.locator('.DetailsHeader-shackle--shut');
		assert.equal(await lock.getAttribute('aria-pressed'), 'false');
		assert.ok(await open.isVisible(), 'the padlock starts open');
		assert.ok(!(await shut.isVisible()));
		await lock.click();
		assert.equal(await lock.getAttribute('aria-pressed'), 'true');
		assert.ok(await shut.isVisible(), 'the padlock closes');
		assert.ok(!(await open.isVisible()));
		await page.mouse.move(2, 2);
		assert.equal(await bgOf(lock), rgb('primary'), 'a locked toggle fills Primary');
		await lock.click();
		assert.equal(await lock.getAttribute('aria-pressed'), 'false');
		assert.ok(await open.isVisible(), 'the padlock opens again');

		const label = header.locator('.DetailsHeader-label');
		const instance = header.locator('.DetailsHeader-instance .DetailsHeader-instanceName');
		assert.equal(await bgOf(label), CLEAR);
		await label.hover();
		assert.equal(await bgOf(label), rgb('input'));
		assert.ok((await shadowOf(label)).includes(rgb('hover')), 'hover outline');
		await label.click();
		assert.ok((await shadowOf(label)).includes(rgb('primary')), 'focus outline');
		await replaceText(page, 'Table');
		await key(page, 'Enter');
		assert.equal(await trimmed(label), 'Table');
		assert.equal(await trimmed(instance), 'Table');
		await label.click();
		await replaceText(page, 'Sofa');
		await key(page, 'Escape');
		assert.equal(await trimmed(label), 'Table');
	});
});

test('DetailsHeader: the pinned specimen shows its forced states and ignores the pointer', async () => {
	await inPreview('DetailsHeader', async (page) => {
		const pinned = page.locator('[data-pinned]');
		await assertInert(pinned);
		assert.ok((await shadowOf(pinned.locator('.DetailsHeader-label'))).includes(rgb('primary')), 'name box focused');
		assert.equal(await bgOf(pinned.locator('.button--small')), rgb('header'), 'Add pressed');
		const blueprint = pinned.locator('[aria-label="Blueprint"]');
		await hoverAt(page, pinned.locator('.button--small'));
		assert.equal(await bgOf(blueprint), rgb('hover'), 'Blueprint stays hovered');
		assert.equal(await bgOf(pinned.locator('.button--small')), rgb('header'), 'a real pointer over Add changes nothing');
		const lock = pinned.locator('[data-role="lock"]');
		await clickAt(page, lock);
		assert.equal(await lock.getAttribute('aria-pressed'), 'true', 'a click on a pinned toggle changes nothing');
		assert.equal(await bgOf(lock), rgb('dropdown'));
		assert.ok(await lock.locator('.DetailsHeader-shackle--shut').isVisible(), 'locked padlock');
	});
});

test('DetailsSearchRow: the search box types, clears and announces, the star toggles, the gear opens the view options', async () => {
	await inPreview('DetailsSearchRow', async (page) => {
		const row = page.locator('ue-details-search-row');
		const input = row.locator('.textinput__field');
		const box = row.locator('.textinput');
		const clear = row.locator('.textinput__clear');
		await watch(page, 'ue-search');
		await watch(page, 'ue-favorites');
		await watch(page, 'ue-view-option');

		assert.ok(!(await clear.isVisible()), 'no X without text');
		await box.hover();
		assert.ok((await shadowOf(box)).includes(rgb('hover')), 'hover outline');
		await input.click();
		assert.ok((await shadowOf(box)).includes(rgb('primary')), 'focus ring');
		await typeIn(page, 'scale');
		assert.equal(await input.inputValue(), 'scale');
		assert.ok(await clear.isVisible(), 'X shows with text');
		assert.deepEqual((await seen(page, 'ue-search')).slice(-1), [{ text: 'scale' }]);
		await clear.click();
		assert.equal(await input.inputValue(), '');
		assert.ok(!(await clear.isVisible()));
		assert.deepEqual((await seen(page, 'ue-search')).slice(-1), [{ text: '' }], 'the X announces the empty text');
		await typeIn(page, 'abc');
		await key(page, 'Escape');
		assert.equal(await input.inputValue(), '');
		assert.deepEqual((await seen(page, 'ue-search')).slice(-1), [{ text: '' }], 'Escape announces the empty text');

		const star = row.locator('[data-role="favorites"]');
		await star.click();
		assert.equal(await star.getAttribute('aria-pressed'), 'true');
		await page.mouse.move(2, 2);
		assert.equal(await bgOf(star), rgb('primary'), 'a toggle that is on fills Primary');
		assert.deepEqual(await seen(page, 'ue-favorites'), [{ on: true }]);
		await star.click();
		assert.equal(await star.getAttribute('aria-pressed'), 'false');
		assert.deepEqual((await seen(page, 'ue-favorites')).slice(-1), [{ on: false }]);

		const matrix = row.locator('[data-role="matrix"]');
		assert.equal(await bgOf(matrix), CLEAR);
		await matrix.hover();
		assert.equal(await bgOf(matrix), rgb('dropdown'));

		const gear = row.locator('[data-role="options"]');
		const menu = row.locator('.combobutton-menu');
		const modified = row.locator('.popupmenu__row[data-value="modified"]');
		assert.ok(!(await menu.isVisible()));
		await gear.click();
		assert.ok(await menu.isVisible());
		assert.equal(await gear.getAttribute('aria-expanded'), 'true');
		assert.equal(await modified.getAttribute('aria-checked'), 'false');
		await modified.click();
		assert.ok(!(await menu.isVisible()), 'menu closes after a pick');
		assert.equal(await modified.getAttribute('aria-checked'), 'true');
		assert.deepEqual(await seen(page, 'ue-view-option'), [{ option: 'modified', checked: true }]);
		await gear.click();
		await key(page, 'Escape');
		assert.ok(!(await menu.isVisible()));
		await gear.click();
		await row.locator('.popupmenu__row[data-value="collapseAll"]').click();
		assert.deepEqual((await seen(page, 'ue-view-option')).slice(-1), [{ option: 'collapseAll', checked: false }], 'a plain row announces unchecked');
	});
});

test('DetailsSearchRow: the pinned row shows the focused box and the favorites that are on, and ignores the pointer', async () => {
	await inPreview('DetailsSearchRow', async (page) => {
		const pinned = page.locator('[data-pinned]');
		await assertInert(pinned);
		const box = pinned.locator('.textinput');
		assert.ok((await shadowOf(box)).includes(rgb('primary')), 'focused box');
		await hoverAt(page, box);
		assert.ok((await shadowOf(box)).includes(rgb('primary')), 'a real pointer changes nothing');
		const star = pinned.locator('[aria-pressed]');
		await clickAt(page, star);
		assert.equal(await star.getAttribute('aria-pressed'), 'true');
		assert.equal(await bgOf(star), rgb('primary'));
	});
});

test('FilterPills: a click makes one active pill, hover and arrow keys work', async () => {
	await inPreview('FilterPills', async (page) => {
		const pills = page.locator('ue-filter-pills .FilterPills-pill');
		const checked = (): Promise<string[]> => pills.locator('xpath=self::*[contains(@class, "is-checked")]').allTextContents();
		assert.deepEqual(await checked(), ['All']);

		const physics = pills.filter({ hasText: /^Physics$/ });
		await physics.hover();
		assert.equal(await bgOf(physics), rgb('hover'));
		await physics.click();
		assert.deepEqual(await checked(), ['Physics']);
		assert.equal(await bgOf(physics), rgb('primary-hover'));
		await page.mouse.move(0, 0);
		assert.equal(await bgOf(physics), rgb('primary'));
		assert.equal(await physics.getAttribute('aria-selected'), 'true');
		assert.equal(await page.locator('ue-filter-pills [aria-selected="true"]').count(), 1);

		await key(page, 'ArrowRight');
		assert.deepEqual(await checked(), ['Rendering']);
		await key(page, 'Home');
		assert.deepEqual(await checked(), ['General']);
		await key(page, 'End');
		assert.deepEqual(await checked(), ['All']);
		await key(page, 'ArrowRight');
		assert.deepEqual(await checked(), ['General'], 'wraps around');
	});
});

test('SegmentedControl: click selects, arrows move, hover fills, the pinned row is untouched', async () => {
	await inPreview('SegmentedControl', async (page) => {
		const group = page.locator('ue-segmented-control').nth(0);
		const segs = group.locator('.SegmentedControl-seg');
		const checked = (): Promise<string[]> => group.locator('.SegmentedControl-seg.is-checked').allTextContents();
		assert.deepEqual(await checked(), ['Static']);

		await segs.nth(1).hover();
		assert.equal(await bgOf(segs.nth(1)), rgb('hover'));
		await segs.nth(1).click();
		assert.deepEqual(await checked(), ['Stationary']);
		assert.equal(await segs.nth(1).getAttribute('aria-checked'), 'true');
		assert.equal(await segs.nth(0).getAttribute('aria-checked'), 'false');
		await page.mouse.move(0, 0);
		assert.equal(await bgOf(segs.nth(1)), rgb('dropdown'));

		await key(page, 'ArrowRight');
		assert.deepEqual(await checked(), ['Movable']);
		await key(page, 'ArrowRight');
		assert.deepEqual(await checked(), ['Movable'], 'stops at the end');
		await key(page, 'Home');
		assert.deepEqual(await checked(), ['Static']);

		const pinnedRow = page.locator('.SegmentedControl-row').nth(1);
		assert.equal(await pinnedRow.locator('ue-segmented-control[data-pinned]').count(), 1);
		await clickAt(page, pinnedRow.locator('.SegmentedControl-seg').nth(0));
		assert.deepEqual(await pinnedRow.locator('.SegmentedControl-seg.is-checked').allTextContents(), ['Stationary']);

		const second = page.locator('ue-segmented-control').nth(1);
		await second.locator('.SegmentedControl-seg').nth(2).click();
		assert.deepEqual(await second.locator('.SegmentedControl-seg.is-checked').allTextContents(), ['Movable']);
		assert.deepEqual(await checked(), ['Static'], 'a second instance is independent');
	});
});

// Records the detail of every bubbling event of this name that reaches the document.
async function watch(page: Page, type: string): Promise<void> {
	await page.evaluate((name) => {
		const log: unknown[] = [];
		(window as unknown as Record<string, unknown>)['__seen_' + name] = log;
		document.addEventListener(name, (event) => log.push((event as CustomEvent).detail));
	}, type);
}

const seen = (page: Page, type: string): Promise<unknown[]> => page.evaluate((name) => ((window as unknown as Record<string, unknown[]>)['__seen_' + name] ?? []).slice(), type);

test('FilterPills: ue-filter-change reports the value once per change, and value and setPills drive the strip', async () => {
	await inPreview('FilterPills', async (page) => {
		const live = page.locator('ue-filter-pills').nth(0);
		const pills = live.locator('.FilterPills-pill');
		await watch(page, 'ue-filter-change');
		await pills.filter({ hasText: /^Physics$/ }).click();
		await pills.filter({ hasText: /^Physics$/ }).click();
		await pills.filter({ hasText: /^LOD$/ }).click();
		assert.deepEqual(await seen(page, 'ue-filter-change'), [{ value: 'Physics', label: 'Physics' }, { value: 'LOD', label: 'LOD' }], 'a click on the checked pill changes nothing');
		assert.equal(await live.locator('ue-event-status').textContent(), 'Section: LOD');
		type Api = HTMLElement & { value: string; setPills(items: object[]): void };
		await live.evaluate((el) => { (el as Api).value = 'Misc'; });
		assert.deepEqual(await live.locator('.FilterPills-pill.is-checked').allTextContents(), ['Misc']);
		assert.equal(await live.evaluate((el) => (el as Api).value), 'Misc');
		await live.evaluate((el) => (el as Api).setPills([{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta', checked: true }]));
		assert.deepEqual(await pills.allTextContents(), ['Alpha', 'Beta']);
		assert.equal(await live.locator('.FilterPills-strip').getAttribute('role'), 'tablist');
		assert.equal(await pills.nth(1).getAttribute('tabindex'), '0');
		assert.equal(await pills.nth(0).getAttribute('tabindex'), '-1');
		await pills.nth(1).focus();
		await key(page, 'ArrowLeft');
		assert.deepEqual(await live.locator('.FilterPills-pill.is-checked').allTextContents(), ['Alpha']);
		assert.deepEqual((await seen(page, 'ue-filter-change')).slice(-1), [{ value: 'a', label: 'Alpha' }], 'value is data-value');
	});
});

test('FilterPills: the tablist pill keeps the DetailsCategory section pill look', async () => {
	await inPreview('FilterPills', async (page) => {
		const pill = page.locator('ue-filter-pills').nth(0).locator('.FilterPills-pill').first();
		const style = await pill.evaluate((el) => {
			const s = getComputedStyle(el);
			return [s.paddingTop, s.paddingRight, s.fontSize, s.borderTopLeftRadius];
		});
		assert.deepEqual(style, ['4px', '16px', '10.667px', '4px']);
		assert.equal(await bgOf(pill), rgb('header'));
	});
});

test('FilterPills: chips remove with their X, add and set from data, and each strip is independent', async () => {
	await inPreview('FilterPills', async (page) => {
		const chips = page.locator('ue-filter-pills').nth(1);
		const names = (): Promise<string[]> => chips.locator('.FilterPills-chipName').allTextContents();
		assert.deepEqual(await names(), ['Static Mesh', 'Material', 'Texture']);
		const chip = chips.locator('.FilterPills-chip').first();
		assert.equal((await chip.boundingBox())!.height, 22);
		assert.equal(await bgOf(chip), rgb('secondary'));
		assert.equal((await chips.locator('.FilterPills-chipColor').first().boundingBox())!.width, 8);
		assert.equal(await bgOf(chips.locator('.FilterPills-chipColor').first()), rgb('accent-blue'));
		const remove = chip.locator('.FilterPills-chipRemove');
		assert.equal(await bgOf(remove), CLEAR);
		await remove.hover();
		assert.equal(await bgOf(remove), rgb('dropdown'));
		await watch(page, 'ue-pill-remove');
		await watch(page, 'ue-pill-add');
		await remove.click();
		assert.deepEqual(await names(), ['Material', 'Texture']);
		assert.deepEqual(await seen(page, 'ue-pill-remove'), [{ id: 'staticmesh', label: 'Static Mesh' }]);
		assert.equal(await chips.locator('ue-event-status').textContent(), 'Removed: Static Mesh');
		type Api = HTMLElement & { addChip(chip: object): void; removeChip(id: string): void; setChips(chips: object[]): void; getChips(): Array<{ id: string; label: string }> };
		await chips.evaluate((el) => (el as Api).addChip({ id: 'sound', label: 'Sound Cue', color: '#ff00ff' }));
		await chips.evaluate((el) => (el as Api).addChip({ id: 'sound', label: 'Sound Cue' }));
		assert.deepEqual(await names(), ['Material', 'Texture', 'Sound Cue'], 'a repeated id is ignored');
		assert.deepEqual(await seen(page, 'ue-pill-add'), [{ id: 'sound', label: 'Sound Cue', color: '#ff00ff' }]);
		assert.equal(await bgOf(chips.locator('.FilterPills-chipColor').last()), 'rgb(255, 0, 255)');
		await chips.locator('.FilterPills-chip').last().locator('.FilterPills-chipRemove').click();
		assert.deepEqual(await chips.evaluate((el) => (el as Api).getChips().map((each) => each.id)), ['material', 'texture']);
		await chips.evaluate((el) => (el as Api).setChips([{ id: 'texture', label: 'Texture' }, { id: 'blueprint', label: 'Blueprint' }]));
		assert.deepEqual(await names(), ['Texture', 'Blueprint'], 'setChips drops the chips that are not listed and appends the new ones');
		assert.deepEqual((await seen(page, 'ue-pill-remove')).slice(-2), [{ id: 'sound', label: 'Sound Cue' }, { id: 'material', label: 'Material' }]);
		assert.deepEqual(await page.locator('ue-filter-pills').nth(0).locator('.FilterPills-pill.is-checked').allTextContents(), ['All'], 'the tablist did not move');
		await chips.evaluate((el) => (el as Api).removeChip('texture'));
		await chips.evaluate((el) => (el as Api).removeChip('blueprint'));
		assert.equal(await chips.locator('.FilterPills-strip').isVisible(), false, 'an empty chip strip takes no room');
	});
});

test('SegmentedControl: ue-segment-change carries the value, the value property drives it, and a second control is independent', async () => {
	await inPreview('SegmentedControl', async (page) => {
		const first = page.locator('ue-segmented-control').nth(0);
		await watch(page, 'ue-segment-change');
		await first.locator('.SegmentedControl-seg').nth(2).click();
		await first.locator('.SegmentedControl-seg').nth(2).click();
		await key(page, 'ArrowLeft');
		assert.deepEqual(await seen(page, 'ue-segment-change'), [{ value: 'Movable', label: 'Movable' }, { value: 'Stationary', label: 'Stationary' }], 'a click on the checked segment fires nothing');
		assert.equal(await first.locator('xpath=ancestor::*[contains(@class, "SegmentedControl-live")]').locator('ue-event-status').textContent(), 'Mobility: Stationary');
		type Api = HTMLElement & { value: string };
		assert.equal(await first.evaluate((el) => (el as Api).value), 'Stationary');
		await first.evaluate((el) => { (el as Api).value = 'Static'; });
		assert.deepEqual(await first.locator('.SegmentedControl-seg.is-checked').allTextContents(), ['Static']);
		assert.deepEqual((await seen(page, 'ue-segment-change')).slice(-1), [{ value: 'Static', label: 'Static' }]);
		assert.deepEqual(await page.locator('ue-segmented-control').nth(1).locator('.SegmentedControl-seg.is-checked').allTextContents(), ['Static'], 'the control in row 3 did not follow');
	});
});

test('SegmentedControl: the rail variant draws the Place Actors category look with vertical roving keys', async () => {
	await inPreview('SegmentedControl', async (page) => {
		const rail = page.locator('ue-segmented-control').nth(2);
		const segs = rail.locator('.SegmentedControl-seg');
		const basic = segs.nth(1);
		assert.equal(await bgOf(basic), rgb('primary'), 'checked is Primary');
		assert.match(await shadowOf(basic), /rgba\(0, 0, 0, 0\.8\)/, 'with the 0.5px outline');
		const box = (await basic.boundingBox())!;
		assert.deepEqual([box.width, box.height], [36, 36]);
		assert.equal(await basic.evaluate((el) => getComputedStyle(el).borderTopLeftRadius), '4px');
		assert.equal(await basic.locator('svg').evaluate((el) => getComputedStyle(el).width), '20px');
		assert.equal((await rail.locator('.SegmentedControl').boundingBox())!.width, 44);
		assert.equal(await bgOf(rail.locator('.SegmentedControl')), rgb('panel'));
		const lights = segs.nth(2);
		await lights.hover();
		assert.equal(await bgOf(lights), rgb('dropdown'), 'unchecked hover is Dropdown');
		await basic.hover();
		assert.equal(await bgOf(basic), rgb('primary-hover'));
		await basic.click();
		await key(page, 'ArrowDown');
		assert.deepEqual(await rail.locator('.SegmentedControl-seg.is-checked').getAttribute('aria-label'), 'Lights');
		await key(page, 'End');
		assert.equal(await rail.locator('.SegmentedControl-seg.is-checked').getAttribute('aria-label'), 'All');
		await key(page, 'ArrowUp');
		assert.equal(await rail.locator('.SegmentedControl-seg.is-checked').getAttribute('aria-label'), 'Volumes');
		await key(page, 'Home');
		assert.equal(await rail.locator('.SegmentedControl-seg.is-checked').getAttribute('aria-label'), 'Recent');
		assert.equal(await rail.locator('xpath=following-sibling::ue-event-status').textContent(), 'Category: Recent');
		assert.equal(await segs.nth(0).getAttribute('tabindex'), '0');
		assert.equal(await segs.nth(1).getAttribute('tabindex'), '-1');
		const wrapped = page.locator('ue-segmented-control').nth(3).locator('.SegmentedControl');
		assert.equal(await wrapped.evaluate((el) => getComputedStyle(el).flexDirection), 'row');
		assert.equal(await page.locator('use').count(), 0, 'no glyph refers to a symbol');
	});
});

test('AssetPicker: the combo list sets the label and thumbnail, the buttons react, reset restores', async () => {
	await inPreview('AssetPicker', async (page) => {
		const picker = page.locator('ue-asset-picker');
		const combo = picker.locator('.combobutton');
		const menu = picker.locator('.combobutton-menu');
		const label = picker.locator('.combobutton__label');
		const reset = picker.locator('.resettodefault');
		const thumb = picker.locator('.AssetPicker-thumbFrame');
		const option = (name: string): Locator => picker.locator('.popupmenu__row[data-value="' + name + '"]');
		await watch(page, 'ue-asset-change');
		await watch(page, 'ue-asset-browse');

		assert.equal(await trimmed(label), 'SM_Chair');
		assert.equal(await visibilityOf(reset), 'visible', 'SM_Chair is not the default');
		assert.ok(!(await menu.isVisible()));
		await combo.hover();
		assert.ok((await shadowOf(combo)).includes(rgb('hover')));
		await combo.click();
		assert.ok(await menu.isVisible());
		await option('SM_Couch').click();
		assert.ok(!(await menu.isVisible()));
		assert.equal(await trimmed(label), 'SM_Couch');
		assert.equal(await thumb.getAttribute('title'), '/Game/Props/SM_Couch.SM_Couch');
		assert.equal(await option('SM_Couch').getAttribute('aria-selected'), 'true');
		assert.equal(await option('SM_Chair').getAttribute('aria-selected'), 'false');
		assert.deepEqual(await seen(page, 'ue-asset-change'), [{ asset: 'SM_Couch' }]);

		await combo.focus();
		await key(page, 'ArrowDown');
		assert.ok(await menu.isVisible());
		await key(page, 'ArrowDown');
		await key(page, 'Enter');
		assert.equal(await trimmed(label), 'SM_Lamp');
		assert.ok(await combo.evaluate((el) => el === document.activeElement), 'focus returns to the combo');

		const use = picker.locator('[data-role="use"]');
		await use.hover();
		assert.equal(await bgOf(use), rgb('dropdown'));
		await use.click();
		assert.equal(await trimmed(label), 'SM_Table');
		assert.equal(await option('SM_Table').getAttribute('aria-selected'), 'true', 'use-selected marks the list row too');
		assert.equal(await thumb.getAttribute('title'), '/Game/Props/SM_Table.SM_Table');

		await picker.locator('[data-role="browse"]').click();
		assert.deepEqual(await seen(page, 'ue-asset-browse'), [{ asset: 'SM_Table' }]);

		assert.equal(await visibilityOf(reset), 'visible');
		await reset.click();
		assert.equal(await trimmed(label), 'None');
		assert.equal(await visibilityOf(reset), 'hidden');
		assert.equal(await thumb.getAttribute('title'), 'None');
		assert.deepEqual((await seen(page, 'ue-asset-change')).slice(-1), [{ asset: 'None' }]);

		await combo.click();
		await page.mouse.click(910, 710);
		assert.ok(!(await menu.isVisible()), 'an outside click closes the list');
	});
});

test('AssetPicker: the pinned row shows the open list with one hovered row and ignores the pointer', async () => {
	await inPreview('AssetPicker', async (page) => {
		const pinned = page.locator('[data-pinned]');
		await assertInert(pinned);
		assert.ok(await pinned.locator('.combobutton-menu').isVisible(), 'the list is open');
		const hovered = pinned.locator('.popupmenu__row--hover');
		assert.equal(await trimmed(hovered), 'SM_Table');
		assert.equal(await bgOf(hovered), rgb('primary'));
		const first = pinned.locator('.popupmenu__row').first();
		await hoverAt(page, first);
		assert.equal(await bgOf(first), CLEAR, 'a real pointer changes nothing');
		assert.equal(await colorOf(pinned.locator('.resettodefault')), rgb('foreground-hover'), 'reset hovered');
	});
});

test('VectorInput: dragging changes a value and shows reset, reset restores, typing and keys work', async () => {
	await inPreview('VectorInput', async (page) => {
		const scale = page.locator('ue-vector-input .VectorInput-row').nth(2);
		const fields = scale.locator('.spinbox');
		const reset = scale.locator('.resettodefault');
		const shown = (i: number): Promise<string> => trimmed(fields.nth(i).locator('.spinbox__text'));

		assert.equal(await fields.nth(0).evaluate((el) => getComputedStyle(el).cursor), 'ew-resize');
		assert.equal(await visibilityOf(reset), 'hidden', 'no reset at the default');
		await fields.nth(0).hover();
		assert.ok((await shadowOf(fields.nth(0))).includes(rgb('hover')));

		const { x, y } = await centerOf(fields.nth(0));
		await pointerTo(page, x, y);
		await pointerDown(page);
		await page.mouse.move(x + 20, y, { steps: 4 });
		assert.ok((await shadowOf(fields.nth(0))).includes(rgb('primary')), 'active outline while dragging');
		await page.mouse.move(x + 70, y, { steps: 8 });
		await pointerUp(page);
		assert.ok((await dataValue(fields.nth(0))) > 1.3, 'dragging right raised X: ' + (await dataValue(fields.nth(0))));
		assert.equal(await dataValue(fields.nth(1)), 1, 'the other axes stay unlinked');
		assert.equal(await visibilityOf(reset), 'visible', 'reset shows after a change');
		assert.ok(!(await fields.nth(0).evaluate((el) => el.classList.contains('spinbox--active'))), 'active outline ends with the drag');

		await reset.click();
		assert.deepEqual(await triple(fields), [1, 1, 1]);
		assert.equal(await shown(0), '1.0');
		assert.equal(await visibilityOf(reset), 'hidden');

		await pointerTo(page, x, y);
		await pointerDown(page);
		await page.mouse.move(x + 60, y, { steps: 6 });
		await key(page, 'Escape');
		await pointerUp(page);
		assert.equal(await dataValue(fields.nth(0)), 1, 'Escape restores the value from before the drag');

		await fields.nth(1).click();
		assert.ok(await fields.nth(1).evaluate((el) => el.classList.contains('spinbox--text')));
		await typeIn(page, '2.5');
		await key(page, 'Enter');
		assert.equal(await dataValue(fields.nth(1)), 2.5);
		assert.equal(await shown(1), '2.5');
		await fields.nth(1).click();
		await typeIn(page, '9');
		await key(page, 'Escape');
		assert.equal(await dataValue(fields.nth(1)), 2.5);

		await fields.nth(2).focus();
		await key(page, 'ArrowUp');
		assert.ok(Math.abs((await dataValue(fields.nth(2))) - 1.0025) < 1e-9);
		await key(page, 'ArrowDown');
		await key(page, 'ArrowDown');
		assert.ok(Math.abs((await dataValue(fields.nth(2))) - 0.9975) < 1e-9);
	});
});

test('VectorInput: the scale lock links the axes, the label menu opens, units survive an edit, events announce each change', async () => {
	await inPreview('VectorInput', async (page) => {
		const rows = page.locator('ue-vector-input .VectorInput-row');
		const fields = rows.nth(2).locator('.spinbox');
		const lock = rows.nth(2).locator('[data-role="lock"]');
		const open = lock.locator('.VectorInput-shackle--open');
		const shut = lock.locator('.VectorInput-shackle--shut');
		await watch(page, 'ue-vector-change');
		await watch(page, 'ue-vector-space');

		await lock.click();
		assert.equal(await lock.getAttribute('aria-pressed'), 'true');
		assert.ok(await shut.isVisible(), 'the padlock closes');
		assert.ok(!(await open.isVisible()));
		assert.equal(await lock.getAttribute('title'), 'Scale uniformly (locked)');
		await fields.nth(0).click();
		await typeIn(page, '2');
		await key(page, 'Enter');
		assert.deepEqual(await triple(fields), [2, 2, 2]);
		assert.deepEqual((await seen(page, 'ue-vector-change')).slice(-1), [{ values: [2, 2, 2] }]);

		await fields.nth(1).focus();
		await key(page, 'ArrowUp');
		const [x, , z] = await triple(fields);
		assert.ok(Math.abs(x - 2.0025) < 1e-6 && Math.abs(z - 2.0025) < 1e-6, 'stepping Y moves X and Z by the same ratio');
		assert.match(await trimmed(fields.nth(0).locator('.spinbox__text')), /^2\.00[23]$/, 'the linked field redraws');

		await lock.click();
		assert.ok(await open.isVisible(), 'the padlock opens');
		assert.equal(await lock.getAttribute('title'), 'Scale uniformly (unlocked)');
		await fields.nth(0).click();
		await typeIn(page, '3');
		await key(page, 'Enter');
		assert.equal(await dataValue(fields.nth(0)), 3);
		assert.ok((await dataValue(fields.nth(1))) < 3, 'unlocked axes move alone');

		const menu = rows.nth(0).locator('.combobutton-menu');
		assert.ok(!(await menu.isVisible()));
		await rows.nth(0).locator('.combobutton').click();
		assert.ok(await menu.isVisible());
		assert.equal(await trimmed(menu.locator('.popupmenu__heading')), 'Location Type');
		await menu.locator('.popupmenu__row', { hasText: 'World' }).click();
		assert.ok(!(await menu.isVisible()));
		assert.equal(await trimmed(rows.nth(0).locator('.combobutton__label')), 'Location', 'the label stays');
		assert.equal(await menu.locator('.popupmenu__row', { hasText: 'World' }).getAttribute('aria-checked'), 'true');
		assert.equal(await menu.locator('.popupmenu__row', { hasText: 'Relative' }).getAttribute('aria-checked'), 'false');
		assert.deepEqual(await seen(page, 'ue-vector-space'), [{ space: 'World' }]);

		const yaw = rows.nth(1).locator('.spinbox').nth(2);
		await yaw.click();
		await replaceText(page, '90');
		await key(page, 'Enter');
		assert.equal(await trimmed(yaw.locator('.spinbox__text')), '90.0');
		assert.equal(await trimmed(yaw.locator('.spinbox__unit')), '°');
		assert.equal(await dataValue(yaw), 90);
	});
});

test('VectorInput: the pinned rows show the active field and ignore the pointer', async () => {
	await inPreview('VectorInput', async (page) => {
		const pinned = page.locator('[data-pinned]');
		await assertInert(pinned);
		const z = pinned.locator('.spinbox--active');
		assert.equal(await z.count(), 1);
		assert.ok((await shadowOf(z)).includes(rgb('primary')));
		const first = pinned.locator('.spinbox').first();
		await hoverAt(page, first);
		assert.ok((await shadowOf(first)).includes(rgb('input-outline')), 'a real pointer changes nothing');
		assert.equal(await visibilityOf(pinned.locator('.resettodefault--idle')), 'hidden');
	});
});

test('DetailsCategory: headers fold their rows, row arrows fold children, checkbox, combo and text edit work', async () => {
	await inPreview('DetailsCategory', async (page) => {
		const frame = page.locator('ue-details-category').nth(0);
		const header = frame.locator('.DetailsCategory-catRow').nth(0);
		const rowOf = (name: string): Locator => frame.locator('.DetailsCategory-row').filter({ has: page.locator('.DetailsCategory-label', { hasText: new RegExp('^' + name + '$') }) });
		const turn = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).transform);

		assert.ok(await rowOf('Visible').isVisible());
		assert.ok(!(await rowOf('Static Mesh').isVisible()), 'Static Mesh rows start folded');
		await header.hover();
		assert.equal(await colorOf(header.locator('.DetailsCategory-arrow')), await computedColor(page, 'color-mix(in srgb, var(--foreground-hover) 60%, transparent)'));
		assert.notEqual(await turn(header.locator('.DetailsCategory-arrow')), 'none', 'the caret points down while expanded');

		await header.click();
		assert.equal(await header.getAttribute('aria-expanded'), 'false');
		assert.equal(await turn(header.locator('.DetailsCategory-arrow')), 'none', 'the caret points right while folded');
		for (const name of ['Visible', 'Actor Label', 'Collision Preset', 'Lighting', 'Cast Shadow']) assert.ok(!(await rowOf(name).isVisible()), name + ' folded');
		await header.press('ArrowRight');
		assert.notEqual(await turn(header.locator('.DetailsCategory-arrow')), 'none');
		assert.ok(await rowOf('Visible').isVisible());
		await header.press('Enter');
		assert.ok(!(await rowOf('Visible').isVisible()), 'Enter folds');
		await header.press('Space');
		assert.ok(await rowOf('Visible').isVisible(), 'Space unfolds');

		const arrow = rowOf('Lighting').locator('.DetailsCategory-rowArrow');
		assert.ok(await rowOf('Cast Shadow').isVisible());
		await arrow.click();
		assert.ok(!(await rowOf('Cast Shadow').isVisible()));
		assert.equal(await arrow.getAttribute('aria-expanded'), 'false');
		await arrow.click();
		assert.ok(await rowOf('Cast Shadow').isVisible());

		const name = rowOf('Visible').locator('.DetailsCategory-name');
		assert.equal(await bgOf(name), rgb('panel'));
		await name.hover();
		assert.equal(await bgOf(name), rgb('header'));

		const check = rowOf('Visible').locator('.checkbox');
		const tick = check.locator('.checkbox__glyph--check');
		assert.equal(await check.getAttribute('aria-checked'), 'true');
		assert.ok(await tick.isVisible());
		await check.click();
		assert.equal(await check.getAttribute('aria-checked'), 'false');
		assert.ok(!(await tick.isVisible()), 'an unchecked box draws no tick');
		await check.press('Space');
		assert.equal(await check.getAttribute('aria-checked'), 'true');

		const preset = rowOf('Collision Preset');
		await preset.locator('.combobutton').click();
		assert.ok(await preset.locator('.combobutton-menu').isVisible());
		await preset.locator('.popupmenu__row', { hasText: 'NoCollision' }).click();
		assert.equal(await trimmed(preset.locator('.combobutton__label')), 'NoCollision');
		assert.ok(!(await preset.locator('.combobutton-menu').isVisible()));

		const field = rowOf('Actor Label').locator('.textinput__field');
		const reset = rowOf('Actor Label').locator('.resettodefault');
		await field.click();
		assert.ok((await shadowOf(rowOf('Actor Label').locator('.textinput'))).includes(rgb('primary')));
		await replaceText(page, 'Table');
		await key(page, 'Enter');
		assert.equal(await field.inputValue(), 'Table');
		await field.click();
		await replaceText(page, 'Junk');
		await key(page, 'Escape');
		assert.equal(await field.inputValue(), 'Table');
		await reset.click();
		assert.equal(await field.inputValue(), 'StaticMeshActor_0');
		assert.equal(await visibilityOf(reset), 'hidden');
		await field.click();
		await typeIn(page, 'X');
		assert.equal(await visibilityOf(reset), 'visible', 'typing a different value shows the arrow');

		assert.ok(!(await rowOf('Render in Main Pass').isVisible()));
		await frame.locator('.DetailsCategory-advRow').click();
		assert.ok(await rowOf('Render in Main Pass').isVisible());
		await frame.locator('.DetailsCategory-catRow').nth(1).click();
		assert.ok(await frame.locator('.DetailsCategory-row', { hasText: 'SM_Chair' }).isVisible());

		const pinned = page.locator('[data-pinned] .DetailsCategory-frame');
		assert.equal(await pinned.locator('xpath=ancestor::ue-details-category[@data-pinned]').count(), 1);
		await assertInert(pinned);
		assert.ok(await pinned.locator('.DetailsCategory-row.is-hover').isVisible());
		assert.equal(await bgOf(pinned.locator('.DetailsCategory-row.is-hover .DetailsCategory-name')), rgb('header'), 'the forced hover fills the row');
		await clickAt(page, pinned.locator('.DetailsCategory-catRow').first());
		assert.equal(await pinned.locator('.DetailsCategory-catRow').first().getAttribute('aria-expanded'), 'true', 'a click on a pinned header folds nothing');
	});
});

test('DetailsCategory: the live details panel filters rows by search and section, and the modified view follows the nested resets', async () => {
	await inPreview('DetailsCategory', async (page) => {
		const panel = page.locator('.DetailsCategory-panel');
		const input = panel.locator('ue-details-search-row .textinput__field');
		const rowsIn = panel.locator('.DetailsCategory-row, [data-label]');
		const shown = (): Promise<string[]> => rowsIn.evaluateAll((rows) => rows.filter((row) => (row as HTMLElement).offsetParent !== null).map((row) => ((row as HTMLElement).dataset.label ?? row.querySelector('.DetailsCategory-label')?.textContent ?? '').trim()));
		const cats = (): Promise<string[]> => panel.locator('.DetailsCategory-cat').evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => (el.querySelector('.DetailsCategory-title')?.textContent ?? '').trim()));
		const pill = (label: string): Locator => panel.locator('.FilterPills-pill', { hasText: new RegExp('^' + label + '$') });
		const option = async (name: string): Promise<void> => {
			await panel.locator('[data-role="options"]').click();
			await panel.locator('.popupmenu__row[data-value="' + name + '"]').click();
		};
		const everything = ['Actor Label', 'Tags', 'Can be Damaged', 'Mass', 'Location', 'Visible', 'Lighting', 'Cast Shadow', 'Receives Decals'];

		assert.deepEqual(await cats(), ['General', 'Rendering']);
		assert.deepEqual(await shown(), everything);

		await input.click();
		await typeIn(page, 'shadow');
		assert.deepEqual(await shown(), ['Lighting', 'Cast Shadow'], 'the parent row stays with its matching child');
		assert.deepEqual(await cats(), ['Rendering'], 'a category with no match hides');
		assert.ok(await panel.locator('.textinput__clear').isVisible());
		await key(page, 'Escape');
		assert.equal(await input.inputValue(), '');
		assert.deepEqual(await shown(), everything);

		await typeIn(page, 'locat');
		assert.deepEqual(await shown(), ['Location'], 'a nested composite row takes part in the search');
		await key(page, 'Escape');
		await typeIn(page, 'zzz');
		assert.deepEqual(await shown(), []);
		assert.ok(await panel.locator('.DetailsCategory-empty').isVisible(), 'empty message');
		await panel.locator('.textinput__clear').click();
		assert.ok(!(await panel.locator('.DetailsCategory-empty').isVisible()));

		await pill('General').click();
		assert.deepEqual(await cats(), ['General']);
		assert.equal(await panel.locator('.FilterPills-pill.is-checked').count(), 1);
		await pill('Physics').click();
		assert.deepEqual(await cats(), []);
		assert.ok(await panel.locator('.DetailsCategory-empty').isVisible());
		await pill('Rendering').click();
		assert.deepEqual(await cats(), ['Rendering']);
		await input.click();
		await typeIn(page, 'tags');
		assert.deepEqual(await shown(), [], 'search and section combine');
		await panel.locator('.textinput__clear').click();
		await pill('All').click();

		await option('collapseAll');
		assert.deepEqual(await shown(), []);
		await option('expandAll');
		assert.deepEqual(await shown(), everything);
		await option('modified');
		assert.deepEqual(await shown(), ['Actor Label', 'Tags', 'Mass', 'Location'], 'only rows with a reset arrow');
		await panel.locator('.DetailsCategory-row', { hasText: 'Mass' }).locator('.resettodefault').click();
		assert.deepEqual(await shown(), ['Actor Label', 'Tags', 'Location'], 'resetting a spin box row drops it from the modified view');
		await panel.locator('ue-vector-input .resettodefault').click();
		assert.deepEqual(await shown(), ['Actor Label', 'Tags'], 'resetting the nested vector row drops it too');
		await option('modified');
		assert.deepEqual(await shown(), everything);

		const star = panel.locator('[data-role="favorites"]');
		await star.click();
		assert.equal(await star.getAttribute('aria-pressed'), 'true');
		const lock = panel.locator('[data-role="lock"]');
		await lock.click();
		assert.equal(await lock.getAttribute('aria-pressed'), 'true');
		assert.ok(await lock.locator('.DetailsHeader-shackle--shut').isVisible());
		const name = panel.locator('.DetailsHeader-label');
		await name.click();
		await replaceText(page, 'Bench');
		await key(page, 'Enter');
		assert.equal(await trimmed(name), 'Bench');
		assert.equal(await trimmed(panel.locator('.DetailsHeader-instance .DetailsHeader-instanceName')), 'Bench');
	});
});

// ---------- composed from primitives ----------

const read = (...parts: string[]): string => fs.readFileSync(path.join(ds, ...parts), 'utf8');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

// The classes each composite owns. Every other class in its CSS, its markup and its preview comes from a primitive.
const OWN: Record<string, string[]> = {
	DetailsHeader: ['', 'frame', 'icon', 'label', 'name', 'actions', 'positive', 'shackle', 'shackle--open', 'shackle--shut', 'instanceBox', 'instance', 'instanceName', 'instanceContext', 'cap'],
	DetailsSearchRow: ['', 'frame', 'searchSlot', 'cap'],
	AssetPicker: ['frame', 'row', 'name', 'value', 'right', 'split', 'thumbSlot', 'thumbFrame', 'thumb', 'strip', 'thumbBorder', 'col', 'buttons', 'cap'],
	VectorInput: ['frame', 'row', 'name', 'value', 'right', 'split', 'lockSlot', 'fields', 'shackle', 'shackle--open', 'shackle--shut', 'cap'],
	DetailsCategory: ['frame', 'cat', 'catRow', 'arrow', 'title', 'row', 'indent', 'name', 'nameInner', 'rowArrow', 'label', 'value', 'right', 'split', 'adv', 'advRow', 'empty', 'panel', 'cap'],
};
const tokensOf = (each: string): string[] => OWN[each].map((cls) => (cls === '' ? each : each + '-' + cls));

// A preview can nest another composite, so that composite's layout classes are allowed there too.
const NESTS: Record<string, string[]> = {
	DetailsHeader: [],
	DetailsSearchRow: [],
	AssetPicker: [],
	VectorInput: [],
	DetailsCategory: ['DetailsHeader', 'DetailsSearchRow', 'VectorInput'],
};

const PRIMITIVE_CLASS = /\.(button|checkbox|checkbox-toggle|combobutton|combobutton-anchor|combobutton-menu|popupmenu|textinput|spinbox|slider|tooltip|expandablearea|resettodefault|FilterPills)(__[A-Za-z-]+|--[A-Za-z-]+|-[A-Za-z]+)?\s*[,{:[>+~.]/;

for (const name of Object.keys(OWN)) {
	test(name + ': its CSS holds only its own layout and its TS re-implements no primitive', () => {
		const css = stripComments(read('src', name, name + '.css'));
		const preview = Array.from(read('components', name, 'preview.html').matchAll(/<style>([\s\S]*?)<\/style>/g), (m) => stripComments(m[1])).join('\n');
		const own = new Set(tokensOf(name));
		for (const [where, text] of [['component CSS', css], ['preview style', preview]] as const) {
			const hit = PRIMITIVE_CLASS.exec(text);
			assert.equal(hit, null, where + ' styles a primitive: ' + hit?.[0]);
			for (const found of text.matchAll(new RegExp('\\.(' + name + '(?:-[A-Za-z0-9-]+)?)(?![A-Za-z0-9-])', 'g'))) assert.ok(own.has(found[1]), where + ' has the class ' + found[1] + ', which is not in the composite layout list');
		}
		const source = read('src', name, name + '.ts');
		assert.doesNotMatch(source, /_shared\/(popupmenu|drag)\.ts/, 'a shared menu or drag helper');
		assert.doesNotMatch(source, /wireMenu|drag\(/, 'its own menu or drag wiring');
	});

	scenario(name + ': every class in the preview markup is a primitive class or a layout class of the composite', name, async (page) => {
		const prefixes = [name, ...NESTS[name]];
		const stray = await page.evaluate(
			({ prefixes, allowed }) => {
				const found = new Set<string>();
				for (const el of Array.from(document.querySelectorAll('[class]'))) {
					for (const token of Array.from(el.classList)) {
						const prefixed = prefixes.some((prefix) => token === prefix || token.startsWith(prefix + '-'));
						if (prefixed && !allowed.includes(token)) found.add(token);
					}
				}
				return Array.from(found);
			},
			{ prefixes, allowed: prefixes.flatMap(tokensOf) },
		);
		assert.deepEqual(stray, [], 'classes of this composite that are not layout classes');
	});
}

scenario('DetailsHeader: four ue-button elements', 'DetailsHeader', async (page) => {
	assert.equal(await page.locator('ue-details-header ue-button').count(), 4);
});

scenario('DetailsSearchRow: one search box, two buttons and one combo button with its popup menu', 'DetailsSearchRow', async (page) => {
	const row = page.locator('ue-details-search-row');
	assert.deepEqual([await row.locator('ue-text-input').count(), await row.locator('ue-button').count(), await row.locator('ue-combo-button').count(), await row.locator('ue-popup-menu').count()], [1, 2, 1, 1]);
});

scenario('AssetPicker: one combo button, two buttons and one reset arrow', 'AssetPicker', async (page) => {
	const picker = page.locator('ue-asset-picker');
	assert.deepEqual([await picker.locator('ue-combo-button').count(), await picker.locator('ue-button').count(), await picker.locator('ue-reset-to-default').count()], [1, 2, 1]);
});

scenario('VectorInput: nine spin boxes, three label combos, one lock and three reset arrows', 'VectorInput', async (page) => {
	const vectors = page.locator('ue-vector-input');
	assert.deepEqual([await vectors.locator('ue-spin-box').count(), await vectors.locator('ue-combo-button').count(), await vectors.locator('ue-button').count(), await vectors.locator('ue-reset-to-default').count()], [9, 3, 1, 3]);
});

scenario('DetailsCategory: the panel nests the header, the search row, the pills and a vector input, and its rows use the control primitives', 'DetailsCategory', async (page) => {
	const panel = page.locator('.DetailsCategory-panel');
	for (const tag of ['ue-details-header', 'ue-details-search-row', 'ue-filter-pills', 'ue-vector-input']) assert.equal(await panel.locator(tag).count(), 1, tag);
	const rows = panel.locator('.DetailsCategory-row');
	assert.equal(await rows.locator('ue-checkbox').count(), 4);
	assert.equal(await rows.locator('ue-text-input').count(), 2);
	assert.equal(await rows.locator('ue-spin-box').count(), 1);
	assert.equal(await rows.locator('ue-reset-to-default').count(), 3);
	assert.equal(await page.locator('ue-details-category').nth(0).locator('ue-combo-button').count(), 2);
});

for (const name of ['DetailsHeader', 'DetailsSearchRow', 'FilterPills', 'DetailsCategory', 'VectorInput', 'SegmentedControl', 'AssetPicker']) {
	test(name + ': no script tags, captions present', async () => {
		await inPreview(name, async (page) => {
			assert.equal(await page.locator('script:not([src])').count(), 0, 'inline script');
			assert.equal(await page.locator('script:not([src$="bundle.js"]):not([src$=".js"])').count(), 0, 'script tag');
			assert.ok((await page.locator('[class*="-cap"]').count()) >= 1, 'captions');
		});
	});
}
