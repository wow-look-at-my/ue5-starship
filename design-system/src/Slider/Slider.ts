// <ue-slider> is one .slider control that follows the pointer and the keyboard.
import { UeElement, define } from '../_shared/element.ts';
import './Slider.css';

const HANDLE = 8; // Icon8x8 thumb, StarshipCoreStyle.cpp:577

function attr(el: HTMLElement, name: string, fallback: number): number {
	const raw = el.dataset[name];
	const value = raw === undefined ? NaN : Number(raw);
	return Number.isFinite(value) ? value : fallback;
}

export class UeSliderElement extends UeElement {
	#dragging = new WeakSet<HTMLElement>();

	protected setup(): void {
		const slider = this.one('.slider[role="slider"]');
		if (!slider) throw new Error('ue-slider needs a .slider[role="slider"] element');
		this.#render(slider);

		this.on(slider, 'pointerdown', (event) => {
			if (event.button !== 0 || slider.getAttribute('aria-disabled') === 'true') return;
			slider.setPointerCapture(event.pointerId);
			this.#dragging.add(slider);
			slider.focus();
			this.#fromPointer(slider, event.clientX);
			event.preventDefault();
		});
		this.on(slider, 'pointermove', (event) => {
			if (this.#dragging.has(slider)) this.#fromPointer(slider, event.clientX);
		});
		const release = (event: PointerEvent): void => {
			this.#dragging.delete(slider);
			if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
		};
		this.on(slider, 'pointerup', release);
		this.on(slider, 'pointercancel', release);

		this.on(slider, 'keydown', (event) => {
			if (slider.getAttribute('aria-disabled') === 'true') return;
			const min = attr(slider, 'min', 0);
			const max = attr(slider, 'max', 1);
			const step = attr(slider, 'step', (max - min) / 100);
			const value = attr(slider, 'value', min);
			let next: number;
			switch (event.key) {
				case 'ArrowRight': case 'ArrowUp': next = value + step; break;
				case 'ArrowLeft': case 'ArrowDown': next = value - step; break;
				case 'PageUp': next = value + step * 10; break;
				case 'PageDown': next = value - step * 10; break;
				case 'Home': next = min; break;
				case 'End': next = max; break;
				default: return;
			}
			event.preventDefault();
			this.#set(slider, next);
		});
	}

	// The thumb centre runs from HANDLE to width minus HANDLE, SSlider.cpp:84-91.
	#fromPointer(slider: HTMLElement, clientX: number): void {
		const rect = slider.getBoundingClientRect();
		const travel = rect.width - 2 * HANDLE;
		const fraction = travel <= 0 ? 0 : (clientX - rect.left - HANDLE) / travel;
		const min = attr(slider, 'min', 0);
		const max = attr(slider, 'max', 1);
		this.#set(slider, min + Math.min(1, Math.max(0, fraction)) * (max - min));
	}

	#set(slider: HTMLElement, raw: number): void {
		const min = attr(slider, 'min', 0);
		const max = attr(slider, 'max', 1);
		const step = attr(slider, 'step', 0);
		let value = Math.min(max, Math.max(min, raw));
		if (step > 0) value = Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
		value = Math.round(value * 1e6) / 1e6;
		const changed = value !== attr(slider, 'value', min);
		slider.dataset.value = String(value);
		this.#render(slider);
		if (changed) this.emit('ue-slider-change', { value, text: step > 0 && step < 1 ? value.toFixed(2) : String(value) });
	}

	#render(slider: HTMLElement): void {
		const min = attr(slider, 'min', 0);
		const max = attr(slider, 'max', 1);
		const value = attr(slider, 'value', min);
		slider.setAttribute('aria-valuemin', String(min));
		slider.setAttribute('aria-valuemax', String(max));
		slider.setAttribute('aria-valuenow', String(value));
		slider.style.setProperty('--slider-value', String(max === min ? 0 : (value - min) / (max - min)));
	}
}

define('ue-slider', UeSliderElement);
