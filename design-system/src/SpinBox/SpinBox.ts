// <ue-spin-box> makes live .spinbox fields drag, type and step like SSpinBox (Runtime/Slate/Public/Widgets/Input/SSpinBox.h).
import { UeElement, define } from '../_shared/element.ts';

const DRAG_TRIGGER = 5; // FSlateApplication::DragTriggerDistance on desktop, SlateApplication.cpp:926
const MIN_SLIDER_WIDTH = 100; // SSpinBox.h:597 (MinSliderWidth)

interface Range {
	min: number;
	max: number;
	bounded: boolean;
	delta: number;
}

interface DragState {
	pointerId: number;
	lastX: number;
	distance: number;
	dragging: boolean;
	before: number;
	internal: number;
}

function numberAttr(el: HTMLElement, name: string): number | null {
	const raw = el.dataset[name];
	if (raw === undefined || raw === '') return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

function rangeOf(box: HTMLElement): Range {
	const min = numberAttr(box, 'min');
	const max = numberAttr(box, 'max');
	return { min: min ?? -Infinity, max: max ?? Infinity, bounded: min !== null && max !== null, delta: numberAttr(box, 'delta') ?? 0 };
}

function valueOf(box: HTMLElement): number {
	return numberAttr(box, 'value') ?? 0;
}

function format(value: number): string {
	const rounded = Math.round(value * 1000) / 1000;
	return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}

function clamp(value: number, range: Range): number {
	return Math.min(range.max, Math.max(range.min, value));
}

function boxOf(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>('.spinbox') : null;
}

export class UeSpinBoxElement extends UeElement {
	#drags = new WeakMap<HTMLElement, DragState>();

	protected setup(): void {
		for (const box of this.all('.spinbox')) this.#render(box);

		this.on(this, 'pointerdown', (event) => {
			const box = boxOf(event.target);
			if (!box || event.button !== 0 || box.getAttribute('aria-disabled') === 'true') return;
			if (box.classList.contains('spinbox--text')) return;
			box.setPointerCapture(event.pointerId);
			this.#drags.set(box, { pointerId: event.pointerId, lastX: event.clientX, distance: 0, dragging: false, before: valueOf(box), internal: valueOf(box) });
			box.focus();
			event.preventDefault();
		});

		this.on(this, 'pointermove', (event) => {
			const box = boxOf(event.target);
			const state = box ? this.#drags.get(box) : undefined;
			if (!box || !state || state.pointerId !== event.pointerId) return;
			const dx = event.clientX - state.lastX;
			state.lastX = event.clientX;
			if (!state.dragging) {
				state.distance += Math.abs(dx);
				if (state.distance > DRAG_TRIGGER) {
					state.dragging = true;
					box.classList.add('spinbox--active');
				}
				return;
			}
			this.#drag(box, state, dx);
		});

		const finish = (event: PointerEvent): void => {
			const box = boxOf(event.target);
			const state = box ? this.#drags.get(box) : undefined;
			if (!box || !state || state.pointerId !== event.pointerId) return;
			this.#drags.delete(box);
			if (box.hasPointerCapture(event.pointerId)) box.releasePointerCapture(event.pointerId);
			box.classList.remove('spinbox--active');
			if (event.type === 'pointercancel') return;
			if (state.dragging) {
				const range = rangeOf(box);
				if (range.delta > 0) this.#set(box, clamp(Math.round(valueOf(box) / range.delta) * range.delta, range));
			} else {
				this.#enterText(box);
			}
		};
		this.on(this, 'pointerup', finish);
		this.on(this, 'pointercancel', finish);

		this.on(this, 'keydown', (event) => {
			const box = boxOf(event.target);
			if (!box || box.getAttribute('aria-disabled') === 'true') return;
			const state = this.#drags.get(box);
			if (event.key === 'Escape' && state?.dragging) {
				this.#drags.delete(box);
				if (box.hasPointerCapture(state.pointerId)) box.releasePointerCapture(state.pointerId);
				box.classList.remove('spinbox--active');
				this.#set(box, state.before);
				event.preventDefault();
				return;
			}
			if (event.target !== box) return;
			const range = rangeOf(box);
			if (event.key === 'ArrowUp' || event.key === 'ArrowRight') this.#set(box, clamp(valueOf(box) + range.delta, range));
			else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') this.#set(box, clamp(valueOf(box) - range.delta, range));
			else if (event.key === 'Enter') this.#enterText(box);
			else return;
			event.preventDefault();
		});

		this.on(this, 'focusout', (event) => {
			if (event.target instanceof HTMLInputElement && event.target.classList.contains('spinbox__field')) {
				const box = boxOf(event.target);
				if (box) this.#exitText(box, true, false);
			}
		});
	}

	// The value change of one mouse move while dragging, from SSpinBox::OnMouseMove.
	#drag(box: HTMLElement, state: DragState, dx: number): void {
		const range = rangeOf(box);
		const width = Math.max(box.getBoundingClientRect().width, MIN_SLIDER_WIDTH);
		let next: number;
		if (range.bounded) {
			const step = range.max - range.min <= 10 ? 0.1 : 1;
			const filled = Math.min(width, Math.max(0, ((state.internal - range.min) / (range.max - range.min)) * width + dx * step));
			next = range.min + (filled / width) * (range.max - range.min);
		} else {
			const sign = dx > 0 ? 1 : -1;
			next = state.internal + sign * (Math.abs(dx) / width) * Math.max(Math.abs(state.internal), 1);
		}
		state.internal = clamp(next, range);
		this.#set(box, state.internal);
	}

	#set(box: HTMLElement, value: number): void {
		const before = valueOf(box);
		box.dataset.value = String(value);
		this.#render(box);
		if (value !== before) {
			const status = this.one('.spinbox-status');
			if (status) status.textContent = 'Last change: ' + format(value);
			this.emit('ue-spin-change', { value });
		}
	}

	#render(box: HTMLElement): void {
		const range = rangeOf(box);
		const value = valueOf(box);
		box.setAttribute('aria-valuenow', String(value));
		if (range.bounded) {
			box.setAttribute('aria-valuemin', String(range.min));
			box.setAttribute('aria-valuemax', String(range.max));
			box.style.setProperty('--spinbox-fill', String((value - range.min) / (range.max - range.min)));
		}
		const text = box.querySelector('.spinbox__text');
		if (text && !box.classList.contains('spinbox--text')) text.textContent = format(value);
	}

	#enterText(box: HTMLElement): void {
		const text = box.querySelector<HTMLElement>('.spinbox__text');
		if (!text) return;
		box.classList.add('spinbox--text');
		const field = document.createElement('input');
		field.className = 'spinbox__field';
		field.type = 'text';
		field.value = format(valueOf(box));
		field.setAttribute('aria-label', 'Value');
		text.replaceChildren(field);
		field.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				this.#exitText(box, true, true);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				this.#exitText(box, false, true);
			}
		});
		field.focus();
		field.select();
	}

	#exitText(box: HTMLElement, commit: boolean, refocus: boolean): void {
		const field = box.querySelector<HTMLInputElement>('.spinbox__field');
		if (!field || !box.classList.contains('spinbox--text')) return;
		const typed = Number(field.value.trim());
		box.classList.remove('spinbox--text');
		const range = rangeOf(box);
		if (commit && field.value.trim() !== '' && Number.isFinite(typed)) this.#set(box, clamp(typed, range));
		else this.#render(box);
		if (refocus) box.focus();
	}
}

define('ue-spin-box', UeSpinBoxElement);
