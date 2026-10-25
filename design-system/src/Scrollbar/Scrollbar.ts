// <ue-scrollbar> wraps one or more .sb-scroll boxes: a .sb-view that scrolls natively and a .sb bar whose .sb-thumb follows it.
import { UeElement, define } from '../_shared/element.ts';
import { bindBar } from '../_shared/scroll-thumb.ts';

export class Scrollbar extends UeElement {
	protected setup(): void {
		for (const box of this.all('.sb-scroll')) {
			const view = box.querySelector<HTMLElement>('.sb-view');
			const bar = box.querySelector<HTMLElement>('.sb');
			const thumb = bar?.querySelector<HTMLElement>('.sb-thumb');
			if (!view || !bar || !thumb) continue;
			const vertical = !bar.classList.contains('sb-h');
			this.onDispose(bindBar(view, bar, thumb, vertical).dispose);
		}
	}
}

define('ue-scrollbar', Scrollbar);
