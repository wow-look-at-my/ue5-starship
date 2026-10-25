// <ue-place-actors-panel> wraps a .placeActors panel: category strip, search field and one item group per category.
import { UeElement, define } from '../_shared/element.ts';

const CAT = '.placeActors-cat';
const GROUP = '.placeActors-group';
const ROW = '.placeActors-row';

export class PlaceActorsPanel extends UeElement {
	protected setup(): void {
		const field = this.one<HTMLInputElement>('.placeActors-field');
		const header = this.one('.placeActors-header');
		const empty = this.one('.placeActors-empty');

		const cats = (): HTMLElement[] => this.all(CAT);

		// Shows only the rows of the visible group whose name contains the query.
		const applyFilter = (): void => {
			const query = (field?.value ?? '').trim().toLowerCase();
			const group = this.one(GROUP + ':not([hidden])');
			let visible = 0;
			if (group) {
				for (const row of Array.from(group.querySelectorAll<HTMLElement>(ROW))) {
					const name = row.querySelector('.placeActors-name')?.textContent?.toLowerCase() ?? '';
					row.hidden = query !== '' && !name.includes(query);
					if (!row.hidden) visible++;
				}
			}
			if (empty instanceof HTMLElement) empty.hidden = !(query !== '' && visible === 0);
		};

		const select = (cat: HTMLElement, focus: boolean): void => {
			const name = cat.dataset.category ?? '';
			for (const other of cats()) {
				const active = other === cat;
				other.classList.toggle('is-active', active);
				other.setAttribute('aria-checked', String(active));
				other.tabIndex = active ? 0 : -1;
			}
			if (header) header.textContent = name;
			for (const group of this.all(GROUP)) group.hidden = group.dataset.category !== name;
			applyFilter();
			if (focus) cat.focus();
			this.emit('ue-category-change', { category: name });
		};

		const clear = (): void => {
			if (!field) return;
			field.value = '';
			applyFilter();
			field.focus();
		};

		this.on(this, 'click', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const cat = target.closest<HTMLElement>(CAT);
			if (cat && this.contains(cat)) {
				select(cat, false);
				return;
			}
			if (target.closest('.placeActors-clear')) clear();
		});

		this.on(this, 'input', () => applyFilter());

		this.on(this, 'dblclick', (event) => {
			const target = event.target;
			if (!(target instanceof Element) || target.closest('.placeActors-info')) return;
			const row = target.closest<HTMLElement>(ROW);
			if (row) this.emit('ue-place', { name: row.querySelector('.placeActors-name')?.textContent ?? '' });
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const key = event.key;
			if (target === field) {
				if (key === 'Escape' && field.value !== '') {
					event.preventDefault();
					clear();
				}
				return;
			}
			if (target.matches('.placeActors-clear') && (key === 'Enter' || key === ' ')) {
				event.preventDefault();
				clear();
				return;
			}
			if (target.matches(ROW) && key === 'Enter') {
				event.preventDefault();
				this.emit('ue-place', { name: target.querySelector('.placeActors-name')?.textContent ?? '' });
				return;
			}
			if (!target.matches(CAT)) return;
			const list = cats();
			const index = list.indexOf(target);
			let next = -1;
			if (key === 'ArrowRight' || key === 'ArrowDown') next = (index + 1) % list.length;
			else if (key === 'ArrowLeft' || key === 'ArrowUp') next = (index - 1 + list.length) % list.length;
			else if (key === 'Home') next = 0;
			else if (key === 'End') next = list.length - 1;
			else if (key === 'Enter' || key === ' ') {
				event.preventDefault();
				select(target, false);
				return;
			}
			if (next < 0) return;
			event.preventDefault();
			select(list[next], true);
		});

		const active = cats().find((cat) => cat.classList.contains('is-active'));
		if (active) select(active, false);
	}
}

define('ue-place-actors-panel', PlaceActorsPanel);
