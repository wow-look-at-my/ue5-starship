// <ue-tooltip> shows its .tooltip-popup after the Slate summon delay when the pointer or the keyboard focus enters it.
import { UeElement, define } from '../_shared/element.ts';
import { ownedBy } from '../_shared/own.ts';
import './Tooltip.css';

const SUMMON_DELAY = 150;
const INTRO = 100;
const OFFSET_X = 12; // ToolTipOffsetFromMouse, SlateApplication.cpp:549
const OFFSET_Y = 8;
const EDGE = 4;

interface Active {
	popup: HTMLElement;
	start: number;
	x: number;
	y: number;
}

export class UeTooltipElement extends UeElement {
	#active: Active | null = null;
	#suppressed = false;
	#frame = 0;
	#popup: HTMLElement | null = null;

	protected setup(): void {
		const popup = this.all('.tooltip-popup').find((candidate) => ownedBy(this, candidate));
		if (!popup) throw new Error('ue-tooltip needs a .tooltip-popup element');
		this.#popup = popup;
		const inTarget = (node: EventTarget | null): node is Element => ownedBy(this, node) && !popup.contains(node);

		this.on(this, 'pointerover', (event) => {
			if (!inTarget(event.target) || this.#suppressed || this.#active) return;
			this.#summon(event.clientX, event.clientY);
		});
		this.on(this, 'pointermove', (event) => {
			if (inTarget(event.target) && this.#active && this.#active.start >= 0) {
				this.#active.x = event.clientX;
				this.#active.y = event.clientY;
			}
		});
		this.on(this, 'pointerout', (event) => {
			if (!inTarget(event.target)) return;
			if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
			this.#suppressed = false;
			this.#dismiss();
		});
		this.on(this, 'pointerdown', (event) => {
			if (!inTarget(event.target)) return;
			this.#suppressed = true;
			this.#dismiss();
		});
		this.on(this, 'focusin', (event) => {
			const target = event.target;
			if (!inTarget(target) || !target.matches(':focus-visible') || this.#active) return;
			const rect = target.getBoundingClientRect();
			this.#summon(rect.left, rect.bottom - OFFSET_Y);
		});
		this.on(this, 'focusout', (event) => {
			if (inTarget(event.target)) this.#dismiss();
		});
		this.on(document, 'keydown', (event) => {
			if (event.key === 'Escape') this.#dismiss();
		});
		this.onDispose(() => this.#dismiss());
	}

	#summon(x: number, y: number): void {
		this.#dismiss();
		const popup = this.#popup;
		if (!popup) return;
		this.#active = { popup, start: performance.now(), x, y };
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
