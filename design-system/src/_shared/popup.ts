// Keyboard helpers shared by the popup menus of the toolbar components.

// Rows a key press can reach: not marked aria-disabled.
export function enabledRows(menu: Element, rowSelector: string): HTMLElement[] {
	return Array.from(menu.querySelectorAll<HTMLElement>(rowSelector)).filter((row) => row.getAttribute('aria-disabled') !== 'true');
}

// Moves focus within a menu for ArrowDown, ArrowUp, Home and End. Returns true when the key was one of those.
export function moveRowFocus(rows: HTMLElement[], current: Element | null, key: string): boolean {
	if (rows.length === 0) return false;
	const index = current instanceof HTMLElement ? rows.indexOf(current) : -1;
	let next: number;
	if (key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % rows.length;
	else if (key === 'ArrowUp') next = index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length;
	else if (key === 'Home') next = 0;
	else if (key === 'End') next = rows.length - 1;
	else return false;
	rows[next].focus();
	return true;
}

// The visible label of a menu row, taken from its label element when it has one.
export function rowLabel(row: HTMLElement, labelSelector: string): string {
	const label = row.querySelector(labelSelector);
	return (label ?? row).textContent?.trim() ?? '';
}
