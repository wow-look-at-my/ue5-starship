// Arrow-key movement in a wrapping grid of tiles.

// The tile in the next row up or down whose centre is nearest in x. Returns undefined when no row lies that way.
export function nearestInRow(tiles: HTMLElement[], from: HTMLElement, down: boolean): HTMLElement | undefined {
	const tops = new Map(tiles.map((tile) => [tile, tile.getBoundingClientRect()]));
	const box = from.getBoundingClientRect();
	const rows = tiles.filter((tile) => {
		const top = tops.get(tile)?.top ?? box.top;
		return down ? top > box.top + 1 : top < box.top - 1;
	});
	if (rows.length === 0) return undefined;
	const edgeTops = rows.map((tile) => tops.get(tile)?.top ?? 0);
	const edge = down ? Math.min(...edgeTops) : Math.max(...edgeTops);
	const centre = box.left + box.width / 2;
	const distance = (tile: HTMLElement): number => {
		const rect = tops.get(tile);
		return rect ? Math.abs(rect.left + rect.width / 2 - centre) : Infinity;
	};
	const line = rows.filter((tile) => tops.get(tile)?.top === edge);
	return line.reduce((best, tile) => (distance(tile) < distance(best) ? tile : best));
}
