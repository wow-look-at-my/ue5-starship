// <ue-tab-well> wraps one live .tabWell-stack and its reset button.
import { define } from '../_shared/element.ts';
import { TabStackElement, type TabStackNames } from '../_shared/tabstack.ts';

class TabWellElement extends TabStackElement {
	protected readonly names: TabStackNames = {
		stack: 'tabWell-stack',
		well: 'tabWell-well',
		tab: 'tabWell-tab',
		close: 'tabWell-close',
		reset: 'tabWell-reset',
		foreground: 'tabWell-tab--foreground',
		active: 'tabWell-tab--active',
	};
}

define('ue-tab-well', TabWellElement);
