/// <reference lib="dom" />
// Interaction tests for the Details group: the previews run their custom elements in a real browser.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locator, Page } from 'playwright';
import { bgOf, inPreview, rgb } from './preview-kit.ts';

const CLEAR = 'rgba(0, 0, 0, 0)';

const shadowOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).boxShadow);
const colorOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).color);
const visibilityOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).visibility);
const trimmed = async (target: Locator): Promise<string> => ((await target.textContent()) ?? '').trim();
const dataValue = (target: Locator): Promise<number> => target.evaluate((el) => Number((el as HTMLElement).dataset.value));
const activeClass = (page: Page): Promise<string> => page.evaluate(() => (document.activeElement as HTMLElement).className);
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

test('DetailsHeader: buttons show hover and pressed, the lock toggles, the name edits', async () => {
	await inPreview('DetailsHeader', async (page) => {
		const add = page.locator('ue-details-header .DetailsHeader-add');
		assert.equal(await bgOf(add), rgb('secondary'));
		await add.hover();
		assert.equal(await bgOf(add), rgb('hover'));
		await pointerDown(page);
		assert.equal(await bgOf(add), rgb('header'));
		await pointerUp(page);

		const help = page.locator('ue-details-header .DetailsHeader-help');
		assert.equal(await bgOf(help), CLEAR);
		await help.hover();
		assert.equal(await bgOf(help), rgb('dropdown'));

		const lock = page.locator('ue-details-header .DetailsHeader-lock');
		const glyph = lock.locator('use');
		assert.equal(await glyph.getAttribute('href'), '#DetailsHeader-unlock');
		await lock.click();
		assert.equal(await lock.getAttribute('aria-pressed'), 'true');
		assert.equal(await glyph.getAttribute('href'), '#DetailsHeader-locked');
		await lock.click();
		assert.equal(await glyph.getAttribute('href'), '#DetailsHeader-unlock');

		const label = page.locator('ue-details-header .DetailsHeader-label');
		const instance = page.locator('ue-details-header .DetailsHeader-instance .name');
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

test('DetailsSearchRow: typing shows the clear X, Escape and X clear, star toggles, gear opens a menu', async () => {
	await inPreview('DetailsSearchRow', async (page) => {
		const row = page.locator('ue-details-search-row');
		const input = row.locator('.DetailsSearchRow-text');
		const box = row.locator('.DetailsSearchRow-search');
		const clear = row.locator('.DetailsSearchRow-clear');

		assert.ok(!(await clear.isVisible()), 'no X without text');
		await box.hover();
		assert.ok((await shadowOf(box)).includes(rgb('hover')), 'hover outline');
		await input.click();
		assert.ok((await shadowOf(box)).includes(rgb('primary')), 'focus ring');
		await typeIn(page, 'scale');
		assert.equal(await input.inputValue(), 'scale');
		assert.ok(await clear.isVisible(), 'X shows with text');
		await clear.click();
		assert.equal(await input.inputValue(), '');
		assert.ok(!(await clear.isVisible()));
		await typeIn(page, 'abc');
		await key(page, 'Escape');
		assert.equal(await input.inputValue(), '');

		const star = row.locator('[data-role="favorites"]');
		await star.click();
		assert.equal(await star.getAttribute('aria-pressed'), 'true');
		assert.equal(await colorOf(star), rgb('accent-blue'));
		await star.click();
		assert.equal(await star.getAttribute('aria-pressed'), 'false');

		const table = row.locator('.DetailsSearchRow-btn.is-button').first();
		await table.hover();
		assert.equal(await bgOf(table), rgb('dropdown'));

		const gear = row.locator('[data-role="options"]');
		const menu = row.locator('.DetailsSearchRow-menu');
		const modified = row.locator('[data-option="modified"]');
		assert.ok(!(await menu.isVisible()));
		await gear.click();
		assert.ok(await menu.isVisible());
		assert.equal(await gear.getAttribute('aria-expanded'), 'true');
		assert.equal(await modified.getAttribute('aria-checked'), 'false');
		await modified.click();
		assert.ok(!(await menu.isVisible()), 'menu closes after a pick');
		assert.equal(await modified.getAttribute('aria-checked'), 'true');
		await gear.click();
		await key(page, 'Escape');
		assert.ok(!(await menu.isVisible()));
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
		assert.equal(await pinnedRow.locator('xpath=ancestor::ue-segmented-control').count(), 0);
		await pinnedRow.locator('.SegmentedControl-seg').nth(0).click();
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

test('AssetPicker: the list sets the label and thumbnail, buttons react, reset restores', async () => {
	await inPreview('AssetPicker', async (page) => {
		const root = page.locator('ue-asset-picker');
		const combo = root.locator('.AssetPicker-combo');
		const menu = root.locator('.AssetPicker-menu');
		const label = root.locator('.AssetPicker-combo .label');
		const reset = root.locator('.AssetPicker-reset');
		const thumb = root.locator('.AssetPicker-thumbFrame');
		const option = (name: string): Locator => root.locator('.AssetPicker-menuItem[data-asset="' + name + '"]');

		assert.equal(await trimmed(label), 'SM_Chair');
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

		await combo.focus();
		await key(page, 'ArrowDown');
		assert.ok(await menu.isVisible());
		await key(page, 'ArrowDown');
		await key(page, 'Enter');
		assert.equal(await trimmed(label), 'SM_Lamp');
		assert.equal(await activeClass(page), 'AssetPicker-combo', 'focus returns to the combo');

		const use = root.locator('[data-role="use"]');
		await use.hover();
		assert.equal(await bgOf(use), rgb('dropdown'));
		await use.click();
		assert.equal(await trimmed(label), 'SM_Table');

		assert.equal(await visibilityOf(reset), 'visible');
		await reset.click();
		assert.equal(await trimmed(label), 'None');
		assert.equal(await visibilityOf(reset), 'hidden');
		assert.equal(await thumb.getAttribute('title'), 'None');

		await combo.click();
		await page.mouse.click(910, 710);
		assert.ok(!(await menu.isVisible()), 'an outside click closes the list');
	});
});

test('VectorInput: dragging changes a value and shows reset, reset restores, typing and keys work', async () => {
	await inPreview('VectorInput', async (page) => {
		const scale = page.locator('ue-vector-input .VectorInput-row').nth(2);
		const fields = scale.locator('.VectorInput-field');
		const reset = scale.locator('.VectorInput-reset');
		const shown = (i: number): Promise<string> => trimmed(fields.nth(i).locator('.VectorInput-value-text'));

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
		assert.ok(!(await fields.nth(0).evaluate((el) => el.classList.contains('is-active'))), 'active outline ends with the drag');

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
		assert.ok(await fields.nth(1).evaluate((el) => el.classList.contains('is-editing')));
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
		assert.equal(await dataValue(fields.nth(2)), 1.0025);
		await key(page, 'ArrowDown');
		await key(page, 'ArrowDown');
		assert.equal(await dataValue(fields.nth(2)), 0.9975);
	});
});

test('VectorInput: the scale lock links the axes, the label menu opens, units survive an edit', async () => {
	await inPreview('VectorInput', async (page) => {
		const rows = page.locator('ue-vector-input .VectorInput-row');
		const fields = rows.nth(2).locator('.VectorInput-field');
		const lock = rows.nth(2).locator('.VectorInput-lock');

		await lock.click();
		assert.equal(await lock.getAttribute('aria-pressed'), 'true');
		assert.equal(await lock.locator('use').getAttribute('href'), '#VectorInput-locked');
		await fields.nth(0).click();
		await typeIn(page, '2');
		await key(page, 'Enter');
		assert.deepEqual(await triple(fields), [2, 2, 2]);

		await fields.nth(1).focus();
		await key(page, 'ArrowUp');
		const [x, , z] = await triple(fields);
		assert.ok(Math.abs(x - 2.0025) < 1e-6 && Math.abs(z - 2.0025) < 1e-6, 'stepping Y moves X and Z by the same ratio');

		await lock.click();
		assert.equal(await lock.locator('use').getAttribute('href'), '#VectorInput-unlock');
		await fields.nth(0).click();
		await typeIn(page, '3');
		await key(page, 'Enter');
		assert.equal(await dataValue(fields.nth(0)), 3);
		assert.ok((await dataValue(fields.nth(1))) < 3, 'unlocked axes move alone');

		const menu = rows.nth(0).locator('.VectorInput-menu');
		assert.ok(!(await menu.isVisible()));
		await rows.nth(0).locator('.VectorInput-combo').click();
		assert.ok(await menu.isVisible());
		assert.equal(await trimmed(menu.locator('.VectorInput-menuHead')), 'Location Type');
		await menu.locator('.VectorInput-menuItem', { hasText: 'World' }).click();
		assert.ok(!(await menu.isVisible()));
		assert.equal(await menu.locator('.VectorInput-menuItem', { hasText: 'World' }).getAttribute('aria-checked'), 'true');
		assert.equal(await menu.locator('.VectorInput-menuItem', { hasText: 'Relative' }).getAttribute('aria-checked'), 'false');

		const yaw = rows.nth(1).locator('.VectorInput-field').nth(2);
		await yaw.click();
		await replaceText(page, '90');
		await key(page, 'Enter');
		assert.equal(await trimmed(yaw.locator('.VectorInput-value-text')), '90.0 °');
	});
});

test('DetailsCategory: headers fold their rows, row arrows fold children, checkbox and text edit work', async () => {
	await inPreview('DetailsCategory', async (page) => {
		const frame = page.locator('ue-details-category').nth(0);
		const header = frame.locator('.DetailsCategory-catRow').nth(0);
		const rowOf = (name: string): Locator => frame.locator('.DetailsCategory-row').filter({ has: page.locator('.DetailsCategory-label', { hasText: new RegExp('^' + name + '$') }) });

		assert.ok(await rowOf('Visible').isVisible());
		assert.ok(!(await rowOf('Static Mesh').isVisible()), 'Static Mesh rows start folded');
		await header.hover();
		assert.equal(await colorOf(header.locator('.DetailsCategory-arrow')), await computedColor(page, 'color-mix(in srgb, var(--foreground-hover) 60%, transparent)'));

		await header.click();
		assert.equal(await header.getAttribute('aria-expanded'), 'false');
		assert.equal(await header.locator('use').getAttribute('href'), '#DetailsCategory-right');
		for (const name of ['Visible', 'Actor Label', 'Collision Preset', 'Lighting', 'Cast Shadow']) assert.ok(!(await rowOf(name).isVisible()), name + ' folded');
		await header.press('ArrowRight');
		assert.equal(await header.locator('use').getAttribute('href'), '#DetailsCategory-down');
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

		const check = rowOf('Visible').locator('.DetailsCategory-check');
		assert.equal(await check.getAttribute('aria-checked'), 'true');
		await check.click();
		assert.equal(await check.getAttribute('aria-checked'), 'false');
		assert.equal(await visibilityOf(check.locator('svg')), 'hidden');
		await check.press('Space');
		assert.equal(await check.getAttribute('aria-checked'), 'true');

		const field = rowOf('Actor Label').locator('.DetailsCategory-text');
		const reset = rowOf('Actor Label').locator('.DetailsCategory-reset');
		await field.click();
		assert.ok((await shadowOf(field)).includes(rgb('primary')));
		await replaceText(page, 'Table');
		await key(page, 'Enter');
		assert.equal(await trimmed(field), 'Table');
		await field.click();
		await replaceText(page, 'Junk');
		await key(page, 'Escape');
		assert.equal(await trimmed(field), 'Table');
		await reset.click();
		assert.equal(await trimmed(field), 'StaticMeshActor_0');
		assert.equal(await visibilityOf(reset), 'hidden');

		assert.ok(!(await rowOf('Render in Main Pass').isVisible()));
		await frame.locator('.DetailsCategory-advRow').click();
		assert.ok(await rowOf('Render in Main Pass').isVisible());
		await frame.locator('.DetailsCategory-catRow').nth(1).click();
		assert.ok(await frame.locator('.DetailsCategory-row', { hasText: 'SM_Chair' }).isVisible());

		const pinned = page.locator('.DetailsCategory-frame').last();
		assert.equal(await pinned.locator('xpath=ancestor::ue-details-category').count(), 0);
		assert.ok(await pinned.locator('.DetailsCategory-row.is-hover').isVisible());
	});
});

test('DetailsCategory: the live details panel filters rows by search and section', async () => {
	await inPreview('DetailsCategory', async (page) => {
		const panel = page.locator('.DetailsCategory-panel');
		const input = panel.locator('.DetailsCategory-srInput');
		const shown = (): Promise<string[]> => panel.locator('.DetailsCategory-row').evaluateAll((rows) => rows.filter((row) => (row as HTMLElement).offsetParent !== null).map((row) => (row.querySelector('.DetailsCategory-label')?.textContent ?? '').trim()));
		const cats = (): Promise<string[]> => panel.locator('.DetailsCategory-cat').evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => (el.querySelector('.DetailsCategory-title')?.textContent ?? '').trim()));
		const pill = (label: string): Locator => panel.locator('.DetailsCategory-pill', { hasText: new RegExp('^' + label + '$') });
		const option = async (name: string): Promise<void> => {
			await panel.locator('[data-role="options"]').click();
			await panel.locator('[data-option="' + name + '"]').click();
		};

		assert.deepEqual(await cats(), ['General', 'Rendering']);
		assert.equal((await shown()).length, 7);

		await input.click();
		await typeIn(page, 'shadow');
		assert.deepEqual(await shown(), ['Lighting', 'Cast Shadow'], 'the parent row stays with its matching child');
		assert.deepEqual(await cats(), ['Rendering'], 'a category with no match hides');
		assert.ok(await panel.locator('.DetailsCategory-srClear').isVisible());
		await key(page, 'Escape');
		assert.equal(await input.inputValue(), '');
		assert.equal((await shown()).length, 7);

		await typeIn(page, 'zzz');
		assert.deepEqual(await shown(), []);
		assert.ok(await panel.locator('.DetailsCategory-empty').isVisible(), 'empty message');
		await panel.locator('.DetailsCategory-srClear').click();
		assert.ok(!(await panel.locator('.DetailsCategory-empty').isVisible()));

		await pill('General').click();
		assert.deepEqual(await cats(), ['General']);
		assert.equal(await panel.locator('.DetailsCategory-pill.is-checked').count(), 1);
		await pill('Physics').click();
		assert.deepEqual(await cats(), []);
		assert.ok(await panel.locator('.DetailsCategory-empty').isVisible());
		await pill('Rendering').click();
		assert.deepEqual(await cats(), ['Rendering']);
		await input.click();
		await typeIn(page, 'tags');
		assert.deepEqual(await shown(), [], 'search and section combine');
		await panel.locator('.DetailsCategory-srClear').click();
		await pill('All').click();

		await option('collapseAll');
		assert.deepEqual(await shown(), []);
		await option('expandAll');
		assert.equal((await shown()).length, 7);
		await option('modified');
		assert.deepEqual(await shown(), ['Actor Label', 'Tags'], 'only rows with a reset arrow');
		await option('modified');
		assert.equal((await shown()).length, 7);

		const star = panel.locator('[data-role="favorites"]');
		await star.click();
		assert.equal(await star.getAttribute('aria-pressed'), 'true');
		const lock = panel.locator('[data-role="lock"]');
		await lock.click();
		assert.equal(await lock.locator('use').getAttribute('href'), '#DetailsCategory-locked');
		const name = panel.locator('.DetailsCategory-hdrName');
		await name.click();
		await replaceText(page, 'Bench');
		await key(page, 'Enter');
		assert.equal(await trimmed(name), 'Bench');
	});
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
