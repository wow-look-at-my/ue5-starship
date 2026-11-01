// design-system/src/_shared/tree-controller.ts
var TreeController = class {
  root;
  parts;
  hooks;
  #anchor = null;
  constructor(root, parts, hooks = {}) {
    this.root = root;
    this.parts = parts;
    this.hooks = hooks;
  }
  rows() {
    return Array.from(this.root.querySelectorAll(this.parts.row));
  }
  shown() {
    return this.rows().filter((row) => !row.hidden);
  }
  selected() {
    return this.rows().filter((row) => this.isSelected(row));
  }
  level(row) {
    return parseInt(row.getAttribute("aria-level") ?? "1", 10) || 1;
  }
  isSelected(row) {
    return row.classList.contains("is-selected");
  }
  isOpen(row) {
    return row.getAttribute("aria-expanded") === "true";
  }
  hasChildren(row) {
    if (this.hooks.lazy?.(row)) return true;
    const next = row.nextElementSibling;
    return next instanceof HTMLElement && next.matches(this.parts.row) && this.level(next) > this.level(row);
  }
  // Redraws every derived state from facts per row: aria-level, aria-expanded and the is-selected class.
  refresh() {
    const rows = this.rows();
    const parents = /* @__PURE__ */ new Set();
    rows.forEach((row, index) => {
      if (!this.isSelected(row)) return;
      let want = this.level(row);
      for (let j = index - 1; j >= 0 && want > 1; j--) {
        if (this.level(rows[j]) < want) {
          parents.add(rows[j]);
          want = this.level(rows[j]);
        }
      }
    });
    const shown = [];
    let hideBelow = Infinity;
    rows.forEach((row, index) => {
      const level = this.level(row);
      if (level > hideBelow) {
        row.hidden = true;
        return;
      }
      hideBelow = Infinity;
      const kids = index + 1 < rows.length && this.level(rows[index + 1]) > level || (this.hooks.lazy?.(row) ?? false);
      const stored = kids && this.isOpen(row);
      const open = stored || kids && (this.hooks.forceOpen?.(row) ?? false);
      const arrow = row.querySelector(this.parts.arrow);
      arrow?.classList.toggle("is-leaf", !kids);
      if (kids) {
        row.setAttribute("aria-expanded", stored ? "true" : "false");
        this.#swap(arrow, open ? this.parts.caretOpen : this.parts.caretClosed);
        if (!open) hideBelow = level;
      } else {
        row.removeAttribute("aria-expanded");
      }
      if (this.parts.openClass) row.classList.toggle(this.parts.openClass, open);
      this.#swap(row.querySelector(this.parts.folder), open ? this.parts.folderOpen : this.parts.folderClosed);
      row.setAttribute("aria-selected", this.isSelected(row) ? "true" : "false");
      if (this.hooks.excluded?.(row)) {
        row.hidden = true;
        return;
      }
      row.hidden = false;
      row.classList.toggle("is-odd", shown.length % 2 === 1);
      row.classList.toggle("is-parent", parents.has(row) && !this.isSelected(row));
      shown.push(row);
    });
    const current = shown.find((row) => row.tabIndex === 0) ?? shown.find((row) => this.isSelected(row)) ?? shown[0];
    for (const row of rows) row.tabIndex = row === current ? 0 : -1;
    this.hooks.changed?.();
  }
  setSelection(list, anchor) {
    const set = new Set(list);
    for (const row of this.rows()) row.classList.toggle("is-selected", set.has(row));
    if (anchor) this.#anchor = anchor;
    this.refresh();
    this.hooks.selected?.(this.selected());
  }
  setOpen(row, open) {
    const was = this.isOpen(row);
    row.setAttribute("aria-expanded", open ? "true" : "false");
    this.refresh();
    if (was !== open) this.hooks.toggled?.(row, open);
  }
  focusRow(row, reveal) {
    for (const other of this.rows()) other.tabIndex = other === row ? 0 : -1;
    row.focus({ preventScroll: true });
    if (reveal) row.scrollIntoView({ block: "nearest" });
  }
  // Plain: replace the selection. Shift: range from the anchor. Ctrl or cmd: toggle the row.
  pick(row, given, reveal) {
    const mods = this.hooks.multi === false ? { shiftKey: false, ctrlKey: false, metaKey: false } : given;
    const chosen = this.selected();
    const toggle = mods.ctrlKey || mods.metaKey;
    if (mods.shiftKey) {
      const list = this.shown();
      const from = list.indexOf(this.#anchor ?? row);
      const to = list.indexOf(row);
      const a = from < 0 ? to : from;
      const span = list.slice(Math.min(a, to), Math.max(a, to) + 1);
      this.setSelection(toggle ? chosen.concat(span) : span, null);
    } else if (toggle) {
      this.setSelection(this.isSelected(row) ? chosen.filter((r) => r !== row) : chosen.concat(row), row);
    } else {
      this.setSelection([row], row);
    }
    this.focusRow(row, reveal);
  }
  rowOf(target) {
    if (!(target instanceof Element)) return null;
    const row = target.closest(this.parts.row);
    return row && this.root.contains(row) ? row : null;
  }
  // Returns true when the click was on a row.
  click(event) {
    const row = this.rowOf(event.target);
    if (!row) return false;
    const arrow = event.target.closest(this.parts.arrow);
    if (arrow && !arrow.classList.contains("is-leaf")) {
      this.setOpen(row, !this.isOpen(row));
      this.focusRow(row, false);
      return true;
    }
    this.pick(row, event, false);
    return true;
  }
  doubleClick(event) {
    const row = this.rowOf(event.target);
    if (!row || event.target.closest(this.parts.arrow) || !this.hasChildren(row)) return;
    this.setOpen(row, !this.isOpen(row));
  }
  // Returns true when the key was handled.
  keyDown(event) {
    const row = this.rowOf(event.target);
    if (!row || event.altKey) return false;
    const list = this.shown();
    const i = list.indexOf(row);
    const kids = this.hasChildren(row);
    let target = null;
    switch (event.key) {
      case "ArrowDown":
        target = list[Math.min(i + 1, list.length - 1)];
        break;
      case "ArrowUp":
        target = list[Math.max(i - 1, 0)];
        break;
      case "Home":
        target = list[0];
        break;
      case "End":
        target = list[list.length - 1];
        break;
      case "ArrowLeft":
        if (kids && this.isOpen(row)) {
          this.setOpen(row, false);
        } else {
          for (let j = i - 1; j >= 0; j--) {
            if (this.level(list[j]) < this.level(row)) {
              target = list[j];
              break;
            }
          }
        }
        break;
      case "ArrowRight":
        if (kids && !this.isOpen(row)) this.setOpen(row, true);
        else if (kids) target = list[i + 1];
        break;
      case " ":
      case "Enter":
        this.pick(row, event, true);
        break;
      default:
        return false;
    }
    event.preventDefault();
    if (target) this.pick(target, { shiftKey: event.shiftKey, ctrlKey: false, metaKey: false }, true);
    return true;
  }
  #swap(svg, symbol) {
    const use = svg?.querySelector("use");
    if (use) use.setAttribute("href", "#" + symbol);
  }
};
export {
  TreeController
};
