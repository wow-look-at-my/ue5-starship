// <ue-window-chrome> wraps one live .windowChrome-frame, its restore button and its status line.
import { UeElement, define } from '../_shared/element.ts';

const MAXIMIZE_GLYPH = '#windowChrome-i-max';
const RESTORE_GLYPH = '#windowChrome-i-restore';

class WindowChromeElement extends UeElement {
	protected setup(): void {
		const frame = this.one('.windowChrome-frame');
		if (!frame) throw new Error('ue-window-chrome needs a .windowChrome-frame child');
		const status = this.one('.windowChrome-status');
		const reopen = this.one('.windowChrome-reopen');

		// SWindowTitleBar.cpp:553-555 reads the active state of the native window. A window is active while focus sits inside its frame.
		const setActive = (active: boolean): void => {
			frame.dataset.active = String(active);
			if (status) status.textContent = active ? 'Window active' : 'Window inactive';
		};
		setActive(frame.contains(document.activeElement));
		this.on(this, 'focusin', () => setActive(frame.contains(document.activeElement)));
		this.on(this, 'focusout', (event) => setActive(event.relatedTarget instanceof Node && frame.contains(event.relatedTarget)));

		const hideWindow = (label: string): void => {
			frame.hidden = true;
			if (!reopen) return;
			reopen.textContent = label;
			reopen.hidden = false;
			reopen.focus();
		};
		const toggleMaximized = (button: HTMLElement): void => {
			const maximized = frame.toggleAttribute('data-maximized');
			button.querySelector('use')?.setAttribute('href', maximized ? RESTORE_GLYPH : MAXIMIZE_GLYPH);
			// SWindowTitleBar::GetMaximizeButtonToolTip, SWindowTitleBar.cpp:587-597.
			const label = maximized ? 'Restore Down' : 'Maximize';
			button.setAttribute('aria-label', label);
			button.title = label;
		};

		this.on(this, 'click', (event) => {
			const target = event.target instanceof Element ? event.target : null;
			if (target?.closest('.windowChrome-reopen')) {
				frame.hidden = false;
				if (reopen) reopen.hidden = true;
				frame.focus();
				return;
			}
			const button = target?.closest<HTMLElement>('.windowChrome-btn');
			if (!button || !frame.contains(button)) return;
			const action = button.dataset.action;
			if (action === 'minimize') hideWindow('Window minimized: restore');
			else if (action === 'maximize') toggleMaximized(button);
			else if (action === 'close') hideWindow('Window closed: reopen');
		});
	}
}

define('ue-window-chrome', WindowChromeElement);
