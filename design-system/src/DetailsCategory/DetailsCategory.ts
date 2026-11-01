<<<<<<< HEAD
// <ue-details-category> wraps a category tree (and, in the live panel, the
// header, search row and pills above it).
import { UeElement, define } from '../_shared/element.ts';
import { wireMenu } from '../_shared/popupmenu.ts';

const DOWN = '#DetailsCategory-down';
const RIGHT = '#DetailsCategory-right';
=======
// <ue-details-category> is a category tree. The live panel adds a ue-details-header, a ue-details-search-row and a ue-filter-pills strip above it.
// The controls in the rows are primitives or nested composites. This element folds the categories and filters the rows.
import { UeElement, define } from '../_shared/element.ts';
import '../AssetPicker/AssetPicker.ts';
import '../Checkbox/Checkbox.ts';
import '../ComboButton/ComboButton.ts';
import '../DetailsHeader/DetailsHeader.ts';
import '../DetailsSearchRow/DetailsSearchRow.ts';
import '../FilterPills/FilterPills.ts';
import '../ResetToDefault/ResetToDefault.ts';
import '../SpinBox/SpinBox.ts';
import '../TextInput/TextInput.ts';
import '../VectorInput/VectorInput.ts';
import type { UeSpinBoxElement } from '../SpinBox/SpinBox.ts';
import './DetailsCategory.css';
>>>>>>> claude/adoring-faraday-94vc0i

interface Item {
	el: HTMLElement;
	kind: 'cat' | 'adv' | 'row';
	level: number;
	matchesText: boolean;
	isModified: boolean;
}

const isIn = (el: Element, selector: string): HTMLElement | null => el.closest<HTMLElement>(selector);

<<<<<<< HEAD
class UeDetailsCategory extends UeElement {
	protected setup(): void {
		const frame = this.one('.DetailsCategory-frame');
		if (!frame) return;
		this.wireFrame(frame);
		if (this.one('.DetailsCategory-panel')) this.wirePanel(frame);
=======
// A row of a nested composite, such as a ue-vector-input row, names itself with data-label.
const isRow = (el: HTMLElement): boolean => el.classList.contains('DetailsCategory-row') || el.dataset.label !== undefined;

class UeDetailsCategory extends UeElement {
	#query = '';
	#section = '';
	#onlyModified = false;

	protected setup(): void {
		const frame = this.one('.DetailsCategory-frame');
		if (!frame) return;
		this.#section = this.one('.FilterPills-pill.is-checked')?.dataset.value ?? '';
		this.wireFrame(frame);
		this.wireControls(frame);
>>>>>>> claude/adoring-faraday-94vc0i
		for (const row of this.all('.DetailsCategory-row')) this.syncReset(row);
		this.refresh(frame);
	}

<<<<<<< HEAD
	private query(): string {
		return (this.one<HTMLInputElement>('.DetailsCategory-srInput')?.value ?? '').trim().toLowerCase();
	}

	private section(): string {
		return this.one('.DetailsCategory-pill.is-checked')?.dataset.section ?? '';
	}

	private modifiedOnly(): boolean {
		return this.one('[data-option="modified"]')?.getAttribute('aria-checked') === 'true';
=======
	// The panel controls announce themselves with events. The tree only listens.
	private wireControls(frame: HTMLElement): void {
		this.on(this, 'ue-search', (event) => {
			this.#query = (event as CustomEvent<{ text: string }>).detail.text.trim().toLowerCase();
			this.refresh(frame);
		});
		this.on(this, 'ue-filter-change', (event) => {
			this.#section = (event as CustomEvent<{ value: string }>).detail.value;
			this.refresh(frame);
		});
		this.on(this, 'ue-view-option', (event) => {
			const { option, checked } = (event as CustomEvent<{ option: string; checked: boolean }>).detail;
			if (option === 'modified') this.#onlyModified = checked;
			else if (option === 'collapseAll' || option === 'expandAll') {
				for (const cat of this.all('.DetailsCategory-cat')) cat.classList.toggle('is-collapsed', option === 'collapseAll');
			}
			this.refresh(frame);
		});
>>>>>>> claude/adoring-faraday-94vc0i
	}

	private wireFrame(frame: HTMLElement): void {
		this.on(frame, 'click', (event) => {
			const target = event.target as Element;
			const catRow = isIn(target, '.DetailsCategory-catRow');
			const advRow = isIn(target, '.DetailsCategory-advRow');
			const arrow = isIn(target, '.DetailsCategory-rowArrow.has-children');
<<<<<<< HEAD
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
=======
			if (catRow) catRow.closest('.DetailsCategory-cat')?.classList.toggle('is-collapsed');
			else if (advRow) advRow.closest('.DetailsCategory-adv')?.classList.toggle('is-open');
			else if (arrow) arrow.closest('.DetailsCategory-row')?.classList.toggle('is-collapsed');
			else return;
>>>>>>> claude/adoring-faraday-94vc0i
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
<<<<<<< HEAD
			const activates = target.matches('.DetailsCategory-catRow, .DetailsCategory-advRow, .DetailsCategory-rowArrow, .DetailsCategory-check, .DetailsCategory-reset');
=======
			const activates = target.matches('.DetailsCategory-catRow, .DetailsCategory-advRow, .DetailsCategory-rowArrow');
>>>>>>> claude/adoring-faraday-94vc0i
			if (activates && (event.key === 'Enter' || event.key === ' ')) {
				event.preventDefault();
				target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
		});

<<<<<<< HEAD
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
=======
		// A text value commits live. Enter ends the edit and Escape restores the text from before it.
		this.on(frame, 'focusin', (event) => {
			const field = this.fieldOf(event.target);
			if (field) field.dataset.before = field.value;
		});
		this.on(frame, 'keydown', (event) => {
			const field = this.fieldOf(event.target);
			if (!field) return;
			if (event.key === 'Enter') field.blur();
			else if (event.key === 'Escape') {
				field.value = field.dataset.before ?? '';
				this.touched(field);
				field.blur();
			} else return;
			event.preventDefault();
		});

		this.on(frame, 'ue-text-input', (event) => this.touched(event.target));
		this.on(frame, 'ue-spin-change', (event) => this.touched(event.target));
		// A nested composite changed its own reset state, which the modified filter reads.
		this.on(frame, 'ue-vector-change', () => this.refresh(frame));
		this.on(frame, 'ue-asset-change', () => this.refresh(frame));
		this.on(frame, 'ue-reset', (event) => {
			const row = isIn(event.target as Element, '.DetailsCategory-row');
			if (!row) return;
			const def = row.dataset.default ?? '';
			const field = row.querySelector<HTMLInputElement>('.textinput__field');
			const spin = row.querySelector<UeSpinBoxElement>('ue-spin-box');
			if (field) field.value = def;
			else if (spin) spin.value = Number(def);
>>>>>>> claude/adoring-faraday-94vc0i
			this.syncReset(row);
			this.refresh(frame);
		});
	}

<<<<<<< HEAD
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
=======
	// The text field of a row value, or null for any other target.
	private fieldOf(target: EventTarget | null): HTMLInputElement | null {
		const el = target as Element | null;
		const field = el instanceof HTMLInputElement && el.classList.contains('textinput__field') ? el : null;
		return field && isIn(field, '.DetailsCategory-row') ? field : null;
	}

	private touched(target: EventTarget | null): void {
		const row = isIn(target as Element, '.DetailsCategory-row');
		const frame = row?.closest<HTMLElement>('.DetailsCategory-frame');
		if (!row || !frame) return;
		this.syncReset(row);
		this.refresh(frame);
	}

	private valueOf(row: HTMLElement): string | null {
		const field = row.querySelector<HTMLInputElement>('.textinput__field');
		if (field) return field.value;
		return row.querySelector<HTMLElement>('.spinbox')?.dataset.value ?? null;
	}

	// The reset arrow shows only while the value differs from the row default.
	private syncReset(row: HTMLElement): void {
		const reset = row.querySelector('ue-reset-to-default');
		const value = this.valueOf(row);
		if (!reset || value === null || row.dataset.default === undefined) return;
		reset.toggleAttribute('differs', value !== row.dataset.default);
	}

	// Recomputes which cats, rows and the Advanced bar show, and the arrow states.
	private refresh(frame: HTMLElement): void {
		const query = this.#query;
		const searching = query !== '';
		const section = this.#section;
		const onlyModified = this.#onlyModified;

		// A nested composite such as a ue-vector-input holds rows that take part in the tree.
		const children: HTMLElement[] = [];
		for (const child of Array.from(frame.children) as HTMLElement[]) {
			if (child.localName.startsWith('ue-')) children.push(...(Array.from(child.children) as HTMLElement[]));
			else children.push(child);
		}

		const items: Item[] = [];
		for (const el of children) {
			if (el.classList.contains('DetailsCategory-cat')) items.push({ el, kind: 'cat', level: 0, matchesText: true, isModified: true });
			else if (el.classList.contains('DetailsCategory-adv')) items.push({ el, kind: 'adv', level: 0, matchesText: true, isModified: true });
			else if (isRow(el)) {
				const label = (el.dataset.label ?? el.querySelector('.DetailsCategory-label')?.textContent ?? '').toLowerCase();
>>>>>>> claude/adoring-faraday-94vc0i
				items.push({
					el,
					kind: 'row',
					level: el.querySelectorAll(':scope > .DetailsCategory-indent').length,
					matchesText: !searching || label.includes(query),
<<<<<<< HEAD
					isModified: !onlyModified || (reset !== null && !reset.classList.contains('is-idle')),
=======
					isModified: !onlyModified || el.querySelector('ue-reset-to-default[differs]') !== null,
>>>>>>> claude/adoring-faraday-94vc0i
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
<<<<<<< HEAD
				this.setArrow(el.querySelector('.DetailsCategory-arrow use'), !catFolded);
=======
>>>>>>> claude/adoring-faraday-94vc0i
				el.querySelector('.DetailsCategory-catRow')?.setAttribute('aria-expanded', String(!catFolded));
			} else if (item.kind === 'adv') {
				inAdv = true;
				advOpen = el.classList.contains('is-open') || searching;
				el.classList.toggle('is-hidden', catHidden || catFolded || searching);
<<<<<<< HEAD
				this.setArrow(el.querySelector('.DetailsCategory-arrow use'), advOpen);
=======
>>>>>>> claude/adoring-faraday-94vc0i
				el.querySelector('.DetailsCategory-advRow')?.setAttribute('aria-expanded', String(advOpen));
			} else {
				closed.length = item.level;
				const parentClosed = !searching && closed.some(Boolean);
				const hidden = catHidden || catFolded || parentClosed || (inAdv && !advOpen) || !keep[i];
				el.classList.toggle('is-hidden', hidden);
				const toggle = el.querySelector('.DetailsCategory-rowArrow.has-children');
				const folded = toggle !== null && el.classList.contains('is-collapsed') && !searching;
				closed[item.level] = folded;
<<<<<<< HEAD
				if (toggle) {
					this.setArrow(toggle.querySelector('use'), !folded);
					toggle.setAttribute('aria-expanded', String(!folded));
				}
=======
				toggle?.setAttribute('aria-expanded', String(!folded));
>>>>>>> claude/adoring-faraday-94vc0i
				if (!hidden) catHasRows = true;
			}
		});
		finishCat();

		frame.querySelector('.DetailsCategory-empty')?.classList.toggle('is-shown', !anyCatShown && (searching || section !== '' || onlyModified));
	}
<<<<<<< HEAD

	private setArrow(use: Element | null, expanded: boolean): void {
		use?.setAttribute('href', expanded ? DOWN : RIGHT);
	}
=======
>>>>>>> claude/adoring-faraday-94vc0i
}

define('ue-details-category', UeDetailsCategory);
