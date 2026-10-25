// <ue-segmented-control> wraps SegmentedControl rows: one checked segment per radiogroup, arrow keys move.
import { UeElement, define } from '../_shared/element.ts';

class UeSegmentedControl extends UeElement {
	protected setup(): void {
		for (const group of this.all('.SegmentedControl')) {
			this.on(group, 'click', (event) => {
				const seg = (event.target as Element).closest<HTMLElement>('.SegmentedControl-seg');
				if (seg && group.contains(seg)) this.select(group, seg, false);
			});
			this.on(group, 'keydown', (event) => {
				const segs = Array.from(group.querySelectorAll<HTMLElement>('.SegmentedControl-seg'));
				const at = segs.indexOf(document.activeElement as HTMLElement);
				if (at < 0) return;
				let next = -1;
				if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(at + 1, segs.length - 1);
				else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(at - 1, 0);
				else if (event.key === 'Home') next = 0;
				else if (event.key === 'End') next = segs.length - 1;
				if (next < 0) return;
				event.preventDefault();
				this.select(group, segs[next], true);
			});
		}
	}

	private select(group: Element, seg: HTMLElement, focus: boolean): void {
		for (const other of group.querySelectorAll<HTMLElement>('.SegmentedControl-seg')) {
			const on = other === seg;
			other.classList.toggle('is-checked', on);
			other.setAttribute('aria-checked', String(on));
			other.tabIndex = on ? 0 : -1;
		}
		if (focus) seg.focus();
		this.emit('ue-segment-change', { label: seg.textContent ?? '' });
	}
}

define('ue-segmented-control', UeSegmentedControl);
