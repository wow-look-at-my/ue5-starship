// <ue-status-bar> wraps a .statusBar strip: drawer buttons, the Cmd menu and the console box with its history.
import { UeElement, define } from '../_shared/element.ts';
import { enabledRows, moveRowFocus } from '../_shared/popup.ts';

const DRAWER = '.statusBar-btn';
const COMBO = '.statusBar-combo';
const MENU = '.statusBar-menu';
const ROW = '.statusBar-row';
const MAX_LINES = 4;

export class StatusBar extends UeElement {
	protected setup(): void {
		const field = this.one<HTMLInputElement>('.statusBar-field');
		const history = this.one('.statusBar-history');
		const recalled: string[] = [];
		let recallIndex = 0;

		const openMenu = (): HTMLElement | null => this.one(MENU + '.is-open');
		const comboOf = (menu: Element): HTMLElement | null => menu.parentElement?.querySelector<HTMLElement>(COMBO) ?? null;

		const close = (restoreFocus: boolean): void => {
			const menu = openMenu();
			if (!menu) return;
			menu.classList.remove('is-open');
			const combo = comboOf(menu);
			if (!combo) return;
			combo.setAttribute('aria-expanded', 'false');
			if (restoreFocus) combo.focus();
		};

		const open = (combo: HTMLElement, focusFirst: boolean): void => {
			const menu = combo.parentElement?.querySelector<HTMLElement>(MENU);
			if (!menu) return;
			close(false);
			menu.classList.add('is-open');
			combo.setAttribute('aria-expanded', 'true');
			if (!focusFirst) return;
			const rows = enabledRows(menu, ROW);
			if (rows.length > 0) rows[0].focus();
		};

		const toggleDrawer = (button: HTMLElement): void => {
			const bar = button.closest('.statusBar');
			const opening = !button.classList.contains('is-open');
			if (bar) {
				for (const other of Array.from(bar.querySelectorAll<HTMLElement>(DRAWER))) {
					other.classList.remove('is-open');
					other.setAttribute('aria-expanded', 'false');
				}
			}
			if (opening) {
				button.classList.add('is-open');
				button.setAttribute('aria-expanded', 'true');
			}
			const label = button.querySelector('.statusBar-txt')?.textContent ?? '';
			this.emit('ue-drawer-change', { drawer: opening ? label : null });
		};

		const choose = (row: HTMLElement): void => {
			const label = row.textContent?.trim() ?? '';
			for (const other of Array.from(row.parentElement?.querySelectorAll<HTMLElement>(ROW) ?? [])) {
				other.setAttribute('aria-checked', String(other === row));
			}
			const combo = comboOf(row.closest(MENU) ?? row);
			const text = combo?.querySelector('.statusBar-txt');
			if (text) text.textContent = label;
			this.emit('ue-executor-change', { executor: label });
			close(true);
		};

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

		this.on(this, 'click', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const row = target.closest<HTMLElement>(ROW);
			if (row) {
				choose(row);
				return;
			}
			const drawer = target.closest<HTMLElement>(DRAWER);
			if (drawer && this.contains(drawer)) {
				toggleDrawer(drawer);
				return;
			}
			const combo = target.closest<HTMLElement>(COMBO + '.statusBar-cmd');
			if (!combo) return;
			if (combo.getAttribute('aria-expanded') === 'true') close(false);
			else open(combo, false);
		});

		this.on(this, 'pointerover', (event) => {
			const row = event.target instanceof Element ? event.target.closest<HTMLElement>(ROW) : null;
			if (row) row.focus({ preventScroll: true });
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const key = event.key;
			if (target === field && field) {
				if (key === 'Enter') {
					const command = field.value.trim();
					event.preventDefault();
					if (command === '') return;
					run(command);
					field.value = '';
				} else if (key === 'ArrowUp' || key === 'ArrowDown') {
					event.preventDefault();
					recallIndex = Math.min(Math.max(recallIndex + (key === 'ArrowUp' ? -1 : 1), 0), recalled.length);
					field.value = recalled[recallIndex] ?? '';
				}
				return;
			}
			const row = target.closest<HTMLElement>(ROW);
			if (row) {
				if (key === 'Escape') {
					event.preventDefault();
					close(true);
				} else if (key === 'Tab') close(false);
				else if (moveRowFocus(enabledRows(row.closest(MENU) ?? row, ROW), row, key)) event.preventDefault();
				else if (key === 'Enter' || key === ' ') {
					event.preventDefault();
					row.click();
				}
				return;
			}
			if (key === 'Escape' && openMenu()) {
				event.preventDefault();
				close(true);
			} else if ((key === 'Enter' || key === ' ') && target.matches(DRAWER + ', ' + COMBO)) {
				event.preventDefault();
				target.click();
			} else if ((key === 'ArrowUp' || key === 'ArrowDown') && target.matches(COMBO + '.statusBar-cmd')) {
				event.preventDefault();
				open(target, true);
			}
		});

		this.on(document, 'pointerdown', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const menu = openMenu();
			if (!menu || menu.contains(target)) return;
			const combo = comboOf(menu);
			if (combo && combo.contains(target)) return;
			close(false);
		});
	}
}

define('ue-status-bar', StatusBar);
