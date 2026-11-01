<<<<<<< HEAD
// <ue-dock-tab> wraps one .dockTab. The enclosing <ue-tab-well> owns the behaviour; a pinned tab only draws.
import { UeElement, define } from '../_shared/element.ts';
import './DockTab.css';

class DockTabElement extends UeElement {
	protected setup(): void {}
=======
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
>>>>>>> origin/master
}

define('ue-dock-tab', DockTabElement);
