// <ue-place-actors-panel> wraps a .placeActors panel: a ue-text-input search, a ue-segmented-control category rail and one item group per category.
import { UeElement, define } from '../_shared/element.ts';
import '../SegmentedControl/SegmentedControl.ts';
import '../TextInput/TextInput.ts';

const GROUP = '.placeActors-group';
const ROW = '.placeActors-row';

export class PlaceActorsPanel extends UeElement {
	protected setup(): void {
		const field = this.one<HTMLInputElement>('.textinput__field');
		const header = this.one('.placeActors-header');
		const empty = this.one('.placeActors-empty');

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

		const show = (name: string): void => {
			if (header) header.textContent = name;
			for (const group of this.all(GROUP)) group.hidden = group.dataset.category !== name;
			applyFilter();
			this.emit('ue-category-change', { category: name });
		};

		this.on(this, 'ue-segment-change', (event) => show((event as CustomEvent<{ value: string }>).detail.value));
		this.on(this, 'ue-text-input', () => applyFilter());

		this.on(this, 'dblclick', (event) => {
			const target = event.target;
			if (!(target instanceof Element) || target.closest('.placeActors-info')) return;
			const row = target.closest<HTMLElement>(ROW);
			if (row) this.emit('ue-place', { name: row.querySelector('.placeActors-name')?.textContent ?? '' });
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
			if (target instanceof HTMLElement && target.matches(ROW) && event.key === 'Enter') {
				event.preventDefault();
				this.emit('ue-place', { name: target.querySelector('.placeActors-name')?.textContent ?? '' });
			}
		});

		const active = this.one('.SegmentedControl-seg.is-checked');
		if (active) show(active.dataset.value ?? '');
	}
}

define('ue-place-actors-panel', PlaceActorsPanel);
