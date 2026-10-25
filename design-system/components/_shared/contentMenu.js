// src/_shared/contentMenu.ts
var TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
function openMenu(host, anchor, options) {
  const menu = document.createElement("div");
  menu.className = options.prefix + "__menu";
  menu.setAttribute("role", "menu");
  const items = [];
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    document.removeEventListener("pointerdown", outside, true);
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
    options.onClose?.();
  };
  const outside = (event) => {
    const target = event.target;
    if (target instanceof Node && !menu.contains(target) && !anchor.contains(target)) close();
  };
  options.entries.forEach((entry, index) => {
    if (entry.separator) {
      const rule = document.createElement("div");
      rule.className = options.prefix + "__menusep";
      rule.setAttribute("role", "separator");
      menu.append(rule);
      return;
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = options.prefix + "__menuitem";
    item.tabIndex = -1;
    item.disabled = entry.disabled === true;
    if (entry.checkable) {
      item.setAttribute("role", "menuitemcheckbox");
      item.setAttribute("aria-checked", String(entry.checked === true));
    } else {
      item.setAttribute("role", "menuitem");
    }
    const check = document.createElement("span");
    check.className = options.prefix + "__menucheck";
    if (entry.checked) check.innerHTML = TICK;
    const label = document.createElement("span");
    label.textContent = entry.label ?? "";
    item.append(check, label);
    item.addEventListener("click", () => {
      close();
      anchor.focus();
      options.onPick(index);
    });
    items.push(item);
    menu.append(item);
  });
  menu.addEventListener("keydown", (event) => {
    const enabled = items.filter((item) => !item.disabled);
    const at = enabled.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = enabled[(at + 1) % enabled.length];
    else if (event.key === "ArrowUp") next = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      anchor.focus();
      return;
    } else if (event.key === "Tab") {
      close();
      return;
    } else return;
    event.preventDefault();
    next?.focus();
  });
  host.append(menu);
  const hostBox = host.getBoundingClientRect();
  const anchorBox = anchor.getBoundingClientRect();
  let left = anchorBox.left - hostBox.left;
  if (left + menu.offsetWidth > hostBox.width) left = Math.max(0, anchorBox.right - hostBox.left - menu.offsetWidth);
  menu.style.left = left + "px";
  menu.style.top = anchorBox.bottom - hostBox.top + "px";
  anchor.setAttribute("aria-expanded", "true");
  document.addEventListener("pointerdown", outside, true);
  items.find((item) => !item.disabled)?.focus();
  return { element: menu, anchor, close };
}
export {
  openMenu
};
