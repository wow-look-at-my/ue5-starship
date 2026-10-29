// <ue-dock-tab> wraps one .dockTab. The enclosing <ue-tab-well> owns the behaviour; a pinned tab only draws.
import { UeElement, define } from '../_shared/element.ts';
import './DockTab.css';

class DockTabElement extends UeElement {
	protected setup(): void {}
}

define('ue-dock-tab', DockTabElement);
