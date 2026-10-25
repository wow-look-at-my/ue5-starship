// <ue-splitter> wraps one .splitter-demo and makes every .splitter-handle in it draggable.
import { UeElement, define } from '../_shared/element.ts';
import { drag } from '../_shared/drag.ts';

const MIN_PANE = 20;
const KEY_STEP = 5;
const KEY_STEP_LARGE = 20;
const HIGHLIGHT = 'splitter-handle--highlight';

interface Panes {
	before: HTMLElement;
	after: HTMLElement;
	vertical: boolean;
}

function panesOf(handle: HTMLElement): Panes | null {
	const before = handle.previousElementSibling;
	const after = handle.nextElementSibling;
	if (!(before instanceof HTMLElement) || !(after instanceof HTMLElement) || !handle.parentElement) return null;
	return { before, after, vertical: getComputedStyle(handle.parentElement).flexDirection === 'column' };
}

const extent = (pane: HTMLElement, vertical: boolean): number => pane.getBoundingClientRect()[vertical ? 'height' : 'width'];

class SplitterElement extends UeElement {
	protected setup(): void {
		for (const handle of this.all('.splitter-handle')) {
			if (handle.hasAttribute('data-pinned')) continue;
			this.#wire(handle);
		}
	}

	#wire(handle: HTMLElement): void {
		let startSize = 0;
		let total = 0;

		// Sets the size of the pane before the handle. The pane after it takes the rest.
		const resize = (size: number): void => {
			const panes = panesOf(handle);
			if (!panes) return;
			const clamped = Math.min(Math.max(size, MIN_PANE), total - MIN_PANE);
			panes.before.style.flex = '0 0 ' + clamped + 'px';
			panes.after.style.flex = '1 1 0';
			this.#publish(handle, panes);
		};
		const measure = (): Panes | null => {
			const panes = panesOf(handle);
			if (!panes) return null;
			startSize = extent(panes.before, panes.vertical);
			total = startSize + extent(panes.after, panes.vertical);
			return panes;
		};

		const panes = panesOf(handle);
		if (panes) {
			handle.setAttribute('aria-orientation', panes.vertical ? 'horizontal' : 'vertical');
			this.#publish(handle, panes);
		}

		this.onDispose(drag(handle, {
			start: () => {
				measure();
				handle.classList.add(HIGHLIGHT);
			},
			move: (_event, dx, dy) => {
				const current = panesOf(handle);
				if (current) resize(startSize + (current.vertical ? dy : dx));
			},
			end: () => handle.classList.remove(HIGHLIGHT),
		}));

		this.on(handle, 'keydown', (event) => {
			const current = measure();
			if (!current) return;
			const grow = current.vertical ? 'ArrowDown' : 'ArrowRight';
			const shrink = current.vertical ? 'ArrowUp' : 'ArrowLeft';
			const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
			if (event.key === grow) resize(startSize + step);
			else if (event.key === shrink) resize(startSize - step);
			else if (event.key === 'Home') resize(MIN_PANE);
			else if (event.key === 'End') resize(total - MIN_PANE);
			else return;
			event.preventDefault();
		});
	}

	// Publishes the position of the handle for assistive technology: the size of the pane before it.
	#publish(handle: HTMLElement, panes: Panes): void {
		const size = extent(panes.before, panes.vertical);
		const total = size + extent(panes.after, panes.vertical);
		handle.setAttribute('aria-valuemin', String(MIN_PANE));
		handle.setAttribute('aria-valuemax', String(Math.round(total - MIN_PANE)));
		handle.setAttribute('aria-valuenow', String(Math.round(size)));
	}
}

define('ue-splitter', SplitterElement);
