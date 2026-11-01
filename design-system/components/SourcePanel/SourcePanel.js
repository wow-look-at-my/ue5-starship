// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
<<<<<<< HEAD
  #ready = false;
  #pendingSetup = null;
  // The bundle can load before the parser reaches this element's children, so setup waits for the document to finish parsing.
  // A pinned specimen (data-pinned on the element or an ancestor) keeps its authored markup: setup never runs.
  connectedCallback() {
    this.style.display = "contents";
    if (this.closest("[data-pinned]")) return;
    if (document.readyState !== "loading") {
      this.#start();
      return;
    }
    this.#pendingSetup = () => this.#start();
    document.addEventListener("DOMContentLoaded", this.#pendingSetup, { once: true });
  }
  disconnectedCallback() {
    if (this.#pendingSetup) document.removeEventListener("DOMContentLoaded", this.#pendingSetup);
    this.#pendingSetup = null;
    this.#ready = false;
    for (const dispose of this.#disposers.splice(0)) dispose();
  }
  #start() {
    this.#pendingSetup = null;
    if (this.#ready || !this.isConnected) return;
    this.#ready = true;
    this.setup();
  }
=======
  connectedCallback() {
    this.style.display = "contents";
    this.setup();
  }
  disconnectedCallback() {
    for (const dispose of this.#disposers.splice(0)) dispose();
  }
>>>>>>> origin/master
  on(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.#disposers.push(() => target.removeEventListener(type, listener, options));
  }
  // Registers a cleanup that runs when the element disconnects.
  onDispose(dispose) {
    this.#disposers.push(dispose);
  }
  emit(name, detail) {
    return this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
<<<<<<< HEAD
  // True when the nearest element of this tag above the target is this element, so a nested instance keeps its own events.
  owns(target) {
    return target instanceof Element && target.closest(this.localName) === this;
  }
=======
>>>>>>> origin/master
  all(selector) {
    return Array.from(this.querySelectorAll(selector));
  }
  one(selector) {
    return this.querySelector(selector);
  }
};
function define(tag, ctor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

<<<<<<< HEAD
// design-system/src/_shared/own.ts
function ownedBy(host, target) {
  return target instanceof Element && target.closest(host.localName) === host;
}

// design-system/src/Button/Button.ts
var PRESSED = "button--pressed";
function isDisabled(button) {
  return button.matches(":disabled") || button.getAttribute("aria-disabled") === "true";
}
var UeButtonElement = class extends UeElement {
  #clicks = 0;
  setup() {
    const button = this.one(".button");
    if (!button) throw new Error("ue-button needs a .button element");
    this.on(button, "keydown", (event) => {
      if (!ownedBy(this, event.target) || isDisabled(button) || event.repeat) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      button.classList.add(PRESSED);
      if (button.tagName !== "BUTTON") {
        event.preventDefault();
        if (event.key === "Enter") button.click();
      }
    });
    this.on(button, "keyup", (event) => {
      const wasPressed = button.classList.contains(PRESSED);
      button.classList.remove(PRESSED);
      if (wasPressed && button.tagName !== "BUTTON" && event.key === " ") button.click();
    });
    this.on(button, "focusout", () => button.classList.remove(PRESSED));
    this.on(button, "click", () => {
      if (isDisabled(button)) return;
      let pressed = null;
      if (button.hasAttribute("aria-pressed")) {
        pressed = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(pressed));
      }
      this.#clicks++;
      this.emit("ue-button-click", { label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "", pressed, count: this.#clicks });
    });
  }
};
define("ue-button", UeButtonElement);

// design-system/src/ExpandableArea/ExpandableArea.ts
var INTERACTIVE = 'button, a[href], input, select, textarea, label, [tabindex], [role="button"], [role="checkbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="menuitem"]';
function isNestedControl(target, header) {
  for (let node = target; node && node !== header; node = node.parentElement) {
    if (node.localName.startsWith("ue-") || node.matches(INTERACTIVE)) return true;
  }
  return false;
}
var UeExpandableAreaElement = class extends UeElement {
  setup() {
    const header = this.one('.expandablearea__header[role="button"]');
    if (!header) throw new Error('ue-expandable-area needs a .expandablearea__header[role="button"]');
    this.#apply(header, header.getAttribute("aria-expanded") === "true", false);
    this.on(header, "click", (event) => {
      if (ownedBy(this, event.target) && !isNestedControl(event.target, header)) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
    });
    this.on(header, "keydown", (event) => {
      if (header !== event.target || event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
    });
  }
  #apply(header, expanded, announce) {
    header.setAttribute("aria-expanded", String(expanded));
    const body = header.parentElement?.querySelector(":scope > .expandablearea__body");
    if (body) body.hidden = !expanded;
    if (announce) this.emit("ue-expand-toggle", { expanded });
  }
};
define("ue-expandable-area", UeExpandableAreaElement);

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

// design-system/src/TreeRow/TreeRow.ts
var ARROW = '<svg class="tr-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4.5 4L6 12z"/></svg>';
var FOLDER = '<svg class="tr-icon is-folder" viewBox="0 0 16 16" aria-hidden="true"><path class="tr-folder-closed" d="M1.5 4.25v7.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H8l-1.2-1.5H2.5a1 1 0 0 0-1 1z"/><path class="tr-folder-open" d="M1.25 4.25v7.5a1 1 0 0 0 1 1h10.6l1.9-5.2a.8.8 0 0 0-.75-1.1H4.95l-1.4 4.3v-6.5a1 1 0 0 1 1-1h2l1.2 1.5h5.5"/></svg>';
var OBJECT = '<svg class="tr-icon is-object" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l5.5 3.1v6.2L8 14.2 2.5 11.1V4.9zM2.5 4.9L8 8l5.5-3.1M8 8v6.2"/></svg>';
var TreeRow = class extends UeElement {
  #tree = null;
  #controller = null;
  #filter = null;
  #kept = /* @__PURE__ */ new Set();
  #parentsOfKept = /* @__PURE__ */ new Set();
  #lastIds = "";
  setup() {
    const tree = this.#ownTree() ?? this.#createTree();
    this.#tree = tree;
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-multiselectable", String(!this.#single()));
    const controller = new TreeController(
      tree,
      {
        row: ".tr-row",
        arrow: ".tr-arrow",
        folder: ".tr-icon.is-folder",
        caretOpen: "",
        caretClosed: "",
        folderOpen: "",
        folderClosed: "",
        openClass: "is-open"
      },
      {
        multi: !this.#single(),
        excluded: (row) => this.#filter !== null && !this.#kept.has(row),
        forceOpen: (row) => this.#filter !== null && this.#parentsOfKept.has(row),
        lazy: (row) => row.dataset.expandable === "true",
        toggled: (row, open) => {
          this.emit("ue-tree-toggle", { id: this.#idOf(row), expanded: open });
          if (!open && this.hasAttribute("collapse-selects") && this.#rows().some((each) => each.hidden && this.#controller?.isSelected(each))) this.select([this.#idOf(row)]);
        },
        selected: () => this.#announceSelection()
      }
    );
    this.#controller = controller;
    const live = (target) => this.owns(target) && !target.closest("[data-tr-inert]");
    this.on(tree, "click", (event) => {
      if (live(event.target)) controller.click(event);
    });
    this.on(tree, "dblclick", (event) => {
      if (live(event.target)) controller.doubleClick(event);
    });
    this.on(tree, "keydown", (event) => {
      if (this.owns(event.target)) controller.keyDown(event);
    });
    this.#lastIds = this.getSelectedIds().join("\n");
    controller.refresh();
  }
  #single() {
    return this.getAttribute("select") === "single";
  }
  // The first tree below this element that no nested instance owns.
  #ownTree() {
    return this.all(".tr-tree").find((tree) => tree.closest(this.localName) === this) ?? null;
  }
  #createTree() {
    const tree = document.createElement("div");
    tree.className = "tr-tree";
    this.append(tree);
    return tree;
  }
  #rows() {
    return this.#controller?.rows() ?? [];
  }
  #idOf(row) {
    return row.dataset.id ?? (row.querySelector(".tr-text")?.textContent ?? "").trim();
  }
  #rowOf(id) {
    return this.#rows().find((row) => this.#idOf(row) === id);
  }
  #info(row) {
    return { id: this.#idOf(row), label: (row.querySelector(".tr-text")?.textContent ?? "").trim(), depth: (this.#controller?.level(row) ?? 1) - 1, element: row };
  }
  #announceSelection() {
    const ids = this.getSelectedIds();
    const key = ids.join("\n");
    if (key === this.#lastIds) return;
    this.#lastIds = key;
    this.emit("ue-tree-select", { ids });
  }
  // Ids of the selected rows in tree order.
  getSelectedIds() {
    return this.#rows().filter((row) => row.classList.contains("is-selected")).map((row) => this.#idOf(row));
  }
  // Selects exactly these rows. Ids that name no row are ignored.
  select(ids) {
    const controller = this.#controller;
    if (!controller) return;
    const wanted = new Set(this.#single() ? ids.slice(0, 1) : ids);
    const rows = this.#rows().filter((row) => wanted.has(this.#idOf(row)));
    controller.setSelection(rows, rows[rows.length - 1] ?? null);
  }
  // Opens or closes one row.
  setExpanded(id, expanded) {
    const row = this.#rowOf(id);
    if (row && this.#controller?.hasChildren(row)) this.#controller.setOpen(row, expanded);
  }
  // Replaces every row with rows drawn from data.
  setRows(rows) {
    const tree = this.#tree;
    const controller = this.#controller;
    if (!tree || !controller) return;
    tree.replaceChildren(...rows.map((data) => this.#draw(data)));
    this.#lastIds = this.getSelectedIds().join("\n");
    this.#refilter();
    controller.refresh();
  }
  // Adds one row after the last row. It does not touch the selection.
  appendRow(data) {
    if (!this.#tree || !this.#controller) return;
    this.#tree.append(this.#draw(data));
    this.#refilter();
    this.#controller.refresh();
  }
  #draw(data) {
    const depth = data.depth ?? 0;
    const row = document.createElement("div");
    row.className = "tr-row" + (data.selected ? " is-selected" : "") + (data.dim ? " is-dim" : "");
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(depth + 1));
    row.setAttribute("aria-expanded", data.expanded ? "true" : "false");
    row.dataset.id = data.id;
    if (data.expandable) row.dataset.expandable = "true";
    const icon = data.icon ?? "object";
    const cells = (data.cells ?? []).map(() => '<span class="tr-cell"></span>').join("");
    row.innerHTML = '<span class="tr-indent" style="--depth:' + depth + '"></span>' + ARROW + (icon === "folder" ? FOLDER : icon === "object" ? OBJECT : "") + '<span class="tr-text"></span>' + cells;
    const text = row.querySelector(".tr-text");
    if (text) text.textContent = data.label;
    const cellEls = row.querySelectorAll(".tr-cell");
    (data.cells ?? []).forEach((value, i) => {
      cellEls[i].textContent = value;
    });
    return row;
  }
  // Sorts the children of every parent with compare. A row keeps its subtree. Selection and open state stay.
  sortChildren(compare) {
    const tree = this.#tree;
    const controller = this.#controller;
    if (!tree || !controller) return;
    const roots = [];
    const stack = [];
    for (const row of this.#rows()) {
      const node = { row, kids: [] };
      const level = controller.level(row);
      stack.length = level - 1;
      (stack[level - 2]?.kids ?? roots).push(node);
      stack[level - 1] = node;
    }
    const flat = [];
    const walk = (list) => {
      list.sort((a, b) => compare(this.#info(a.row), this.#info(b.row)));
      for (const node of list) {
        flat.push(node.row);
        walk(node.kids);
      }
    };
    walk(roots);
    tree.append(...flat);
    controller.refresh();
  }
  // Shows only the rows the filter accepts and their ancestors. Ancestors open while the filter is set. Null clears it.
  setFilter(filter) {
    if (typeof filter === "string") {
      const needle = filter.trim().toLowerCase();
      this.#filter = needle === "" ? null : (row) => row.label.toLowerCase().includes(needle);
    } else {
      this.#filter = filter;
    }
    this.#refilter();
    this.#controller?.refresh();
  }
  #refilter() {
    this.#kept = /* @__PURE__ */ new Set();
    this.#parentsOfKept = /* @__PURE__ */ new Set();
    const filter = this.#filter;
    const controller = this.#controller;
    if (!filter || !controller) return;
    const rows = this.#rows();
    rows.forEach((row, index) => {
      if (!filter(this.#info(row))) return;
      this.#kept.add(row);
      let want = controller.level(row);
      for (let j = index - 1; j >= 0 && want > 1; j--) {
        const level = controller.level(rows[j]);
        if (level < want) {
          this.#kept.add(rows[j]);
          this.#parentsOfKept.add(rows[j]);
          want = level;
        }
      }
    });
  }
};
define("ue-tree-row", TreeRow);

// design-system/src/SourcePanel/SourcePanel.ts
var SourcePanelElement = class extends UeElement {
  #trees = [];
  #collections = 0;
  setup() {
    this.#trees = this.all("ue-tree-row").filter((tree) => this.owns(tree));
    this.#collections = this.#tree("collections")?.querySelectorAll(".tr-row").length ?? 0;
    for (const area of this.#areas()) this.#markCollapsed(area);
    this.on(this, "ue-tree-select", (event) => {
      const tree = event.target;
      if (!this.owns(tree) || !(tree instanceof TreeRow)) return;
      const [id] = event.detail.ids;
      if (id === void 0) return;
      for (const other of this.#trees) if (other !== tree) other.select([]);
      const name = tree.querySelector(".tr-row.is-selected .tr-text")?.textContent ?? "";
      this.emit("sourcepanel:select", { id, name });
    });
    this.on(this, "ue-expand-toggle", (event) => {
      if (!this.owns(event.target)) return;
      const area = event.target.querySelector(".SourcePanel__area");
      if (area) this.#markCollapsed(area);
    });
    this.on(this, "ue-button-click", (event) => {
      if (!this.owns(event.target)) return;
      if (event.target.dataset.action === "add-collection") this.#addCollection();
    });
  }
  // Replaces the rows of the tree named by its `data-tree` attribute.
  setRows(tree, rows) {
    this.#tree(tree)?.setRows(rows);
  }
  // Selects the row with this id in whichever tree holds it. The other trees lose their selection.
  select(id) {
    for (const tree of this.#trees) tree.select([id]);
  }
  // Opens or closes the row with this id.
  setExpanded(id, expanded) {
    for (const tree of this.#trees) tree.setExpanded(id, expanded);
  }
  #tree(name) {
    return this.#trees.find((tree) => tree.dataset.tree === name);
  }
  #areas() {
    return this.all(".SourcePanel__area").filter((area) => this.owns(area));
  }
  // The area class `is-collapsed` lets a filling area give its height back.
  #markCollapsed(area) {
    area.classList.toggle("is-collapsed", area.querySelector(".expandablearea__header")?.getAttribute("aria-expanded") !== "true");
  }
  #addCollection() {
    const tree = this.#tree("collections");
    if (!tree) return;
    const header = tree.closest(".SourcePanel__area")?.querySelector(".expandablearea__header");
    if (header?.getAttribute("aria-expanded") !== "true") header?.click();
    const label = "NewCollection" + (this.#collections + 1);
    this.#collections++;
    const id = "Collections/" + label;
    tree.appendRow({ id, label, icon: "folder", depth: 0 });
    this.select(id);
  }
};
define("ue-source-panel", SourcePanelElement);
export {
  SourcePanelElement
};
=======
// design-system/src/SourcePanel/SourcePanel.ts
var ROW = ".SourcePanel__row";
var SELECTED = "SourcePanel__row--selected";
var PARENT = "SourcePanel__row--parent";
var INDENT_PX = 10;
var SourcePanelElement = class extends UeElement {
  #root;
  setup() {
    const root = this.one(".SourcePanel");
    if (!root) throw new Error("ue-source-panel needs a .SourcePanel child");
    this.#root = root;
    root.setAttribute("role", "group");
    for (const title of this.all(".SourcePanel__title")) {
      const area = title.closest(".SourcePanel__area");
      const body = area?.querySelector(".SourcePanel__body");
      title.setAttribute("role", "button");
      title.tabIndex = 0;
      title.setAttribute("aria-expanded", String(body ? !body.hidden : false));
    }
    for (const control of this.all(".SourcePanel__tool, .SourcePanel__add")) {
      control.setAttribute("role", "button");
      control.tabIndex = 0;
      if (control.classList.contains("SourcePanel__tool")) control.setAttribute("aria-pressed", "false");
    }
    for (const tree of this.all(".SourcePanel__tree")) this.#initTree(tree);
    this.on(root, "click", (event) => this.#click(event));
    this.on(root, "dblclick", (event) => this.#doubleClick(event));
    this.on(root, "keydown", (event) => this.#keydown(event));
  }
  #rows(tree) {
    return Array.from(tree.querySelectorAll(ROW));
  }
  #visible(tree) {
    return this.#rows(tree).filter((row) => !row.hidden);
  }
  #depth(row) {
    const indent = row.querySelector(".SourcePanel__indent");
    const px = indent ? parseFloat(indent.style.width) : 0;
    return Math.round((Number.isNaN(px) ? 0 : px) / INDENT_PX);
  }
  #hasKids(row) {
    return row.querySelector(".SourcePanel__exp svg") !== null;
  }
  #isOpen(row) {
    return row.getAttribute("aria-expanded") === "true";
  }
  #treeOf(row) {
    return row.closest(".SourcePanel__tree");
  }
  #initTree(tree) {
    tree.setAttribute("role", "tree");
    for (const row of this.#rows(tree)) {
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-level", String(this.#depth(row) + 1));
      row.setAttribute("aria-selected", String(row.classList.contains(SELECTED)));
      if (this.#hasKids(row)) {
        const href = row.querySelector(".SourcePanel__exp use")?.getAttribute("href") ?? "";
        row.setAttribute("aria-expanded", String(/caret-d$/.test(href)));
      }
    }
    this.#rove(tree);
  }
  // Exactly one row per tree takes the Tab stop: the selected row, else the first visible row.
  #rove(tree) {
    const visible = this.#visible(tree);
    const stop = visible.find((row) => row.classList.contains(SELECTED)) ?? visible[0];
    for (const row of this.#rows(tree)) row.tabIndex = row === stop ? 0 : -1;
  }
  #swap(element, from, to) {
    const use = element?.querySelector("use");
    const href = use?.getAttribute("href");
    if (use && href) use.setAttribute("href", href.replace(from, to));
  }
  #select(row, focus) {
    for (const other of this.all(ROW)) {
      other.classList.remove(SELECTED, PARENT);
      other.setAttribute("aria-selected", "false");
    }
    row.classList.add(SELECTED);
    row.setAttribute("aria-selected", "true");
    const tree = this.#treeOf(row);
    if (tree) {
      const rows = this.#rows(tree);
      let level = this.#depth(row);
      for (let i = rows.indexOf(row) - 1; i >= 0 && level > 0; i--) {
        const depth = this.#depth(rows[i]);
        if (depth < level) {
          rows[i].classList.add(PARENT);
          level = depth;
        }
      }
    }
    for (const each of this.all(".SourcePanel__tree")) this.#rove(each);
    if (focus) row.focus();
    const name = row.querySelector(".SourcePanel__name")?.textContent ?? "";
    this.emit("sourcepanel:select", { name });
  }
  #setOpen(row, open) {
    const tree = this.#treeOf(row);
    if (!tree || !this.#hasKids(row) || this.#isOpen(row) === open) return;
    row.setAttribute("aria-expanded", String(open));
    this.#swap(row.querySelector(".SourcePanel__exp"), /caret-[rd]$/, open ? "caret-d" : "caret-r");
    this.#swap(row.querySelector(".SourcePanel__folder"), /-f[oc]$/, open ? "-fo" : "-fc");
    const rows = this.#rows(tree);
    const depth = this.#depth(row);
    let skipBelow = null;
    let selectedHidden = false;
    for (let i = rows.indexOf(row) + 1; i < rows.length; i++) {
      const child = rows[i];
      const childDepth = this.#depth(child);
      if (childDepth <= depth) break;
      if (skipBelow !== null && childDepth > skipBelow) {
        child.hidden = true;
        continue;
      }
      skipBelow = null;
      child.hidden = !open;
      if (!open && child.classList.contains(SELECTED)) selectedHidden = true;
      if (open && this.#hasKids(child) && !this.#isOpen(child)) skipBelow = childDepth;
    }
    if (!open && !selectedHidden) selectedHidden = rows.some((each) => each.hidden && each.classList.contains(SELECTED));
    if (selectedHidden) this.#select(row, true);
    else this.#rove(tree);
  }
  #setSection(area, open) {
    const body = area.querySelector(".SourcePanel__body");
    const title = area.querySelector(".SourcePanel__title");
    if (!body) return;
    body.hidden = !open;
    title?.setAttribute("aria-expanded", String(open));
    this.#swap(area.querySelector(".SourcePanel__header .SourcePanel__arrow"), /caret-[rd]$/, open ? "caret-d" : "caret-r");
  }
  #click(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const tool = target.closest(".SourcePanel__tool");
    if (tool) {
      tool.setAttribute("aria-pressed", String(tool.getAttribute("aria-pressed") !== "true"));
      return;
    }
    if (target.closest(".SourcePanel__add")) {
      this.#addCollection(target.closest(".SourcePanel__area"));
      return;
    }
    const header = target.closest(".SourcePanel__header");
    if (header) {
      const area = header.closest(".SourcePanel__area");
      const body = area?.querySelector(".SourcePanel__body");
      if (area && body) this.#setSection(area, body.hidden);
      return;
    }
    const row = target.closest(ROW);
    if (!row) return;
    if (target.closest(".SourcePanel__exp")) {
      this.#setOpen(row, !this.#isOpen(row));
      return;
    }
    this.#select(row, true);
  }
  #doubleClick(event) {
    const row = event.target instanceof Element ? event.target.closest(ROW) : null;
    if (row && !event.target.closest(".SourcePanel__exp")) this.#setOpen(row, !this.#isOpen(row));
  }
  #addCollection(area) {
    const tree = area?.querySelector(".SourcePanel__tree");
    if (!area || !tree) return;
    this.#setSection(area, true);
    const rows = this.#rows(tree);
    const row = document.createElement("div");
    row.className = "SourcePanel__row" + (rows.length === 0 ? " SourcePanel__row--root" : "");
    row.innerHTML = '<span class="SourcePanel__indent" style="width:0"></span><span class="SourcePanel__exp"></span><svg class="SourcePanel__folder"><use href="#sp-fc"/></svg><span class="SourcePanel__name"></span>';
    const name = row.querySelector(".SourcePanel__name");
    if (name) name.textContent = "NewCollection" + (rows.length + 1);
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", "1");
    row.setAttribute("aria-selected", "false");
    tree.append(row);
    this.#select(row, true);
  }
  #keydown(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const activate = event.key === "Enter" || event.key === " ";
    if (activate && target.matches(".SourcePanel__title, .SourcePanel__tool, .SourcePanel__add")) {
      event.preventDefault();
      target.click();
      return;
    }
    if (!target.matches(ROW)) return;
    const tree = this.#treeOf(target);
    if (!tree) return;
    const visible = this.#visible(tree);
    const at = visible.indexOf(target);
    const depth = this.#depth(target);
    let go;
    switch (event.key) {
      case "ArrowDown":
        go = visible[at + 1];
        break;
      case "ArrowUp":
        go = visible[at - 1];
        break;
      case "Home":
        go = visible[0];
        break;
      case "End":
        go = visible[visible.length - 1];
        break;
      case "ArrowRight":
        if (this.#hasKids(target) && !this.#isOpen(target)) this.#setOpen(target, true);
        else if (this.#isOpen(target)) go = visible[at + 1];
        break;
      case "ArrowLeft":
        if (this.#isOpen(target)) this.#setOpen(target, false);
        else go = visible.slice(0, at).reverse().find((row) => this.#depth(row) < depth);
        break;
      case "Enter":
      case " ":
        go = target;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (go) this.#select(go, true);
  }
};
define("ue-source-panel", SourcePanelElement);
>>>>>>> origin/master
