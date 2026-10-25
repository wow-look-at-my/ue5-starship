// Behaviour of a small popup menu that is already in the markup: a trigger button and a hidden list of items.

export interface MenuWiring {
	trigger: HTMLElement;
	menu: HTMLElement;
	// Selects the focusable entries inside the menu. Separators and headings stay out of it.
	itemSelector: string;
	// Called when an item is chosen with the pointer or Enter or Space. The menu closes after it.
	onPick: (item: HTMLElement) => void;
	onOpenChange?: (open: boolean) => void;
}

export interface MenuHandle {
	open(): void;
	close(returnFocus: boolean): void;
	isOpen(): boolean;
	dispose(): void;
}

export function wireMenu(wiring: MenuWiring): MenuHandle {
	const { trigger, menu, itemSelector } = wiring;
	const items = (): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>(itemSelector));
	const isOpen = (): boolean => menu.classList.contains('is-open');

	const setOpen = (open: boolean): void => {
		menu.classList.toggle('is-open', open);
		trigger.setAttribute('aria-expanded', String(open));
		wiring.onOpenChange?.(open);
	};
	const open = (): void => {
		setOpen(true);
		const list = items();
		const start = list.find((item) => item.getAttribute('aria-checked') === 'true') ?? list[0];
		start?.focus();
	};
	const close = (returnFocus: boolean): void => {
		if (!isOpen()) return;
		setOpen(false);
		if (returnFocus) trigger.focus();
	};
	const move = (delta: number, absolute: number | null): void => {
		const list = items();
		const at = list.indexOf(document.activeElement as HTMLElement);
		const next = absolute ?? (at < 0 ? 0 : (at + delta + list.length) % list.length);
		list[next]?.focus();
	};
	const pick = (item: HTMLElement): void => {
		wiring.onPick(item);
		close(true);
	};

	const onTrigger = (): void => (isOpen() ? close(false) : open());
	const onTriggerKey = (event: KeyboardEvent): void => {
		if (event.key === 'ArrowDown' && !isOpen()) {
			event.preventDefault();
			open();
		}
	};
	const onMenuClick = (event: MouseEvent): void => {
		const item = (event.target as Element).closest<HTMLElement>(itemSelector);
		if (item && menu.contains(item)) pick(item);
	};
	const onMenuKey = (event: KeyboardEvent): void => {
		const active = document.activeElement as HTMLElement;
		if (event.key === 'ArrowDown') move(1, null);
		else if (event.key === 'ArrowUp') move(-1, null);
		else if (event.key === 'Home') move(0, 0);
		else if (event.key === 'End') move(0, items().length - 1);
		else if ((event.key === 'Enter' || event.key === ' ') && items().includes(active)) pick(active);
		else if (event.key === 'Escape') close(true);
		else if (event.key === 'Tab') close(false);
		else return;
		event.preventDefault();
		event.stopPropagation();
	};
	const onOutside = (event: Event): void => {
		const target = event.target as Node;
		if (isOpen() && !menu.contains(target) && !trigger.contains(target)) close(false);
	};

	trigger.addEventListener('click', onTrigger);
	trigger.addEventListener('keydown', onTriggerKey);
	menu.addEventListener('click', onMenuClick);
	menu.addEventListener('keydown', onMenuKey);
	document.addEventListener('pointerdown', onOutside);
	return {
		open,
		close,
		isOpen,
		dispose: () => {
			trigger.removeEventListener('click', onTrigger);
			trigger.removeEventListener('keydown', onTriggerKey);
			menu.removeEventListener('click', onMenuClick);
			menu.removeEventListener('keydown', onMenuKey);
			document.removeEventListener('pointerdown', onOutside);
		},
	};
}
