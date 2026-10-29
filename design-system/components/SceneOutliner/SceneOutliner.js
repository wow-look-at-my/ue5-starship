// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
  #ready = false;
  #pendingSetup = null;
  // The bundle can load before the parser reaches this element's children, so setup waits for the document to finish parsing.
  connectedCallback() {
    this.style.display = "contents";
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
  // True when the nearest element of this tag above the target is this element, so a nested instance keeps its own events.
  owns(target) {
    return target instanceof Element && target.closest(this.localName) === this;
  }
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

// design-system/src/_shared/drag.ts
var THRESHOLD = 3;
function drag(target, handlers) {
  let originX = 0;
  let originY = 0;
  let active = false;
  let moved = false;
  const down = (event) => {
    if (event.button !== 0) return;
    active = true;
    moved = false;
    originX = event.clientX;
    originY = event.clientY;
    target.setPointerCapture(event.pointerId);
    handlers.start?.(event);
  };
  const move = (event) => {
    if (!active) return;
    const dx = event.clientX - originX;
    const dy = event.clientY - originY;
    if (!moved && Math.hypot(dx, dy) < THRESHOLD) return;
    moved = true;
    handlers.move(event, dx, dy);
  };
  const up = (event) => {
    if (!active) return;
    active = false;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    handlers.end?.(event, moved);
  };
  target.addEventListener("pointerdown", down);
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
  return () => {
    target.removeEventListener("pointerdown", down);
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
  };
}

// design-system/src/HeaderRow/HeaderRow.ts
var CELL = ".hr-cell";
var SORTABLE = ".hr-cell[aria-sort]";
var GRIP = ".hr-grip";
var ARROW = ".hr-sort";
var GLYPH = {
  up: "M2 8l4-5 4 5z",
  down: "M2 4l4 5 4-5z",
  up2: "M2 6.2l4-4 4 4zM2 10.5l4-4 4 4z",
  down2: "M2 1.5l4 4 4-4zM2 5.8l4 4 4-4z"
};
var SVG_NS = "http://www.w3.org/2000/svg";
var MIN_WIDTH = 20;
var KEY_STEP = 8;
function modeOf(cell) {
  const value = cell.getAttribute("aria-sort");
  return value === "ascending" || value === "descending" ? value : "none";
}
function priorityOf(cell) {
  return cell.dataset.priority === "secondary" ? "secondary" : "primary";
}
function paint(cell, mode, priority) {
  cell.setAttribute("aria-sort", mode);
  cell.dataset.priority = priority;
  let arrow = cell.querySelector(ARROW);
  if (!arrow) {
    arrow = document.createElementNS(SVG_NS, "svg");
    arrow.setAttribute("class", "hr-sort");
    arrow.setAttribute("viewBox", "0 0 12 12");
    arrow.setAttribute("aria-hidden", "true");
    const grip = cell.querySelector(GRIP);
    if (grip) cell.insertBefore(arrow, grip);
    else cell.append(arrow);
  }
  let path = arrow.querySelector("path");
  if (!path) {
    path = document.createElementNS(SVG_NS, "path");
    arrow.append(path);
  }
  arrow.toggleAttribute("hidden", mode === "none");
  path.setAttribute("d", GLYPH[(mode === "descending" ? "down" : "up") + (priority === "secondary" ? "2" : "")]);
}
var HeaderRow = class extends UeElement {
  setup() {
    const sortable = () => this.all(SORTABLE).filter((cell) => this.owns(cell));
    for (const cell of sortable()) paint(cell, modeOf(cell), priorityOf(cell));
    const activate = (cell, shift) => {
      let mode = modeOf(cell);
      let priority = priorityOf(cell);
      if (mode === "none") {
        priority = shift ? "secondary" : "primary";
        mode = "ascending";
      } else {
        if (!shift && priority === "secondary") priority = "primary";
        mode = mode === "descending" ? "ascending" : "descending";
      }
      for (const other of sortable()) {
        if (other !== cell && modeOf(other) !== "none" && priorityOf(other) === priority) paint(other, "none", priority);
      }
      paint(cell, mode, priority);
      this.emit("ue-sort", { column: cell.dataset.column ?? "", mode, direction: mode, priority });
    };
    this.on(this, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest(GRIP) || !this.owns(target)) return;
      const cell = target.closest(SORTABLE);
      if (cell && this.contains(cell)) activate(cell, event.shiftKey);
    });
    this.on(this, "keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(SORTABLE) || !this.owns(target)) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate(target, event.shiftKey);
    });
    const grips = this.all(GRIP).filter((grip) => this.owns(grip));
    const resizable = this.getAttribute("grips") !== "off";
    for (const grip of grips) {
      grip.hidden = !resizable;
      if (resizable) this.#bindGrip(grip);
    }
  }
  #bindGrip(grip) {
    const left = grip.closest(CELL);
    const right = left?.nextElementSibling;
    const cells = left?.parentElement;
    if (!left || !(right instanceof HTMLElement) || !right.matches(CELL) || !cells) return;
    let startLeft = 0;
    let total = 0;
    const apply = (width) => {
      const clamped = Math.min(total - MIN_WIDTH, Math.max(MIN_WIDTH, width));
      left.style.flex = clamped + " 1 " + clamped + "px";
      right.style.flex = total - clamped + " 1 " + (total - clamped) + "px";
      grip.setAttribute("aria-valuenow", String(Math.round(clamped)));
      this.emit("ue-column-resize", { column: left.dataset.column ?? "", width: clamped, nextColumn: right.dataset.column ?? "", nextWidth: total - clamped });
    };
    const measure = () => {
      const flexible = Array.from(cells.children).filter((cell) => cell instanceof HTMLElement && cell.matches(CELL) && getComputedStyle(cell).flexGrow !== "0");
      const widths = flexible.map((cell) => cell.getBoundingClientRect().width);
      flexible.forEach((cell, i) => {
        cell.style.flex = widths[i] + " 1 " + widths[i] + "px";
      });
      startLeft = left.getBoundingClientRect().width;
      total = startLeft + right.getBoundingClientRect().width;
    };
    this.onDispose(drag(grip, {
      start: measure,
      move: (_event, dx) => apply(startLeft + dx)
    }));
    this.on(grip, "keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      measure();
      apply(startLeft + (event.key === "ArrowLeft" ? -KEY_STEP : KEY_STEP));
    });
    this.on(grip, "click", (event) => event.stopPropagation());
  }
};
define("ue-header-row", HeaderRow);

// design-system/src/_shared/scroll-thumb.ts
var MIN_THUMB = 35;
var BAR_PADDING = 2;
function thumbLayout(slot, viewport, content, offset) {
  const track = slot - 2 * BAR_PADDING;
  const biased = track - MIN_THUMB;
  const needed = content > viewport + 0.5 && biased > 0;
  if (!needed) return { needed: false, start: BAR_PADDING, size: 0 };
  return {
    needed,
    start: BAR_PADDING + biased * (offset / content),
    size: MIN_THUMB + biased * (viewport / content)
  };
}
function offsetForPointer(pointer, grab, slot, content) {
  const biased = slot - 2 * BAR_PADDING - MIN_THUMB;
  const fraction = Math.min(1, Math.max(0, (pointer - BAR_PADDING - grab) / biased));
  return fraction * content;
}
function bindBar(view, bar, thumb, vertical, onFits) {
  const slotLength = () => vertical ? bar.clientHeight : bar.clientWidth;
  const viewport = () => vertical ? view.clientHeight : view.clientWidth;
  const content = () => vertical ? view.scrollHeight : view.scrollWidth;
  const offset = () => vertical ? view.scrollTop : view.scrollLeft;
  const scrollTo = (value) => {
    const max = content() - viewport();
    const clamped = Math.min(max, Math.max(0, value));
    if (vertical) view.scrollTop = clamped;
    else view.scrollLeft = clamped;
  };
  const pointerIn = (event) => {
    const box = bar.getBoundingClientRect();
    return vertical ? event.clientY - box.top : event.clientX - box.left;
  };
  const update = () => {
    const fits = !(content() > viewport() + 0.5);
    if (bar.hidden !== fits) {
      bar.hidden = fits;
      onFits?.(fits);
    }
    if (fits) return;
    const layout = thumbLayout(slotLength(), viewport(), content(), offset());
    thumb.style.display = layout.needed ? "" : "none";
    if (!layout.needed) return;
    if (vertical) {
      thumb.style.top = layout.start + "px";
      thumb.style.height = layout.size + "px";
    } else {
      thumb.style.left = layout.start + "px";
      thumb.style.width = layout.size + "px";
    }
  };
  let grab = 0;
  const stopDrag = drag(bar, {
    start: (event) => {
      const box = thumb.getBoundingClientRect();
      const thumbStart = vertical ? box.top : box.left;
      const pointer = vertical ? event.clientY : event.clientX;
      const onThumb = thumb.style.display !== "none" && pointer >= thumbStart && pointer <= thumbStart + (vertical ? box.height : box.width);
      bar.classList.add("is-drag");
      if (thumb.style.display === "none") return;
      grab = onThumb ? pointer - thumbStart : (vertical ? box.height : box.width) / 2;
      if (!onThumb) scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content()));
    },
    move: (event) => scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content())),
    end: () => bar.classList.remove("is-drag")
  });
  const onScroll = () => update();
  const onWheel = (event) => {
    event.preventDefault();
    view.scrollBy(vertical ? { top: event.deltaY } : { left: event.deltaX || event.deltaY });
  };
  view.addEventListener("scroll", onScroll);
  bar.addEventListener("wheel", onWheel, { passive: false });
  const observer = new ResizeObserver(update);
  observer.observe(view);
  observer.observe(bar);
  for (const child of Array.from(view.children)) observer.observe(child);
  const mutations = new MutationObserver((records) => {
    for (const record of records) for (const added of Array.from(record.addedNodes)) if (added instanceof Element) observer.observe(added);
    update();
  });
  mutations.observe(view, { childList: true });
  update();
  return {
    update,
    dispose: () => {
      stopDrag();
      view.removeEventListener("scroll", onScroll);
      bar.removeEventListener("wheel", onWheel);
      observer.disconnect();
      mutations.disconnect();
    }
  };
}

// design-system/src/Scrollbar/Scrollbar.ts
var Scrollbar = class extends UeElement {
  #visible = null;
  // True while the content overflows and the bar shows.
  get visible() {
    return this.#visible === true;
  }
  setup() {
    const box = this.all(".sb-scroll").find((candidate) => this.owns(candidate));
    const view = box?.querySelector(":scope > .sb-view");
    const bar = box?.querySelector(":scope > .sb");
    const thumb = bar?.querySelector(".sb-thumb");
    if (!view || !bar || !thumb) throw new Error("ue-scrollbar needs a .sb-scroll with a .sb-view and a .sb bar that holds a .sb-thumb");
    const vertical = !bar.classList.contains("sb-h");
    this.#visible = null;
    let started = false;
    const binding = bindBar(view, bar, thumb, vertical, (fits) => {
      if (started) this.#report(!fits);
    });
    this.onDispose(binding.dispose);
    const first = setTimeout(() => {
      started = true;
      this.#report(!bar.hidden);
    }, 0);
    this.onDispose(() => clearTimeout(first));
  }
  // Announces the first state and every change.
  #report(visible) {
    if (this.#visible === visible) return;
    this.#visible = visible;
    this.emit("ue-scrollbar-visibility", { visible });
  }
};
define("ue-scrollbar", Scrollbar);

// design-system/src/TextInput/TextInput.ts
var UeTextInputElement = class extends UeElement {
  setup() {
    const box = this.one(".textinput");
    const field = box?.querySelector(".textinput__field");
    if (!box || !field) throw new Error("ue-text-input needs a .textinput box with a .textinput__field input");
    const search = box.classList.contains("textinput--search");
    const sync = () => {
      if (search) box.classList.toggle("textinput--filled", field.value !== "");
    };
    const clear = () => {
      field.value = "";
      sync();
      field.focus();
      this.emit("ue-text-input", { value: "" });
      this.emit("ue-text-clear", {});
    };
    sync();
    this.on(field, "input", () => {
      sync();
      this.emit("ue-text-input", { value: field.value });
    });
    this.on(box, "click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".textinput__clear")) clear();
      else if (event.target !== field && !event.target.closest(".textinput__trail")) field.focus();
    });
    this.on(field, "keydown", (event) => {
      if (!search || event.key !== "Escape" || field.readOnly || field.value === "") return;
      event.preventDefault();
      clear();
    });
  }
};
define("ue-text-input", UeTextInputElement);

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
var ARROW2 = '<svg class="tr-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4.5 4L6 12z"/></svg>';
var FOLDER = '<svg class="tr-icon is-folder" viewBox="0 0 16 16" aria-hidden="true"><path class="tr-folder-closed" d="M1.5 4.5V12a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.8 3.5H2.5a1 1 0 0 0-1 1z"/><path class="tr-folder-open" d="M1.5 4.5V12a1 1 0 0 0 1 1h10.6l1.9-5.2a.8.8 0 0 0-.75-1.1H5.2L3.8 11V4.5a1 1 0 0 1 1-1h2L8 5h5.5"/></svg>';
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
    row.innerHTML = '<span class="tr-indent" style="--depth:' + depth + '"></span>' + ARROW2 + (icon === "folder" ? FOLDER : icon === "object" ? OBJECT : "") + '<span class="tr-text"></span>' + cells;
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

// design-system/src/SceneOutliner/SceneOutliner.ts
var ROW = ".so-row";
var SORTABLE2 = ".hr-cell[aria-sort]";
var collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
var SceneOutliner = class extends UeElement {
  setup() {
    const tree = this.one("ue-tree-row");
    const status = this.one(".so-status");
    const spacer = this.one(".hr-spacer");
    if (!tree || !status) return;
    const rows = () => this.all(ROW);
    const text = (row, selector) => row.querySelector(selector)?.textContent?.trim() ?? "";
    const label = (row) => text(row, ".tr-text");
    const kind = (row) => text(row, ".so-type");
    const isActor = (row) => kind(row) !== "Folder" && kind(row) !== "World";
    let needle = "";
    const updateStatus = () => {
      const actors = rows().filter(isActor);
      const total = actors.length;
      const selected = actors.filter((row) => row.getAttribute("aria-selected") === "true").length;
      const suffix = selected > 0 ? " (" + selected + " selected)" : "";
      status.classList.remove("is-match", "is-none");
      if (needle === "") {
        status.textContent = total + " actors" + suffix;
        return;
      }
      const shown = actors.filter((row) => label(row).toLowerCase().includes(needle)).length;
      status.classList.add(shown === 0 ? "is-none" : "is-match");
      if (shown === 0) status.textContent = "No matching actors (" + total + " total)";
      else if (shown === total) status.textContent = total + " actors" + suffix;
      else status.textContent = "Showing " + shown + " of " + total + " actors" + suffix;
    };
    this.on(this, "ue-text-input", (event) => {
      needle = event.detail.value.trim().toLowerCase();
      tree.setFilter(needle);
      updateStatus();
    });
    this.on(this, "ue-tree-select", updateStatus);
    this.on(this, "ue-scrollbar-visibility", (event) => {
      if (spacer) spacer.hidden = !event.detail.visible;
    });
    const keys = {};
    const compareBy = (key, a, b) => {
      if (key.column === "type") return key.direction * collator.compare(kind(a.element), kind(b.element));
      const byKind = Number(isActor(a.element)) - Number(isActor(b.element));
      return key.direction * (byKind || collator.compare(a.label, b.label));
    };
    const sortRows = () => {
      const chain = [keys.primary, keys.secondary].filter((key) => key !== void 0);
      tree.sortChildren((a, b) => {
        for (const key of chain) {
          const order = compareBy(key, a, b);
          if (order !== 0) return order;
        }
        return 0;
      });
    };
    const record = (column, mode, priority) => {
      const key = { column, direction: mode === "descending" ? -1 : 1 };
      if (priority === "secondary") keys.secondary = key;
      else keys.primary = key;
      if (priority === "primary" && keys.secondary?.column === column) delete keys.secondary;
    };
    this.on(this, "ue-sort", (event) => {
      const detail = event.detail;
      record(detail.column, detail.mode, detail.priority);
      sortRows();
    });
    for (const cell of this.all(SORTABLE2)) {
      const mode = cell.getAttribute("aria-sort") ?? "none";
      if (mode !== "none") record(cell.dataset.column ?? "label", mode, cell.dataset.priority ?? "primary");
    }
    if (keys.primary || keys.secondary) sortRows();
    this.on(this, "keydown", (event) => {
      const source = event.target;
      if (event.key !== "ArrowDown" || !(source instanceof HTMLElement) || !source.matches(".textinput__field")) return;
      const shown = rows().filter((row) => !row.hidden);
      const current = shown.find((row) => row.tabIndex === 0) ?? shown[0];
      if (!current) return;
      event.preventDefault();
      current.focus({ preventScroll: true });
      current.scrollIntoView({ block: "nearest" });
    });
    this.on(this, "click", (event) => {
      const source = event.target;
      if (!(source instanceof Element) || !source.closest(".so-gutter")) return;
      const row = source.closest(ROW);
      if (!row) return;
      const all = rows();
      const level = (r) => Number(r.getAttribute("aria-level"));
      const start = all.indexOf(row);
      const hide = !row.querySelector(".so-eye")?.classList.contains("is-off");
      for (let i = start; i < all.length && (i === start || level(all[i]) > level(row)); i++) {
        const eye = all[i].querySelector(".so-eye");
        if (!eye) continue;
        eye.classList.toggle("is-off", hide);
        eye.querySelector("use")?.setAttribute("href", hide ? "#so-eye-off" : "#so-eye");
      }
    });
    updateStatus();
  }
};
define("ue-scene-outliner", SceneOutliner);
export {
  SceneOutliner
};
