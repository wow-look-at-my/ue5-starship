// <ue-dock-tab> wraps one live .dockTab-stack and its reset button.
import { define } from '../_shared/element.ts';
import { TabStackElement, type TabStackNames } from '../_shared/tabstack.ts';
import '../TabWell/TabWell.css';
import './DockTab.css';

class DockTabElement extends TabStackElement {
	protected readonly names: TabStackNames = {
		stack: 'dockTab-stack',
		well: 'dockTab-well',
		tab: 'dockTab',
		label: 'dockTab-label',
		close: 'dockTab-close',
		reset: 'dockTab-reset',
		foreground: 'dockTab--foreground',
		active: 'dockTab--active',
	};
}

define('ue-dock-tab', DockTabElement);
