// <ue-scrollbar> wraps one .sb-scroll box: a .sb-view that scrolls natively and a .sb bar whose .sb-thumb follows it.
import { UeElement, define } from '../_shared/element.ts';
import { bindBar } from '../_shared/scroll-thumb.ts';
import './Scrollbar.css';

export interface ScrollbarVisibilityDetail {
	visible: boolean;
}

export class Scrollbar extends UeElement {
	#visible: boolean | null = null;

	// True while the content overflows and the bar shows.
	get visible(): boolean {
		return this.#visible === true;
	}

	protected setup(): void {
		const box = this.all('.sb-scroll').find((candidate) => this.owns(candidate));
		const view = box?.querySelector<HTMLElement>(':scope > .sb-view');
		const bar = box?.querySelector<HTMLElement>(':scope > .sb');
		const thumb = bar?.querySelector<HTMLElement>('.sb-thumb');
		if (!view || !bar || !thumb) throw new Error('ue-scrollbar needs a .sb-scroll with a .sb-view and a .sb bar that holds a .sb-thumb');
		const vertical = !bar.classList.contains('sb-h');
		this.#visible = null;
		let started = false;
		const binding = bindBar(view, bar, thumb, vertical, (fits) => {
			if (started) this.#report(!fits);
		});
		this.onDispose(binding.dispose);
		// The first report waits until every element of the page has run its setup, so a sibling that listens for it sees it.
		const first = setTimeout(() => {
			started = true;
			this.#report(!bar.hidden);
		}, 0);
		this.onDispose(() => clearTimeout(first));
	}

	// Announces the first state and every change.
	#report(visible: boolean): void {
		if (this.#visible === visible) return;
		this.#visible = visible;
		this.emit<ScrollbarVisibilityDetail>('ue-scrollbar-visibility', { visible });
	}
}

define('ue-scrollbar', Scrollbar);
