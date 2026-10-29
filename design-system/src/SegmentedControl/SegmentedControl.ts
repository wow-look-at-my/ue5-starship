// <ue-segmented-control> wraps one .SegmentedControl radiogroup: one checked segment, roving arrow keys.
import { UeElement, define } from '../_shared/element.ts';
import './SegmentedControl.css';

export interface SegmentChangeDetail {
	value: string;
	label: string;
}

class UeSegmentedControl extends UeElement {
	#group: HTMLElement | null = null;

	protected setup(): void {
		const group = this.all('.SegmentedControl').find((candidate) => this.owns(candidate));
		if (!group) throw new Error('ue-segmented-control needs a .SegmentedControl radiogroup');
		this.#group = group;
		group.setAttribute('role', 'radiogroup');
		this.on(group, 'click', (event) => {
			if (!this.owns(event.target)) return;
			const seg = (event.target as Element).closest<HTMLElement>('.SegmentedControl-seg');
			if (seg && group.contains(seg)) this.#select(seg, false);
		});
		this.on(group, 'keydown', (event) => {
			if (!this.owns(event.target)) return;
			const segs = this.#segs();
			const at = segs.indexOf(document.activeElement as HTMLElement);
			if (at < 0) return;
			let next = -1;
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(at + 1, segs.length - 1);
			else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(at - 1, 0);
			else if (event.key === 'Home') next = 0;
			else if (event.key === 'End') next = segs.length - 1;
			if (next < 0) return;
			event.preventDefault();
			this.#select(segs[next], true);
		});
	}

	#segs(): HTMLElement[] {
		return Array.from(this.#group?.querySelectorAll<HTMLElement>('.SegmentedControl-seg') ?? []);
	}

	// A segment is named by data-value, else aria-label, else its text.
	#valueOf(seg: HTMLElement): string {
		return seg.dataset.value ?? seg.getAttribute('aria-label') ?? (seg.textContent ?? '').trim();
	}

	#labelOf(seg: HTMLElement): string {
		return seg.getAttribute('aria-label') ?? (seg.textContent ?? '').trim();
	}

	// The value of the checked segment.
	get value(): string {
		const checked = this.#segs().find((seg) => seg.classList.contains('is-checked'));
		return checked ? this.#valueOf(checked) : '';
	}

	// Checks the segment with this value. It fires ue-segment-change when that changes the checked segment.
	set value(value: string) {
		const seg = this.#segs().find((candidate) => this.#valueOf(candidate) === value);
		if (seg) this.#select(seg, false);
	}

	#select(seg: HTMLElement, focus: boolean): void {
		const changed = !seg.classList.contains('is-checked');
		for (const other of this.#segs()) {
			const on = other === seg;
			other.classList.toggle('is-checked', on);
			other.setAttribute('aria-checked', String(on));
			other.tabIndex = on ? 0 : -1;
		}
		if (focus) seg.focus();
		if (changed) this.emit<SegmentChangeDetail>('ue-segment-change', { value: this.#valueOf(seg), label: this.#labelOf(seg) });
	}
}

define('ue-segmented-control', UeSegmentedControl);
