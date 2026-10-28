// <ue-cover> names each colour strip of the title card with its token, as a hover tooltip.
import { UeElement, define } from '../_shared/element.ts';

const TOKENS: Record<string, string> = {
	primary: 'primary',
	panel: 'panel',
	inactive: 'select-inactive',
	folder: 'accent-folder',
	green: 'accent-green',
	header: 'header',
};

export class UeCoverElement extends UeElement {
	protected setup(): void {
		for (const strip of this.all<SVGRectElement>('rect.tile')) {
			const token = Object.keys(TOKENS).find((name) => strip.classList.contains(name));
			if (!token || strip.querySelector('title')) continue;
			const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
			title.textContent = TOKENS[token];
			strip.append(title);
		}
	}
}

define('ue-cover', UeCoverElement);
