// <ue-status-bar> wraps a .statusBar strip: drawer ue-buttons (one open at a time), the Cmd ue-combo-button and the console ue-text-input with its history.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';
import '../TextInput/TextInput.ts';

const DRAWER = '.statusBar-seg--drawer .button';
const MAX_LINES = 4;

export class StatusBar extends UeElement {
	protected setup(): void {
		const field = this.one<HTMLInputElement>('.statusBar-console .textinput__field');
		const history = this.one('.statusBar-history');
		const recalled: string[] = [];
		let recallIndex = 0;

		const run = (command: string): void => {
			if (history) {
				const line = document.createElement('div');
				line.className = 'statusBar-history-line';
				line.textContent = '> ' + command;
				history.append(line);
				while (history.children.length > MAX_LINES) history.firstElementChild?.remove();
			}
			recalled.push(command);
			recallIndex = recalled.length;
			this.emit('ue-command', { command });
		};

		this.on(this, 'ue-button-click', (event) => {
			const button = event.target instanceof Element ? event.target.querySelector<HTMLElement>('.button') : null;
			if (!button?.closest('.statusBar-seg--drawer')) return;
			const detail = (event as CustomEvent<{ label: string; pressed: boolean | null }>).detail;
			for (const other of this.all(DRAWER)) {
				if (other !== button) other.setAttribute('aria-pressed', 'false');
			}
			this.emit('ue-drawer-change', { drawer: detail.pressed ? detail.label : null });
		});

		this.on(this, 'ue-combo-pick', (event) => {
			if (!(event.target instanceof Element) || !event.target.closest('.statusBar-console')) return;
			this.emit('ue-executor-change', { executor: (event as CustomEvent<{ label: string }>).detail.label });
		});

		if (!field) return;
		this.on(field, 'keydown', (event) => {
			if (event.key === 'Enter') {
				const command = field.value.trim();
				event.preventDefault();
				if (command === '') return;
				run(command);
				field.value = '';
			} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
				event.preventDefault();
				recallIndex = Math.min(Math.max(recallIndex + (event.key === 'ArrowUp' ? -1 : 1), 0), recalled.length);
				field.value = recalled[recallIndex] ?? '';
			}
		});
	}
}

define('ue-status-bar', StatusBar);
