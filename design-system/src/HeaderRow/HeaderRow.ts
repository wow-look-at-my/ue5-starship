// <ue-header-row> wraps a .hr-row. A .hr-cell with aria-sort sorts on click; a .hr-grip inside a cell resizes it against the next cell.
import { UeElement, define } from '../_shared/element.ts';
import { drag } from '../_shared/drag.ts';

const CELL = '.hr-cell';
const SORTABLE = '.hr-cell[aria-sort]';
const GRIP = '.hr-grip';
const ARROW = '.hr-sort';

// Smallest column width, SHeaderRow.cpp:872.
const MIN_WIDTH = 20;
const KEY_STEP = 8;

type Mode = 'ascending' | 'descending' | 'none';
type Priority = 'primary' | 'secondary';

export interface SortDetail {
	column: string;
	mode: Mode;
	priority: Priority;
}

function modeOf(cell: HTMLElement): Mode {
	const value = cell.getAttribute('aria-sort');
	return value === 'ascending' || value === 'descending' ? value : 'none';
}

function priorityOf(cell: HTMLElement): Priority {
	return cell.dataset.priority === 'secondary' ? 'secondary' : 'primary';
}

// Writes the sort state of a cell to its attributes and its arrow.
function paint(cell: HTMLElement, mode: Mode, priority: Priority): void {
	cell.setAttribute('aria-sort', mode);
	cell.dataset.priority = priority;
	const arrow = cell.querySelector<SVGElement>(ARROW);
	if (!arrow) return;
	arrow.toggleAttribute('hidden', mode === 'none');
	const symbol = 'hr-' + (mode === 'descending' ? 'down' : 'up') + (priority === 'secondary' ? '2' : '');
	arrow.querySelector('use')?.setAttribute('href', '#' + symbol);
}

export class HeaderRow extends UeElement {
	protected setup(): void {
		const sortable = (): HTMLElement[] => this.all(SORTABLE);
		for (const cell of sortable()) paint(cell, modeOf(cell), priorityOf(cell));

		// SHeaderRow.cpp:392-430: an unsorted column starts ascending, a sorted one flips. Shift adds a secondary key.
		const activate = (cell: HTMLElement, shift: boolean): void => {
			let mode = modeOf(cell);
			let priority = priorityOf(cell);
			if (mode === 'none') {
				priority = shift ? 'secondary' : 'primary';
				mode = 'ascending';
			} else {
				if (!shift && priority === 'secondary') priority = 'primary';
				mode = mode === 'descending' ? 'ascending' : 'descending';
			}
			for (const other of sortable()) {
				if (other !== cell && modeOf(other) !== 'none' && priorityOf(other) === priority) paint(other, 'none', priority);
			}
			paint(cell, mode, priority);
			this.emit<SortDetail>('ue-sort', { column: cell.dataset.column ?? '', mode, priority });
		};

		this.on(this, 'click', (event) => {
			const target = event.target;
			if (!(target instanceof Element) || target.closest(GRIP)) return;
			const cell = target.closest<HTMLElement>(SORTABLE);
			if (cell && this.contains(cell)) activate(cell, event.shiftKey);
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement) || !target.matches(SORTABLE)) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			activate(target, event.shiftKey);
		});

		for (const grip of this.all(GRIP)) this.#bindGrip(grip);
	}

	#bindGrip(grip: HTMLElement): void {
		const left = grip.closest<HTMLElement>(CELL);
		const right = left?.nextElementSibling;
		const cells = left?.parentElement;
		if (!left || !(right instanceof HTMLElement) || !right.matches(CELL) || !cells) return;

		let startLeft = 0;
		let total = 0;
		const apply = (width: number): void => {
			const clamped = Math.min(total - MIN_WIDTH, Math.max(MIN_WIDTH, width));
			cells.style.setProperty('--hr-a', clamped + 'fr');
			cells.style.setProperty('--hr-b', total - clamped + 'fr');
			grip.setAttribute('aria-valuenow', String(Math.round(clamped)));
		};
		const measure = (): void => {
			startLeft = left.getBoundingClientRect().width;
			total = startLeft + right.getBoundingClientRect().width;
		};

		this.onDispose(drag(grip, {
			start: measure,
			move: (_event, dx) => apply(startLeft + dx),
		}));
		this.on(grip, 'keydown', (event) => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			measure();
			apply(startLeft + (event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP));
		});
		// A click on the grip must not sort the cell.
		this.on(grip, 'click', (event) => event.stopPropagation());
	}
}

define('ue-header-row', HeaderRow);
