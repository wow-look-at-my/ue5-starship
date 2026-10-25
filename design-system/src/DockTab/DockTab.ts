// <ue-dock-tab> wraps one live .dockTab-stack and its reset button.
import { define } from '../_shared/element.ts';
import { TabStackElement, type TabStackNames } from '../_shared/tabstack.ts';

class DockTabElement extends TabStackElement {
	protected readonly names: TabStackNames = {
		stack: 'dockTab-stack',
		well: 'dockTab-well',
		tab: 'dockTab',
		close: 'dockTab-close',
		reset: 'dockTab-reset',
		foreground: 'dockTab--foreground',
		active: 'dockTab--active',
	};
}

define('ue-dock-tab', DockTabElement);
