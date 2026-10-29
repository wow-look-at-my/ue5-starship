/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locator, Page } from 'playwright';
import { openPreview, withBrowser } from './lib.ts';
import { assertInert, clickAt, hoverAt } from './pinned.ts';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

// Computes a CSS value the way the page does, so a test compares against a token and not a hand-copied rgb string.
function resolve(page: Page, property: 'background-color' | 'color', value: string): Promise<string> {
	return page.evaluate(([prop, css]) => {
		const probe = document.createElement('div');
		probe.style.setProperty(prop, css);
		document.body.append(probe);
		const computed = getComputedStyle(probe).getPropertyValue(prop);
		probe.remove();
		return computed;
	}, [property, value] as [string, string]);
}

const bg = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).backgroundColor);
const fg = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).color);
const visibility = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).visibility);
const lineContent = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el, '::before').content);
const classes = (target: Locator): Promise<string[]> => target.evaluate((el) => Array.from(el.classList));
const focusedTab = (page: Page): Promise<string | undefined> => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.tab);
const names = (tabs: Locator): Promise<string[]> => tabs.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.tab ?? ''));

// ---------- DockTab ----------

test('DockTab: hover shows the hovered fill, the hovered text colour and the close button', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const outliner = page.locator('ue-dock-tab').nth(0).locator('.dockTab[data-tab="outliner"]');
		const close = outliner.locator('.dockTab-close');
		assert.equal(await bg(outliner), TRANSPARENT);
		assert.equal(await visibility(close), 'hidden');
		await outliner.hover();
		const hoveredFill = await resolve(page, 'background-color', 'color-mix(in srgb, var(--panel) 80%, transparent)');
		assert.equal(await bg(outliner), hoveredFill);
		assert.equal(await bg(page.locator('.dockTab--hovered[data-pinned]').first()), hoveredFill, 'live hover equals the pinned hovered specimen');
		assert.equal(await fg(outliner), await resolve(page, 'color', 'var(--foreground-hover)'));
		assert.equal(await visibility(close), 'visible');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: the close button shows its hovered and pressed colours', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const details = page.locator('ue-dock-tab').nth(0).locator('.dockTab[data-tab="details"]');
		const close = details.locator('.dockTab-close');
		assert.equal(await fg(close), await resolve(page, 'color', 'var(--foreground)'));
		await close.hover();
		assert.equal(await fg(close), await resolve(page, 'color', 'var(--foreground-hover)'));
		await page.mouse.down();
		assert.equal(await fg(close), await resolve(page, 'color', 'var(--foreground)'), 'pressed keeps the Foreground tint');
		await page.mouse.move(2, 2);
		await page.mouse.up();
		assert.equal(await details.count(), 1, 'releasing outside the button does not close the tab');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: clicking a tab makes it the foreground tab and swaps the panel', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const stack = page.locator('ue-dock-tab').nth(0);
		const tab = (name: string): Locator => stack.locator('.dockTab[data-tab="' + name + '"]');
		const panel = (name: string): Locator => stack.locator('[data-panel="' + name + '"]');
		assert.ok(await panel('details').isVisible());
		assert.ok(await panel('content').isHidden());

		await tab('content').click();
		assert.ok((await classes(tab('content'))).includes('dockTab--foreground'));
		assert.ok(!(await classes(tab('details'))).includes('dockTab--foreground'));
		assert.equal(await tab('content').getAttribute('aria-selected'), 'true');
		assert.equal(await tab('details').getAttribute('aria-selected'), 'false');
		assert.equal(await tab('content').getAttribute('tabindex'), '0');
		assert.equal(await tab('details').getAttribute('tabindex'), '-1');
		assert.ok(await panel('content').isVisible());
		assert.ok(await panel('details').isHidden());
		assert.match(await panel('content').innerText(), /Content Browser panel/);
		assert.equal(await bg(tab('content')), await resolve(page, 'background-color', 'var(--panel)'));
		assert.equal(await bg(tab('details')), TRANSPARENT);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: the active state moves between stacks and shows the primary line only on a minor tab', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const left = page.locator('ue-dock-tab').nth(0).locator('.dockTab[data-tab="details"]');
		const right = page.locator('ue-dock-tab').nth(1).locator('.dockTab[data-tab="layers"]');
		const major = page.locator('ue-dock-tab').nth(2).locator('.dockTab[data-tab="level2"]');
		const pinnedActive = page.locator('.dockTab--active[data-pinned]').first();
		assert.ok((await classes(left)).includes('dockTab--active'));
		assert.notEqual(await lineContent(left), 'none');

		await right.click();
		assert.ok((await classes(right)).includes('dockTab--active'));
		assert.ok(!(await classes(left)).includes('dockTab--active'), 'the left stack lost the active state');
		assert.notEqual(await lineContent(right), 'none');
		assert.equal(await fg(right), await resolve(page, 'color', 'var(--foreground-hover)'));

		await major.click();
		assert.ok((await classes(major)).includes('dockTab--active'));
		assert.equal(await lineContent(major), 'none', 'a major tab never shows the active line');
		assert.equal(await fg(major), await resolve(page, 'color', 'var(--white)'));
		assert.ok((await classes(pinnedActive)).includes('dockTab--active'), 'the pinned specimen keeps its forced state');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: closing the foreground tab selects its left neighbour, and the last close leaves an empty well', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const stack = page.locator('ue-dock-tab').nth(0);
		const tabs = stack.locator('.dockTab-well > .dockTab');
		const tab = (name: string): Locator => stack.locator('.dockTab[data-tab="' + name + '"]');

		await tab('content').click();
		await tab('content').locator('.dockTab-close').click();
		assert.deepEqual(await names(tabs), ['details', 'outliner']);
		assert.ok((await classes(tab('outliner'))).includes('dockTab--foreground'), 'the left neighbour takes over');
		assert.ok((await classes(tab('outliner'))).includes('dockTab--active'), 'and keeps the active state');
		assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
		assert.equal(await stack.locator('[data-panel="content"]').count(), 0, 'the panel left with its tab');

		await tab('details').hover();
		await tab('details').locator('.dockTab-close').click();
		assert.deepEqual(await names(tabs), ['outliner'], 'closing a background tab keeps the foreground tab');
		assert.ok((await classes(tab('outliner'))).includes('dockTab--foreground'));

		await tab('outliner').locator('.dockTab-close').click();
		assert.equal(await tabs.count(), 0);
		const well = stack.locator('.dockTab-well');
		assert.ok((await well.boundingBox())!.height >= 33, 'the empty well keeps its height');
		assert.equal(await stack.locator('[data-panel]').count(), 0);

		await stack.locator('.dockTab-reset').click();
		assert.deepEqual(await names(tabs), ['details', 'outliner', 'content'], 'Restore tabs brings the tabs back');
		assert.ok((await classes(tab('details'))).includes('dockTab--foreground'));
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: a middle click closes a tab', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const stack = page.locator('ue-dock-tab').nth(1);
		await stack.locator('.dockTab[data-tab="layers"]').click({ button: 'middle' });
		assert.deepEqual(await names(stack.locator('.dockTab-well > .dockTab')), ['place']);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: arrow keys, Home, End, Enter and Delete work on a focused tab', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const stack = page.locator('ue-dock-tab').nth(0);
		const tab = (name: string): Locator => stack.locator('.dockTab[data-tab="' + name + '"]');
		await tab('details').focus();
		await page.keyboard.press('ArrowRight');
		assert.equal(await focusedTab(page), 'outliner');
		assert.ok((await classes(tab('outliner'))).includes('dockTab--foreground'));
		assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
		await page.keyboard.press('End');
		assert.equal(await focusedTab(page), 'content');
		await page.keyboard.press('ArrowRight');
		assert.equal(await focusedTab(page), 'details', 'arrow keys wrap around');
		await page.keyboard.press('ArrowLeft');
		assert.equal(await focusedTab(page), 'content');
		await page.keyboard.press('Home');
		assert.equal(await focusedTab(page), 'details');
		assert.ok(await tab('details').evaluate((el) => getComputedStyle(el).outlineStyle !== 'none'), 'a focused tab shows a focus ring');
		await page.keyboard.press('Delete');
		assert.deepEqual(await names(stack.locator('.dockTab-well > .dockTab')), ['outliner', 'content']);
		assert.ok((await classes(tab('outliner'))).includes('dockTab--foreground'));
		assert.equal(await focusedTab(page), 'outliner', 'focus follows to the new foreground tab');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: the major stack switches tabs and panels like the minor one', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const stack = page.locator('ue-dock-tab').nth(2);
		const second = stack.locator('.dockTab[data-tab="level2"]');
		await second.hover();
		assert.equal(await bg(second), await resolve(page, 'background-color', 'color-mix(in srgb, var(--panel) 80%, transparent)'));
		await second.click();
		assert.ok((await classes(second)).includes('dockTab--foreground'));
		assert.match(await stack.locator('[data-panel="level2"]').innerText(), /Second_Level/);
		assert.ok(await stack.locator('[data-panel="level1"]').isHidden());
		await second.locator('.dockTab-close').click();
		assert.ok((await classes(stack.locator('.dockTab[data-tab="level1"]'))).includes('dockTab--foreground'));
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('DockTab: pinned specimens ignore the pointer', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const normal = page.locator('.dockTab[data-pinned]').first();
		const before = await classes(normal);
		await assertInert(normal);
		await hoverAt(page, normal);
		assert.equal(await bg(normal), TRANSPARENT);
		assert.equal(await visibility(normal.locator('.dockTab-close')), 'hidden');
		await clickAt(page, normal);
		assert.deepEqual(await classes(normal), before);
		assert.equal(await page.locator('ue-dock-tab').count(), 3);
		assert.equal(await page.locator('use').count(), 0, 'no glyph of the preview refers to a symbol');
		assert.equal(await page.locator('[data-pinned] ue-dock-tab, ue-dock-tab [data-pinned]').count(), 0);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

// Records the detail of every event of these names that reaches the document, in order, each with its name.
async function watchEvents(page: Page, ...names: string[]): Promise<void> {
	await page.evaluate((types) => {
		const log: Array<{ type: string; detail: unknown }> = [];
		(window as unknown as { __events: typeof log }).__events = log;
		for (const type of types) document.addEventListener(type, (event) => log.push({ type, detail: (event as CustomEvent).detail }));
	}, names);
}

const recordedEvents = (page: Page): Promise<Array<{ type: string; detail: unknown }>> => page.evaluate(() => (window as unknown as { __events: Array<{ type: string; detail: unknown }> }).__events.slice());

for (const [tag, tabClass, closeClass, stackIndex] of [['ue-dock-tab', 'dockTab', 'dockTab-close', 0], ['ue-tab-well', 'tabWell-tab', 'tabWell-close', 0]] as const) {
	test(tag + ': ue-tab-activate and ue-tab-close report the tab, and the API activates and closes by id', async () => {
		await withBrowser(async (browser) => {
			const { page, errors } = await openPreview(browser, tag === 'ue-dock-tab' ? 'DockTab' : 'TabWell');
			const stack = page.locator(tag).nth(stackIndex);
			const tab = (id: string): Locator => stack.locator('.' + tabClass + '[data-tab="' + id + '"]');
			await watchEvents(page, 'ue-tab-activate', 'ue-tab-close');
			await tab('content').click();
			await tab('content').click();
			assert.deepEqual(await recordedEvents(page), [{ type: 'ue-tab-activate', detail: { id: 'content', label: 'Content Browser' } }], 'a second click on the foreground tab changes nothing');
			await tab('content').locator('.' + closeClass).click();
			assert.deepEqual((await recordedEvents(page)).slice(1), [
				{ type: 'ue-tab-close', detail: { id: 'content', label: 'Content Browser' } },
				{ type: 'ue-tab-activate', detail: { id: 'outliner', label: 'Outliner' } },
			], 'the close comes first, then the left neighbour takes over');
			await stack.evaluate((el, id) => (el as HTMLElement & { activateTab(id: string): void }).activateTab(id), 'details');
			assert.ok((await classes(tab('details'))).includes(tabClass + '--foreground'));
			assert.ok(await stack.locator('[data-panel="details"]').isVisible());
			await stack.evaluate((el, id) => (el as HTMLElement & { closeTab(id: string): void }).closeTab(id), 'outliner');
			assert.deepEqual(await names(stack.locator('.' + tabClass)), ['details']);
			const last = (await recordedEvents(page)).at(-1);
			assert.deepEqual(last?.type, 'ue-tab-close');
			assert.deepEqual(errors, []);
			await page.close();
		});
	});
}

test('DockTab: the status line under a stack shows its own events only', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'DockTab');
		const first = page.locator('ue-dock-tab').nth(0);
		const second = page.locator('ue-dock-tab').nth(1);
		await first.locator('.dockTab[data-tab="content"]').click();
		await first.locator('.dockTab[data-tab="content"] .dockTab-close').click();
		assert.equal(await first.locator('ue-event-status').textContent(), 'Closed: Content Browser (content)');
		await second.locator('.dockTab[data-tab="layers"]').click();
		assert.equal(await second.locator('ue-event-status').textContent(), 'Activated: Layers (layers)');
		assert.equal(await first.locator('ue-event-status').textContent(), 'Closed: Content Browser (content)', 'the first stack did not hear the second');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

// ---------- TabWell ----------

test('TabWell: hover, click and the content swap work in the minor stack', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'TabWell');
		const stack = page.locator('ue-tab-well').nth(0);
		const tab = (name: string): Locator => stack.locator('.tabWell-tab[data-tab="' + name + '"]');
		const outliner = tab('outliner');
		assert.equal(await bg(outliner), TRANSPARENT);
		await outliner.hover();
		assert.equal(await bg(outliner), await resolve(page, 'background-color', 'color-mix(in srgb, var(--panel) 80%, transparent)'));
		assert.equal(await visibility(outliner.locator('.tabWell-close')), 'visible');
		assert.equal(await fg(outliner), await resolve(page, 'color', 'var(--foreground-hover)'));

		await outliner.click();
		assert.ok((await classes(outliner)).includes('tabWell-tab--foreground'));
		assert.ok((await classes(outliner)).includes('tabWell-tab--active'));
		assert.ok(!(await classes(tab('details'))).includes('tabWell-tab--foreground'));
		assert.equal(await bg(outliner), await resolve(page, 'background-color', 'var(--panel)'));
		assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
		assert.ok(await stack.locator('[data-panel="details"]').isHidden());
		assert.match(await stack.locator('.tabWell-content').innerText(), /Outliner panel/);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('TabWell: close removes the tab, the left neighbour takes over, the last close leaves an empty well', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'TabWell');
		const stack = page.locator('ue-tab-well').nth(0);
		const tabs = stack.locator('.tabWell-well > .tabWell-tab');
		const tab = (name: string): Locator => stack.locator('.tabWell-tab[data-tab="' + name + '"]');
		await tab('content').click();
		await tab('content').locator('.tabWell-close').click();
		assert.deepEqual(await names(tabs), ['details', 'outliner']);
		assert.ok((await classes(tab('outliner'))).includes('tabWell-tab--foreground'));
		await tab('outliner').locator('.tabWell-close').click();
		assert.ok((await classes(tab('details'))).includes('tabWell-tab--foreground'));
		await tab('details').locator('.tabWell-close').click();
		assert.equal(await tabs.count(), 0);
		assert.ok((await stack.locator('.tabWell-well').boundingBox())!.height >= 25, 'the empty well keeps its height');
		await stack.locator('.tabWell-reset').click();
		assert.deepEqual(await names(tabs), ['details', 'outliner', 'content']);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('TabWell: the major stack works on its own and never shows the active line', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'TabWell');
		const minor = page.locator('ue-tab-well').nth(0);
		const major = page.locator('ue-tab-well').nth(1);
		const second = major.locator('.tabWell-tab[data-tab="level2"]');
		await second.click();
		assert.ok((await classes(second)).includes('tabWell-tab--foreground'));
		assert.ok((await classes(second)).includes('tabWell-tab--active'));
		assert.equal(await lineContent(second), 'none');
		assert.ok(!(await classes(minor.locator('.tabWell-tab[data-tab="details"]'))).includes('tabWell-tab--active'), 'the minor stack lost the active state');
		assert.ok(await major.locator('[data-panel="level2"]').isVisible());
		assert.equal(await bg(major.locator('.tabWell-content')), await resolve(page, 'background-color', 'var(--background)'));
		await minor.locator('.tabWell-tab[data-tab="outliner"]').click();
		assert.notEqual(await lineContent(minor.locator('.tabWell-tab[data-tab="outliner"]')), 'none');
		assert.ok(!(await classes(second)).includes('tabWell-tab--active'));
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('TabWell: keyboard moves between tabs and Delete closes', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'TabWell');
		const stack = page.locator('ue-tab-well').nth(0);
		await stack.locator('.tabWell-tab[data-tab="details"]').focus();
		await page.keyboard.press('ArrowRight');
		assert.equal(await focusedTab(page), 'outliner');
		assert.ok(await stack.locator('[data-panel="outliner"]').isVisible());
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		assert.equal(await focusedTab(page), 'content', 'wraps to the last tab');
		await page.keyboard.press('Home');
		assert.equal(await focusedTab(page), 'details');
		await page.keyboard.press('Delete');
		assert.deepEqual(await names(stack.locator('.tabWell-well > .tabWell-tab')), ['outliner', 'content']);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('TabWell: one major tab alone draws the title-bar tab with no element and no symbol', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'TabWell');
		const alone = page.locator('.tabWell-tab--major[data-pinned]');
		assert.equal(await alone.count(), 1);
		assert.equal(await alone.evaluate((el) => el.closest('ue-tab-well')), null);
		assert.equal(await page.locator('use').count(), 0, 'no glyph of the preview refers to a symbol');
		assert.equal(await bg(alone), await resolve(page, 'background-color', 'var(--panel)'));
		assert.equal(await fg(alone), await resolve(page, 'color', 'var(--white)'));
		assert.equal(await lineContent(alone), 'none', 'a major tab has no active line');
		const box = (await alone.boundingBox())!;
		assert.ok(Math.abs(box.height - 30.8) < 0.1, 'major tab height ' + box.height);
		assert.equal(await visibility(alone.locator('.tabWell-close')), 'visible', 'the foreground tab shows its close button');
		assert.equal(await alone.locator('.tabWell-icon svg').evaluate((el) => getComputedStyle(el).width), '16px');
		assert.equal(await alone.locator('.tabWell-icon').evaluate((el) => getComputedStyle(el).paddingLeft), '4px');
		const well = (await page.locator('.tabWell-well--major').filter({ has: alone }).boundingBox())!;
		assert.ok(well.height >= 30.7, 'the major well is as tall as the major tab: ' + well.height);
		assert.equal(await bg(page.locator('.tabWell-well--major').filter({ has: alone })), await resolve(page, 'background-color', 'var(--title)'));
		assert.deepEqual(errors, []);
		await page.close();
	});
});

// ---------- WindowChrome ----------

test('WindowChrome: the buttons show their hover fills and the pressed state drops the fill', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'WindowChrome');
		const frame = page.locator('.windowChrome-frame');
		const minimize = frame.locator('[data-action="minimize"]');
		const close = frame.locator('[data-action="close"]');
		assert.equal(await bg(minimize), TRANSPARENT);

		await minimize.hover();
		assert.equal(await bg(minimize), await resolve(page, 'background-color', 'rgba(255, 255, 255, 0.157)'));
		assert.equal(await fg(minimize), await resolve(page, 'color', 'var(--foreground-hover)'));
		assert.equal(await bg(page.locator('.windowChrome-btn--hover[data-pinned]').first()), await bg(minimize), 'live hover equals the pinned hover specimen');

		await close.hover();
		assert.equal(await bg(close), await resolve(page, 'background-color', 'rgba(255, 79, 79, 0.588)'));
		assert.equal(await bg(minimize), TRANSPARENT, 'the fill follows the pointer');
		await page.mouse.down();
		assert.equal(await bg(close), TRANSPARENT, 'pressed has no fill');
		assert.equal(await fg(close), await resolve(page, 'color', 'var(--foreground)'));
		await page.mouse.move(2, 2);
		await page.mouse.up();
		assert.ok(await frame.isVisible(), 'releasing outside the button does not close the window');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('WindowChrome: maximize toggles to the restore glyph and back', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'WindowChrome');
		const frame = page.locator('.windowChrome-frame');
		const maximize = frame.locator('[data-action="maximize"]');
		const glyph = maximize.locator('use');
		assert.equal(await glyph.getAttribute('href'), '#windowChrome-i-max');
		assert.equal(await maximize.getAttribute('aria-label'), 'Maximize');
		await maximize.click();
		assert.equal(await glyph.getAttribute('href'), '#windowChrome-i-restore');
		assert.equal(await maximize.getAttribute('aria-label'), 'Restore Down');
		assert.equal(await frame.getAttribute('data-maximized'), '');
		await maximize.click();
		assert.equal(await glyph.getAttribute('href'), '#windowChrome-i-max');
		assert.equal(await frame.getAttribute('data-maximized'), null);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('WindowChrome: minimize and close hide the window and the restore button brings it back', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'WindowChrome');
		const frame = page.locator('.windowChrome-frame');
		const reopen = page.locator('.windowChrome-reopen');
		assert.ok(await reopen.isHidden());
		await frame.locator('[data-action="close"]').click();
		assert.ok(await frame.isHidden());
		assert.ok(await reopen.isVisible());
		await reopen.click();
		assert.ok(await frame.isVisible());
		assert.ok(await reopen.isHidden());
		await frame.locator('[data-action="minimize"]').click();
		assert.ok(await frame.isHidden());
		await page.keyboard.press('Enter');
		assert.ok(await frame.isVisible(), 'the restore button is keyboard operable');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('WindowChrome: the window state follows focus', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'WindowChrome');
		const frame = page.locator('.windowChrome-frame');
		const status = page.locator('.windowChrome-status');
		assert.equal(await frame.getAttribute('data-active'), 'false');
		assert.equal(await status.innerText(), 'Window inactive');
		await page.locator('.windowChrome-content').click();
		assert.equal(await frame.getAttribute('data-active'), 'true');
		assert.equal(await status.innerText(), 'Window active');
		await frame.locator('[data-action="maximize"]').focus();
		assert.equal(await frame.getAttribute('data-active'), 'true', 'focus moving inside the window keeps it active');
		await page.mouse.click(900, 700);
		assert.equal(await frame.getAttribute('data-active'), 'false');
		assert.equal(await status.innerText(), 'Window inactive');
		await page.keyboard.press('Tab');
		assert.equal(await frame.getAttribute('data-active'), 'true', 'tabbing into the window activates it');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('WindowChrome: pinned button specimens ignore the pointer', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'WindowChrome');
		const pinned = page.locator('.windowChrome-states .windowChrome-btn--close').first();
		await hoverAt(page, pinned);
		assert.equal(await bg(pinned), TRANSPARENT);
		assert.equal(await page.locator('ue-window-chrome').count(), 1);
		assert.equal(await page.locator('[data-pinned] ue-window-chrome, ue-window-chrome [data-pinned]').count(), 0);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

// ---------- Splitter ----------

interface Sizes { before: number; after: number }

async function sizes(demo: Locator, axis: 'width' | 'height'): Promise<Sizes> {
	const panes = demo.locator('.splitter-pane');
	const first = await panes.nth(0).boundingBox();
	const second = await panes.nth(1).boundingBox();
	return { before: first![axis], after: second![axis] };
}

async function dragHandle(page: Page, handle: Locator, dx: number, dy: number, release = true): Promise<void> {
	const box = (await handle.boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
	await page.mouse.move(x + dx, y + dy, { steps: 4 });
	if (release) await page.mouse.up();
}

test('Splitter: hover shows the secondary fill and the resize cursor', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const row = page.locator('ue-splitter').nth(0).locator('.splitter-handle');
		const col = page.locator('ue-splitter').nth(1).locator('.splitter-handle');
		assert.equal(await bg(row), await resolve(page, 'background-color', 'var(--background)'));
		assert.equal(await row.evaluate((el) => getComputedStyle(el).cursor), 'col-resize');
		assert.equal(await col.evaluate((el) => getComputedStyle(el).cursor), 'row-resize');
		await row.hover();
		assert.equal(await bg(row), await resolve(page, 'background-color', 'var(--secondary)'));
		assert.equal(await bg(page.locator('.splitter-handle--highlight[data-pinned]').first()), await bg(row), 'live hover equals the pinned highlight');
		await page.mouse.move(2, 2);
		assert.equal(await bg(row), await resolve(page, 'background-color', 'var(--background)'));
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: dragging the horizontal handle resizes both panes and holds the pressed colour', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const demo = page.locator('ue-splitter').nth(0).locator('.splitter');
		const handle = demo.locator('.splitter-handle');
		const start = await sizes(demo, 'width');
		await dragHandle(page, handle, 40, 0, false);
		assert.ok((await classes(handle)).includes('splitter-handle--highlight'), 'dragging keeps the highlight');
		assert.equal(await bg(handle), await resolve(page, 'background-color', 'var(--secondary)'));
		await page.mouse.up();
		const end = await sizes(demo, 'width');
		assert.ok(Math.abs(end.before - (start.before + 40)) <= 1, 'the first pane grew by the drag distance: ' + start.before + ' to ' + end.before);
		assert.ok(Math.abs(end.after - (start.after - 40)) <= 1, 'the second pane shrank by the same distance');
		assert.ok(Math.abs(end.before + end.after - (start.before + start.after)) <= 1, 'the panes still fill the same space');
		assert.ok(!(await classes(handle)).includes('splitter-handle--highlight'), 'the highlight class leaves with the drag');
		await page.mouse.move(2, 2);
		assert.equal(await bg(handle), await resolve(page, 'background-color', 'var(--background)'));
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: no pane shrinks below the minimum size', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const demo = page.locator('ue-splitter').nth(0).locator('.splitter');
		const handle = demo.locator('.splitter-handle');
		const start = await sizes(demo, 'width');
		const total = start.before + start.after;
		await dragHandle(page, handle, 3000, 0);
		let end = await sizes(demo, 'width');
		assert.ok(Math.abs(end.after - 20) <= 1, 'the second pane stops at 20 but is ' + end.after);
		assert.ok(Math.abs(end.before - (total - 20)) <= 1);
		await dragHandle(page, handle, -3000, 0);
		end = await sizes(demo, 'width');
		assert.ok(Math.abs(end.before - 20) <= 1, 'the first pane stops at 20 but is ' + end.before);
		assert.ok(Math.abs(end.after - (total - 20)) <= 1);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: dragging the vertical handle resizes the pane heights', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const demo = page.locator('ue-splitter').nth(1).locator('.splitter');
		const handle = demo.locator('.splitter-handle');
		const start = await sizes(demo, 'height');
		await dragHandle(page, handle, 0, -30);
		const end = await sizes(demo, 'height');
		assert.ok(Math.abs(end.before - (start.before - 30)) <= 1, 'the top pane shrank by the drag distance');
		assert.ok(Math.abs(end.after - (start.after + 30)) <= 1);
		const widths = await sizes(demo, 'width');
		assert.equal(widths.before, widths.after, 'a vertical drag leaves the widths alone');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: arrow keys move a focused handle by a few pixels', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const demo = page.locator('ue-splitter').nth(0).locator('.splitter');
		const handle = demo.locator('.splitter-handle');
		const start = await sizes(demo, 'width');
		await handle.focus();
		assert.equal(await bg(handle), await resolve(page, 'background-color', 'var(--secondary)'), 'keyboard focus shows the highlight');
		await page.keyboard.press('ArrowRight');
		let now = await sizes(demo, 'width');
		assert.ok(Math.abs(now.before - (start.before + 5)) <= 0.5, 'ArrowRight grows the first pane by 5');
		await page.keyboard.press('Shift+ArrowRight');
		now = await sizes(demo, 'width');
		assert.ok(Math.abs(now.before - (start.before + 25)) <= 0.5, 'Shift+ArrowRight grows it by 20 more');
		await page.keyboard.press('ArrowLeft');
		now = await sizes(demo, 'width');
		assert.ok(Math.abs(now.before - (start.before + 20)) <= 0.5);
		assert.equal(await handle.getAttribute('aria-valuenow'), String(Math.round(now.before)));
		await page.keyboard.press('ArrowDown');
		const unchanged = await sizes(demo, 'width');
		assert.equal(unchanged.before, now.before, 'a horizontal handle ignores the vertical arrows');
		await page.keyboard.press('Home');
		assert.ok(Math.abs((await sizes(demo, 'width')).before - 20) <= 0.5);
		await page.keyboard.press('End');
		assert.ok(Math.abs((await sizes(demo, 'width')).after - 20) <= 0.5);
		assert.equal(await handle.getAttribute('aria-valuemin'), '20');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: the vertical handle answers the up and down arrows', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const demo = page.locator('ue-splitter').nth(1).locator('.splitter');
		const handle = demo.locator('.splitter-handle');
		const start = await sizes(demo, 'height');
		await handle.focus();
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('ArrowDown');
		assert.ok(Math.abs((await sizes(demo, 'height')).before - (start.before + 10)) <= 0.5);
		await page.keyboard.press('ArrowUp');
		assert.ok(Math.abs((await sizes(demo, 'height')).before - (start.before + 5)) <= 0.5);
		await page.keyboard.press('ArrowRight');
		assert.ok(Math.abs((await sizes(demo, 'height')).before - (start.before + 5)) <= 0.5, 'a vertical handle ignores the horizontal arrows');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: data-min-start and data-min-end set the limits, the key steps and the aria values', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const demo = page.locator('ue-splitter').nth(2).locator('.splitter');
		const handle = demo.locator('.splitter-handle');
		const start = await sizes(demo, 'width');
		const total = start.before + start.after;
		await dragHandle(page, handle, 3000, 0);
		let end = await sizes(demo, 'width');
		assert.ok(Math.abs(end.after - 150) <= 1, 'the end pane stops at its own minimum: ' + end.after);
		await dragHandle(page, handle, -3000, 0);
		end = await sizes(demo, 'width');
		assert.ok(Math.abs(end.before - 120) <= 1, 'the start pane stops at its own minimum: ' + end.before);
		assert.equal(await handle.getAttribute('aria-valuemin'), '120');
		assert.equal(await handle.getAttribute('aria-valuemax'), String(Math.round(total - 150)));
		assert.equal(await handle.getAttribute('aria-valuenow'), String(Math.round(end.before)));
		await handle.focus();
		await page.keyboard.press('Shift+ArrowRight');
		assert.ok(Math.abs((await sizes(demo, 'width')).before - (end.before + 40)) <= 0.5, 'data-step-shift');
		await page.keyboard.press('ArrowLeft');
		assert.ok(Math.abs((await sizes(demo, 'width')).before - (end.before + 30)) <= 0.5, 'data-step');
		await page.keyboard.press('End');
		assert.ok(Math.abs((await sizes(demo, 'width')).after - 150) <= 0.5);
		await page.keyboard.press('Home');
		assert.ok(Math.abs((await sizes(demo, 'width')).before - 120) <= 0.5);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: ue-splitter-resize reports the size, the total and the orientation, and splitters are independent', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const first = page.locator('ue-splitter').nth(0).locator('.splitter');
		const second = page.locator('ue-splitter').nth(1).locator('.splitter');
		await page.evaluate(() => {
			const log: unknown[] = [];
			(window as unknown as { __resize: unknown[] }).__resize = log;
			document.addEventListener('ue-splitter-resize', (event) => log.push((event as CustomEvent).detail));
		});
		const before = await sizes(second, 'height');
		const start = await sizes(first, 'width');
		await first.locator('.splitter-handle').focus();
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Home');
		const log = await page.evaluate(() => (window as unknown as { __resize: Array<{ size: number; total: number; orientation: string }> }).__resize);
		assert.equal(log.length, 2);
		assert.equal(log[0].orientation, 'horizontal');
		assert.ok(Math.abs(log[0].size - (start.before + 5)) <= 0.5);
		assert.ok(Math.abs(log[0].total - (start.before + start.after)) <= 0.5);
		assert.equal(log[1].size, 20);
		assert.match((await page.locator('.splitter-cell').nth(0).textContent()) ?? '', /size 20 of /);
		assert.deepEqual(await sizes(second, 'height'), before, 'the other splitter did not move');
		await second.locator('.splitter-handle').focus();
		await page.keyboard.press('ArrowDown');
		const vertical = await page.evaluate(() => (window as unknown as { __resize: Array<{ orientation: string }> }).__resize.at(-1)?.orientation);
		assert.equal(vertical, 'vertical');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: the line handle is 2px wide with a hit area 3px wider on each side', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const demo = page.locator('ue-splitter').nth(3).locator('.splitter');
		const handle = demo.locator('.splitter-handle');
		const box = (await handle.boundingBox())!;
		assert.equal(box.width, 2);
		const hit = await handle.evaluate((el) => {
			const style = getComputedStyle(el, '::before');
			return [style.left, style.right, style.top, style.bottom];
		});
		assert.deepEqual(hit, ['-3px', '-3px', '0px', '0px']);
		const start = await sizes(demo, 'width');
		await page.mouse.move(box.x - 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + 28, box.y + box.height / 2, { steps: 4 });
		await page.mouse.up();
		const end = await sizes(demo, 'width');
		assert.ok(Math.abs(end.before - (start.before + 30)) <= 1, 'a grab beside the line drags it: ' + start.before + ' to ' + end.before);
		await page.mouse.move(box.x + 40, box.y + box.height / 2);
		assert.equal(await handle.evaluate((el) => getComputedStyle(el).cursor), 'col-resize');
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('Splitter: pinned handles stay pinned', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Splitter');
		const pinned = page.locator('.splitter-handle[data-pinned]').first();
		const demo = page.locator('.splitter').filter({ has: pinned });
		const start = await sizes(demo, 'width');
		await assertInert(pinned);
		await hoverAt(page, pinned);
		assert.equal(await bg(pinned), await resolve(page, 'background-color', 'var(--background)'));
		await dragHandle(page, pinned, 30, 0);
		assert.deepEqual(await sizes(demo, 'width'), start);
		assert.equal(await page.locator('[data-pinned] ue-splitter, ue-splitter [data-pinned]').count(), 0);
		assert.deepEqual(errors, []);
		await page.close();
	});
});
