// <ue-splitter> wraps one .splitter box: a pane, a .splitter-handle and a second pane. The handle resizes the pane before it.
import { UeElement, define } from '../_shared/element.ts';
import { drag } from '../_shared/drag.ts';
import './Splitter.css';

const DEFAULT_MIN = 20;
const DEFAULT_STEP = 5;
const DEFAULT_STEP_LARGE = 20;
const HIGHLIGHT = 'splitter-handle--highlight';

export interface SplitterResizeDetail {
	// Length of the pane before the handle, in pixels.
	size: number;
	// Length of both panes together.
	total: number;
	orientation: 'horizontal' | 'vertical';
}

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
		const handle = this.all('.splitter-handle').find((candidate) => this.owns(candidate));
		if (!handle) throw new Error('ue-splitter needs a .splitter-handle between two panes');
		this.#wire(handle);
	}

	// A number attribute of this element, or the fallback when it is missing or not a number.
	#number(name: string, fallback: number): number {
		const value = Number(this.getAttribute(name));
		return this.hasAttribute(name) && Number.isFinite(value) ? value : fallback;
	}

	#wire(handle: HTMLElement): void {
		let startSize = 0;
		let total = 0;
		const minStart = (): number => this.#number('data-min-start', DEFAULT_MIN);
		const minEnd = (): number => this.#number('data-min-end', DEFAULT_MIN);

		// Sets the size of the pane before the handle. The pane after it takes the rest.
		const resize = (size: number): void => {
			const panes = panesOf(handle);
			if (!panes) return;
			const clamped = Math.min(Math.max(size, minStart()), total - minEnd());
			panes.before.style.flex = '0 0 ' + clamped + 'px';
			panes.after.style.flex = '1 1 0';
			this.#publish(handle, panes);
			this.emit<SplitterResizeDetail>('ue-splitter-resize', { size: clamped, total, orientation: panes.vertical ? 'vertical' : 'horizontal' });
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
			const step = event.shiftKey ? this.#number('data-step-shift', DEFAULT_STEP_LARGE) : this.#number('data-step', DEFAULT_STEP);
			if (event.key === grow) resize(startSize + step);
			else if (event.key === shrink) resize(startSize - step);
			else if (event.key === 'Home') resize(minStart());
			else if (event.key === 'End') resize(total - minEnd());
			else return;
			event.preventDefault();
		});
	}

	// Publishes the position of the handle for assistive technology: the size of the pane before it.
	#publish(handle: HTMLElement, panes: Panes): void {
		const size = extent(panes.before, panes.vertical);
		const total = size + extent(panes.after, panes.vertical);
		handle.setAttribute('aria-valuemin', String(this.#number('data-min-start', DEFAULT_MIN)));
		handle.setAttribute('aria-valuemax', String(Math.round(total - this.#number('data-min-end', DEFAULT_MIN))));
		handle.setAttribute('aria-valuenow', String(Math.round(size)));
	}
}

define('ue-splitter', SplitterElement);
