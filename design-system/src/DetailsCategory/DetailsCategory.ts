// <ue-details-category> wraps a category tree (and, in the live panel, the
// header, search row and pills above it).
import { UeElement, define } from '../_shared/element.ts';
import { wireMenu } from '../_shared/popupmenu.ts';

const DOWN = '#DetailsCategory-down';
const RIGHT = '#DetailsCategory-right';

interface Item {
	el: HTMLElement;
	kind: 'cat' | 'adv' | 'row';
	level: number;
	matchesText: boolean;
	isModified: boolean;
}

const isIn = (el: Element, selector: string): HTMLElement | null => el.closest<HTMLElement>(selector);

class UeDetailsCategory extends UeElement {
	protected setup(): void {
		const frame = this.one('.DetailsCategory-frame');
		if (!frame) return;
		this.wireFrame(frame);
		if (this.one('.DetailsCategory-panel')) this.wirePanel(frame);
		for (const row of this.all('.DetailsCategory-row')) this.syncReset(row);
		this.refresh(frame);
	}

	private query(): string {
		return (this.one<HTMLInputElement>('.DetailsCategory-srInput')?.value ?? '').trim().toLowerCase();
	}

	private section(): string {
		return this.one('.DetailsCategory-pill.is-checked')?.dataset.section ?? '';
	}

	private modifiedOnly(): boolean {
		return this.one('[data-option="modified"]')?.getAttribute('aria-checked') === 'true';
	}

	private wireFrame(frame: HTMLElement): void {
		this.on(frame, 'click', (event) => {
			const target = event.target as Element;
			const catRow = isIn(target, '.DetailsCategory-catRow');
			const advRow = isIn(target, '.DetailsCategory-advRow');
			const arrow = isIn(target, '.DetailsCategory-rowArrow.has-children');
			const check = isIn(target, '.DetailsCategory-check[role="checkbox"]');
			const reset = isIn(target, '.DetailsCategory-reset[role="button"]');
			if (catRow) catRow.closest('.DetailsCategory-cat')?.classList.toggle('is-collapsed');
			else if (advRow) advRow.closest('.DetailsCategory-adv')?.classList.toggle('is-open');
			else if (arrow) arrow.closest('.DetailsCategory-row')?.classList.toggle('is-collapsed');
			else if (check) {
				const on = check.getAttribute('aria-checked') !== 'true';
				check.setAttribute('aria-checked', String(on));
				check.classList.toggle('is-off', !on);
				return;
			} else if (reset) {
				const row = reset.closest<HTMLElement>('.DetailsCategory-row');
				const text = row?.querySelector('.DetailsCategory-text');
				if (row && text) {
					text.textContent = row.dataset.default ?? '';
					this.syncReset(row);
					this.refresh(frame);
				}
				return;
			} else return;
			this.refresh(frame);
		});

		this.on(frame, 'keydown', (event) => {
			const target = event.target as HTMLElement;
			const catRow = target.matches('.DetailsCategory-catRow') ? target.closest('.DetailsCategory-cat') : null;
			if (catRow && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
				event.preventDefault();
				catRow.classList.toggle('is-collapsed', event.key === 'ArrowLeft');
				this.refresh(frame);
				return;
			}
			const activates = target.matches('.DetailsCategory-catRow, .DetailsCategory-advRow, .DetailsCategory-rowArrow, .DetailsCategory-check, .DetailsCategory-reset');
			if (activates && (event.key === 'Enter' || event.key === ' ')) {
				event.preventDefault();
				target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
		});

		this.on(frame, 'focusin', (event) => {
			const text = isIn(event.target as Element, '.DetailsCategory-text');
			if (text) text.dataset.before = text.textContent ?? '';
		});
		this.on(frame, 'keydown', (event) => {
			const text = isIn(event.target as Element, '.DetailsCategory-text');
			if (!text) return;
			if (event.key === 'Enter') {
				event.preventDefault();
				text.blur();
			} else if (event.key === 'Escape') {
				text.textContent = text.dataset.before ?? '';
				text.blur();
			}
		});
		this.on(frame, 'focusout', (event) => {
			const text = isIn(event.target as Element, '.DetailsCategory-text');
			const row = text?.closest<HTMLElement>('.DetailsCategory-row');
			if (!text || !row) return;
			text.textContent = (text.textContent ?? '').trim();
			this.syncReset(row);
			this.refresh(frame);
		});
	}

	// The reset arrow shows only while the text differs from the row default.
	private syncReset(row: HTMLElement): void {
		const text = row.querySelector('.DetailsCategory-text');
		const reset = row.querySelector<HTMLElement>('.DetailsCategory-reset[role="button"]');
		if (!text || !reset || row.dataset.default === undefined) return;
		const idle = (text.textContent ?? '') === row.dataset.default;
		reset.classList.toggle('is-idle', idle);
		reset.tabIndex = idle ? -1 : 0;
	}

	private wirePanel(frame: HTMLElement): void {
		const input = this.one<HTMLInputElement>('.DetailsCategory-srInput');
		const clear = this.one('.DetailsCategory-srClear');
		if (input && clear) {
			const sync = (): void => {
				input.classList.toggle('has-value', input.value !== '');
				clear.classList.toggle('is-hidden', input.value === '');
				this.refresh(frame);
			};
			const wipe = (): void => {
				input.value = '';
				sync();
				input.focus();
			};
			this.on(input, 'input', sync);
			this.on(input, 'keydown', (event) => {
				if (event.key === 'Escape' && input.value !== '') {
					event.preventDefault();
					wipe();
				}
			});
			this.on(clear, 'click', wipe);
		}

		const name = this.one('.DetailsCategory-hdrName');
		if (name) {
			let before = name.textContent ?? '';
			this.on(name, 'focus', () => {
				before = name.textContent ?? '';
			});
			this.on(name, 'keydown', (event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					name.blur();
				} else if (event.key === 'Escape') {
					name.textContent = before;
					name.blur();
				}
			});
			this.on(name, 'blur', () => {
				const text = (name.textContent ?? '').trim();
				name.textContent = text === '' ? before : text;
			});
		}

		const lock = this.one('[data-role="lock"]');
		if (lock) {
			this.on(lock, 'click', () => {
				const on = lock.getAttribute('aria-pressed') !== 'true';
				lock.setAttribute('aria-pressed', String(on));
				lock.querySelector('use')?.setAttribute('href', on ? '#DetailsCategory-locked' : '#DetailsCategory-unlock');
			});
		}
		const star = this.one('[data-role="favorites"]');
		if (star) {
			this.on(star, 'click', () => {
				const on = star.getAttribute('aria-pressed') !== 'true';
				star.setAttribute('aria-pressed', String(on));
				star.classList.toggle('is-on', on);
			});
		}

		const gear = this.one('[data-role="options"]');
		const menu = this.one('.DetailsCategory-menu');
		if (gear && menu) {
			const handle = wireMenu({
				trigger: gear,
				menu,
				itemSelector: '.DetailsCategory-menuItem',
				onPick: (item) => {
					const option = item.dataset.option;
					if (option === 'modified') item.setAttribute('aria-checked', String(item.getAttribute('aria-checked') !== 'true'));
					else if (option === 'collapseAll' || option === 'expandAll') {
						for (const cat of this.all('.DetailsCategory-cat')) cat.classList.toggle('is-collapsed', option === 'collapseAll');
					}
					this.refresh(frame);
				},
			});
			this.onDispose(handle.dispose);
		}

		const strip = this.one('.DetailsCategory-pills');
		if (strip) {
			const pills = (): HTMLElement[] => Array.from(strip.querySelectorAll<HTMLElement>('.DetailsCategory-pill'));
			const select = (pill: HTMLElement, focus: boolean): void => {
				for (const other of pills()) {
					other.classList.toggle('is-checked', other === pill);
					other.setAttribute('aria-selected', String(other === pill));
					other.tabIndex = other === pill ? 0 : -1;
				}
				if (focus) pill.focus();
				this.refresh(frame);
			};
			this.on(strip, 'click', (event) => {
				const pill = isIn(event.target as Element, '.DetailsCategory-pill');
				if (pill) select(pill, false);
			});
			this.on(strip, 'keydown', (event) => {
				const all = pills();
				const at = all.indexOf(document.activeElement as HTMLElement);
				if (at < 0) return;
				let next = -1;
				if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % all.length;
				else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + all.length) % all.length;
				else if (event.key === 'Home') next = 0;
				else if (event.key === 'End') next = all.length - 1;
				if (next < 0) return;
				event.preventDefault();
				select(all[next], true);
			});
		}
	}

	// Recomputes which cats, rows and the Advanced bar show, and the arrow glyphs.
	private refresh(frame: HTMLElement): void {
		const query = this.query();
		const searching = query !== '';
		const section = this.section();
		const onlyModified = this.modifiedOnly();

		const items: Item[] = [];
		for (const el of Array.from(frame.children) as HTMLElement[]) {
			if (el.classList.contains('DetailsCategory-cat')) items.push({ el, kind: 'cat', level: 0, matchesText: true, isModified: true });
			else if (el.classList.contains('DetailsCategory-adv')) items.push({ el, kind: 'adv', level: 0, matchesText: true, isModified: true });
			else if (el.classList.contains('DetailsCategory-row')) {
				const label = (el.querySelector('.DetailsCategory-label')?.textContent ?? '').toLowerCase();
				const reset = el.querySelector('.DetailsCategory-reset[role="button"]');
				items.push({
					el,
					kind: 'row',
					level: el.querySelectorAll(':scope > .DetailsCategory-indent').length,
					matchesText: !searching || label.includes(query),
					isModified: !onlyModified || (reset !== null && !reset.classList.contains('is-idle')),
				});
			}
		}

		// A row shows when it, an ancestor (text only) or a descendant matches.
		const keep = items.map((item, i) => {
			if (item.kind !== 'row') return true;
			let textOk = item.matchesText;
			let modOk = item.isModified;
			let want = item.level;
			for (let j = i - 1; j >= 0 && items[j].kind !== 'cat' && want > 0; j--) {
				if (items[j].kind === 'row' && items[j].level < want) {
					textOk = textOk || items[j].matchesText;
					want = items[j].level;
				}
			}
			for (let j = i + 1; j < items.length && items[j].kind === 'row' && items[j].level > item.level; j++) {
				textOk = textOk || items[j].matchesText;
				modOk = modOk || items[j].isModified;
			}
			return textOk && modOk;
		});

		let anyCatShown = false;
		let cat: HTMLElement | null = null;
		let catHidden = false;
		let catFolded = false;
		let catHasRows = false;
		let advOpen = true;
		let inAdv = false;
		const closed: boolean[] = [];

		const finishCat = (): void => {
			if (!cat) return;
			const empty = !catHasRows && (searching || onlyModified);
			cat.classList.toggle('is-hidden', catHidden || empty);
			if (!catHidden && !empty) anyCatShown = true;
		};

		items.forEach((item, i) => {
			const { el } = item;
			if (item.kind === 'cat') {
				finishCat();
				cat = el;
				const own = el.dataset.section;
				catHidden = section !== '' && own !== undefined && own !== section;
				catFolded = el.classList.contains('is-collapsed') && !searching;
				catHasRows = false;
				inAdv = false;
				closed.length = 0;
				this.setArrow(el.querySelector('.DetailsCategory-arrow use'), !catFolded);
				el.querySelector('.DetailsCategory-catRow')?.setAttribute('aria-expanded', String(!catFolded));
			} else if (item.kind === 'adv') {
				inAdv = true;
				advOpen = el.classList.contains('is-open') || searching;
				el.classList.toggle('is-hidden', catHidden || catFolded || searching);
				this.setArrow(el.querySelector('.DetailsCategory-arrow use'), advOpen);
				el.querySelector('.DetailsCategory-advRow')?.setAttribute('aria-expanded', String(advOpen));
			} else {
				closed.length = item.level;
				const parentClosed = !searching && closed.some(Boolean);
				const hidden = catHidden || catFolded || parentClosed || (inAdv && !advOpen) || !keep[i];
				el.classList.toggle('is-hidden', hidden);
				const toggle = el.querySelector('.DetailsCategory-rowArrow.has-children');
				const folded = toggle !== null && el.classList.contains('is-collapsed') && !searching;
				closed[item.level] = folded;
				if (toggle) {
					this.setArrow(toggle.querySelector('use'), !folded);
					toggle.setAttribute('aria-expanded', String(!folded));
				}
				if (!hidden) catHasRows = true;
			}
		});
		finishCat();

		frame.querySelector('.DetailsCategory-empty')?.classList.toggle('is-shown', !anyCatShown && (searching || section !== '' || onlyModified));
	}

	private setArrow(use: Element | null, expanded: boolean): void {
		use?.setAttribute('href', expanded ? DOWN : RIGHT);
	}
}

define('ue-details-category', UeDetailsCategory);
