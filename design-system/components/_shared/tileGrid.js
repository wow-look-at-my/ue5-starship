// design-system/src/_shared/tileGrid.ts
function nearestInRow(tiles, from, down) {
  const tops = new Map(tiles.map((tile) => [tile, tile.getBoundingClientRect()]));
  const box = from.getBoundingClientRect();
  const rows = tiles.filter((tile) => {
    const top = tops.get(tile)?.top ?? box.top;
    return down ? top > box.top + 1 : top < box.top - 1;
  });
  if (rows.length === 0) return void 0;
  const edgeTops = rows.map((tile) => tops.get(tile)?.top ?? 0);
  const edge = down ? Math.min(...edgeTops) : Math.max(...edgeTops);
  const centre = box.left + box.width / 2;
  const distance = (tile) => {
    const rect = tops.get(tile);
    return rect ? Math.abs(rect.left + rect.width / 2 - centre) : Infinity;
  };
  const line = rows.filter((tile) => tops.get(tile)?.top === edge);
  return line.reduce((best, tile) => distance(tile) < distance(best) ? tile : best);
}
export {
  nearestInRow
};
