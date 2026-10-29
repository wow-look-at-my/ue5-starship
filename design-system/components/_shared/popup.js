// design-system/src/_shared/popup.ts
function enabledRows(menu, rowSelector) {
  return Array.from(menu.querySelectorAll(rowSelector)).filter((row) => row.getAttribute("aria-disabled") !== "true");
}
function moveRowFocus(rows, current, key) {
  if (rows.length === 0) return false;
  const index = current instanceof HTMLElement ? rows.indexOf(current) : -1;
  let next;
  if (key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % rows.length;
  else if (key === "ArrowUp") next = index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length;
  else if (key === "Home") next = 0;
  else if (key === "End") next = rows.length - 1;
  else return false;
  rows[next].focus();
  return true;
}
function rowLabel(row, labelSelector) {
  const label = row.querySelector(labelSelector);
  return (label ?? row).textContent?.trim() ?? "";
}
export {
  enabledRows,
  moveRowFocus,
  rowLabel
};
