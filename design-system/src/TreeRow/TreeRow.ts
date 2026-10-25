// <ue-tree-row> wraps a .tr-tree whose .tr-row children are a flat list; the depth of a row is its aria-level.
import { UeElement, define } from '../_shared/element.ts';
import { TreeController } from '../_shared/tree-controller.ts';

export class TreeRow extends UeElement {
	protected setup(): void {
		const tree = this.one('.tr-tree');
		if (!tree) return;
		const controller = new TreeController(tree, {
			row: '.tr-row',
			arrow: '.tr-arrow',
			folder: '.tr-icon.is-folder',
			caretOpen: 'tr-caret-down',
			caretClosed: 'tr-caret-right',
			folderOpen: 'tr-folder-open',
			folderClosed: 'tr-folder',
		});
		this.on(tree, 'click', (event) => {
			controller.click(event);
		});
		this.on(tree, 'dblclick', (event) => controller.doubleClick(event));
		this.on(tree, 'keydown', (event) => {
			controller.keyDown(event);
		});
		controller.refresh();
	}
}

define('ue-tree-row', TreeRow);
