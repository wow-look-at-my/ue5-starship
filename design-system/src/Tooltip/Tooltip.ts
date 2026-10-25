// <ue-tooltip> shows the .tooltip-popup inside a .tooltip-target after the Slate summon delay and hides it again.
import { UeElement, define } from '../_shared/element.ts';

const SUMMON_DELAY = 150;
const INTRO = 100;
const OFFSET_X = 12; // ToolTipOffsetFromMouse, SlateApplication.cpp:549
const OFFSET_Y = 8;
const EDGE = 4;

interface Active {
	target: HTMLElement;
	popup: HTMLElement;
	start: number;
	x: number;
	y: number;
}

function targetOf(node: EventTarget | null): HTMLElement | null {
	return node instanceof Element ? node.closest<HTMLElement>('.tooltip-target') : null;
}

export class UeTooltipElement extends UeElement {
	#active: Active | null = null;
	#suppressed: HTMLElement | null = null;
	#frame = 0;

	protected setup(): void {
		this.on(this, 'pointerover', (event) => {
			const target = targetOf(event.target);
			if (!target || target === this.#suppressed || this.#active?.target === target) return;
			this.#summon(target, event.clientX, event.clientY);
		});
		this.on(this, 'pointermove', (event) => {
			const target = targetOf(event.target);
			if (target && this.#active?.target === target && this.#active.start >= 0) {
				this.#active.x = event.clientX;
				this.#active.y = event.clientY;
			}
		});
		this.on(this, 'pointerout', (event) => {
			const target = targetOf(event.target);
			if (!target) return;
			if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
			if (this.#suppressed === target) this.#suppressed = null;
			if (this.#active?.target === target) this.#dismiss();
		});
		this.on(this, 'pointerdown', (event) => {
			const target = targetOf(event.target);
			if (!target) return;
			this.#suppressed = target;
			this.#dismiss();
		});
		this.on(this, 'focusin', (event) => {
			const target = targetOf(event.target);
			if (!target || target !== event.target || !target.matches(':focus-visible') || this.#active?.target === target) return;
			const rect = target.getBoundingClientRect();
			this.#summon(target, rect.left, rect.bottom - OFFSET_Y);
		});
		this.on(this, 'focusout', (event) => {
			if (this.#active && targetOf(event.target) === this.#active.target) this.#dismiss();
		});
		this.on(document, 'keydown', (event) => {
			if (event.key === 'Escape') this.#dismiss();
		});
		this.onDispose(() => this.#dismiss());
	}

	#summon(target: HTMLElement, x: number, y: number): void {
		this.#dismiss();
		const popup = target.querySelector<HTMLElement>('.tooltip-popup');
		if (!popup) return;
		this.#active = { target, popup, start: performance.now(), x, y };
		this.#frame = requestAnimationFrame(this.#tick);
	}

	#dismiss(): void {
		cancelAnimationFrame(this.#frame);
		if (this.#active) {
			this.#active.popup.hidden = true;
			this.#active.popup.style.opacity = '0';
			this.#active = null;
		}
	}

	#tick = (now: number): void => {
		const active = this.#active;
		if (!active) return;
		const elapsed = now - active.start - SUMMON_DELAY;
		if (elapsed >= 0) {
			const popup = active.popup;
			popup.hidden = false;
			popup.style.opacity = String(Math.min(1, elapsed / INTRO));
			const width = popup.offsetWidth;
			const height = popup.offsetHeight;
			const left = Math.max(EDGE, Math.min(active.x + OFFSET_X, window.innerWidth - width - EDGE));
			const top = Math.max(EDGE, Math.min(active.y + OFFSET_Y, window.innerHeight - height - EDGE));
			popup.style.left = left + 'px';
			popup.style.top = top + 'px';
		}
		this.#frame = requestAnimationFrame(this.#tick);
	};
}

define('ue-tooltip', UeTooltipElement);
