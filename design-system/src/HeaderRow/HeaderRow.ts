<<<<<<< HEAD
// <ue-header-row> wraps one .hr-row. A .hr-cell with aria-sort sorts on click; a .hr-grip inside a cell resizes it against the next cell.
import { UeElement, define } from '../_shared/element.ts';
import { drag } from '../_shared/drag.ts';
import './HeaderRow.css';
=======
// <ue-header-row> wraps a .hr-row. A .hr-cell with aria-sort sorts on click; a .hr-grip inside a cell resizes it against the next cell.
import { UeElement, define } from '../_shared/element.ts';
import { drag } from '../_shared/drag.ts';
>>>>>>> origin/master

const CELL = '.hr-cell';
const SORTABLE = '.hr-cell[aria-sort]';
const GRIP = '.hr-grip';
const ARROW = '.hr-sort';

<<<<<<< HEAD
const GLYPH: Record<string, string> = {
	up: 'M2 8l4-5 4 5z',
	down: 'M2 4l4 5 4-5z',
	up2: 'M2 6.2l4-4 4 4zM2 10.5l4-4 4 4z',
	down2: 'M2 1.5l4 4 4-4zM2 5.8l4 4 4-4z',
};
const SVG_NS = 'http://www.w3.org/2000/svg';

=======
>>>>>>> origin/master
// Smallest column width, SHeaderRow.cpp:872.
const MIN_WIDTH = 20;
const KEY_STEP = 8;

type Mode = 'ascending' | 'descending' | 'none';
type Priority = 'primary' | 'secondary';

export interface SortDetail {
	column: string;
	mode: Mode;
<<<<<<< HEAD
	// Same as mode: 'ascending', 'descending' or 'none'.
	direction: Mode;
	priority: Priority;
}

export interface ResizeDetail {
	column: string;
	width: number;
	nextColumn: string;
	nextWidth: number;
}

=======
	priority: Priority;
}

>>>>>>> origin/master
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
<<<<<<< HEAD
	let arrow = cell.querySelector<SVGElement>(ARROW);
	if (!arrow) {
		arrow = document.createElementNS(SVG_NS, 'svg');
		arrow.setAttribute('class', 'hr-sort');
		arrow.setAttribute('viewBox', '0 0 12 12');
		arrow.setAttribute('aria-hidden', 'true');
		const grip = cell.querySelector(GRIP);
		if (grip) cell.insertBefore(arrow, grip);
		else cell.append(arrow);
	}
	let path = arrow.querySelector('path');
	if (!path) {
		path = document.createElementNS(SVG_NS, 'path');
		arrow.append(path);
	}
	arrow.toggleAttribute('hidden', mode === 'none');
	path.setAttribute('d', GLYPH[(mode === 'descending' ? 'down' : 'up') + (priority === 'secondary' ? '2' : '')]);
=======
	const arrow = cell.querySelector<SVGElement>(ARROW);
	if (!arrow) return;
	arrow.toggleAttribute('hidden', mode === 'none');
	const symbol = 'hr-' + (mode === 'descending' ? 'down' : 'up') + (priority === 'secondary' ? '2' : '');
	arrow.querySelector('use')?.setAttribute('href', '#' + symbol);
>>>>>>> origin/master
}

export class HeaderRow extends UeElement {
	protected setup(): void {
<<<<<<< HEAD
		const sortable = (): HTMLElement[] => this.all(SORTABLE).filter((cell) => this.owns(cell));
=======
		const sortable = (): HTMLElement[] => this.all(SORTABLE);
>>>>>>> origin/master
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
<<<<<<< HEAD
			this.emit<SortDetail>('ue-sort', { column: cell.dataset.column ?? '', mode, direction: mode, priority });
=======
			this.emit<SortDetail>('ue-sort', { column: cell.dataset.column ?? '', mode, priority });
>>>>>>> origin/master
		};

		this.on(this, 'click', (event) => {
			const target = event.target;
<<<<<<< HEAD
			if (!(target instanceof Element) || target.closest(GRIP) || !this.owns(target)) return;
=======
			if (!(target instanceof Element) || target.closest(GRIP)) return;
>>>>>>> origin/master
			const cell = target.closest<HTMLElement>(SORTABLE);
			if (cell && this.contains(cell)) activate(cell, event.shiftKey);
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
<<<<<<< HEAD
			if (!(target instanceof HTMLElement) || !target.matches(SORTABLE) || !this.owns(target)) return;
=======
			if (!(target instanceof HTMLElement) || !target.matches(SORTABLE)) return;
>>>>>>> origin/master
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			activate(target, event.shiftKey);
		});

<<<<<<< HEAD
		const grips = this.all(GRIP).filter((grip) => this.owns(grip));
		const resizable = this.getAttribute('grips') !== 'off';
		for (const grip of grips) {
			grip.hidden = !resizable;
			if (resizable) this.#bindGrip(grip);
		}
=======
		for (const grip of this.all(GRIP)) this.#bindGrip(grip);
>>>>>>> origin/master
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
<<<<<<< HEAD
			left.style.flex = clamped + ' 1 ' + clamped + 'px';
			right.style.flex = total - clamped + ' 1 ' + (total - clamped) + 'px';
			grip.setAttribute('aria-valuenow', String(Math.round(clamped)));
			this.emit<ResizeDetail>('ue-column-resize', { column: left.dataset.column ?? '', width: clamped, nextColumn: right.dataset.column ?? '', nextWidth: total - clamped });
		};
		// Each flexible cell takes its pixel width as its grow factor, so the other columns keep their share while a couple of columns trade width.
		const measure = (): void => {
			const flexible = Array.from(cells.children).filter((cell): cell is HTMLElement => cell instanceof HTMLElement && cell.matches(CELL) && getComputedStyle(cell).flexGrow !== '0');
			const widths = flexible.map((cell) => cell.getBoundingClientRect().width);
			flexible.forEach((cell, i) => {
				cell.style.flex = widths[i] + ' 1 ' + widths[i] + 'px';
			});
=======
			cells.style.setProperty('--hr-a', clamped + 'fr');
			cells.style.setProperty('--hr-b', total - clamped + 'fr');
			grip.setAttribute('aria-valuenow', String(Math.round(clamped)));
		};
		const measure = (): void => {
>>>>>>> origin/master
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
