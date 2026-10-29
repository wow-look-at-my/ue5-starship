// src/_shared/element.ts
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

// src/_shared/tree-controller.ts
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

// src/_shared/drag.ts
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

// src/_shared/scroll-thumb.ts
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

// src/SceneOutliner/SceneOutliner.ts
var ROW = ".so-row";
var SORTABLE = ".so-hcell[aria-sort]";
var collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
var SceneOutliner = class extends UeElement {
  setup() {
    const rowsEl = this.one(".so-rows");
    const input = this.one(".so-input");
    const clear = this.one(".so-clear");
    const status = this.one(".so-status");
    const bar = this.one(".so-sb");
    const thumb = this.one(".so-thumb");
    const hcells = this.one(".so-hcells");
    const spacer = this.one(".so-hspacer");
    if (!rowsEl || !input || !clear || !status || !bar || !thumb) return;
    const text = (row, selector) => row.querySelector(selector)?.textContent?.trim() ?? "";
    const label = (row) => text(row, ".so-text");
    const kind = (row) => text(row, ".so-type");
    const isActor = (row) => kind(row) !== "Folder" && kind(row) !== "World";
    let keep = null;
    let saved = null;
    const updateStatus = () => {
      const actors = controller.rows().filter(isActor);
      const total = actors.length;
      const selected = actors.filter((row) => controller.isSelected(row)).length;
      const suffix = selected > 0 ? " (" + selected + " selected)" : "";
      status.classList.remove("is-match", "is-none");
      if (!keep) {
        status.textContent = total + " actors" + suffix;
        return;
      }
      const shown = actors.filter((row) => keep?.has(row)).length;
      status.classList.add(shown === 0 ? "is-none" : "is-match");
      if (shown === 0) status.textContent = "No matching actors (" + total + " total)";
      else if (shown === total) status.textContent = total + " actors" + suffix;
      else status.textContent = "Showing " + shown + " of " + total + " actors" + suffix;
    };
    const binding = bindBar(rowsEl, bar, thumb, true, (fits) => {
      if (spacer) spacer.hidden = fits;
      hcells?.classList.toggle("is-no-bar", fits);
    });
    this.onDispose(binding.dispose);
    const controller = new TreeController(rowsEl, {
      row: ROW,
      arrow: ".so-arrow",
      folder: ".so-ico.is-folder",
      caretOpen: "so-caret-down",
      caretClosed: "so-caret-right",
      folderOpen: "so-folder-open",
      folderClosed: "so-folder"
    }, {
      excluded: (row) => keep !== null && !keep.has(row),
      changed: () => {
        updateStatus();
        binding.update();
      }
    });
    const applyFilter = () => {
      const needle = input.value.trim().toLowerCase();
      clear.hidden = input.value === "";
      if (needle === "") {
        if (saved) {
          for (const [row, value] of saved) {
            if (value === null) row.removeAttribute("aria-expanded");
            else row.setAttribute("aria-expanded", value);
          }
        }
        keep = null;
        saved = null;
        controller.refresh();
        return;
      }
      const rows = controller.rows();
      saved ??= new Map(rows.map((row) => [row, row.getAttribute("aria-expanded")]));
      const next = /* @__PURE__ */ new Set();
      rows.forEach((row, index) => {
        if (!label(row).toLowerCase().includes(needle)) return;
        next.add(row);
        let want = controller.level(row);
        for (let j = index - 1; j >= 0 && want > 1; j--) {
          if (controller.level(rows[j]) < want) {
            next.add(rows[j]);
            rows[j].setAttribute("aria-expanded", "true");
            want = controller.level(rows[j]);
          }
        }
      });
      keep = next;
      controller.refresh();
    };
    const sortRows = (column, mode) => {
      const rows = controller.rows();
      const roots = [];
      const stack = [];
      for (const row of rows) {
        const node = { row, kids: [] };
        const level = controller.level(row);
        stack.length = level - 1;
        (stack[level - 2]?.kids ?? roots).push(node);
        stack[level - 1] = node;
      }
      const dir = mode === "descending" ? -1 : 1;
      const compare = (a, b) => {
        if (column === "type") return dir * collator.compare(kind(a.row), kind(b.row));
        const byKind = Number(isActor(a.row)) - Number(isActor(b.row));
        return dir * (byKind || collator.compare(label(a.row), label(b.row)));
      };
      const flat = [];
      const walk = (list) => {
        list.sort(compare);
        for (const node of list) {
          flat.push(node.row);
          walk(node.kids);
        }
      };
      walk(roots);
      rowsEl.append(...flat);
      controller.refresh();
    };
    const paintHeader = (cell, mode) => {
      cell.setAttribute("aria-sort", mode);
      const arrow = cell.querySelector(".so-sort");
      if (!arrow) return;
      arrow.toggleAttribute("hidden", mode === "none");
      arrow.querySelector("use")?.setAttribute("href", mode === "descending" ? "#so-down" : "#so-up");
    };
    const modeOf = (cell) => {
      const value = cell.getAttribute("aria-sort");
      return value === "ascending" || value === "descending" ? value : "none";
    };
    const cells = () => this.all(SORTABLE);
    const activate = (cell) => {
      const mode = modeOf(cell) === "ascending" ? "descending" : "ascending";
      for (const other of cells()) paintHeader(other, other === cell ? mode : "none");
      sortRows(cell.dataset.column ?? "label", mode);
    };
    this.on(this, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const cell = target.closest(SORTABLE);
      if (cell && this.contains(cell)) {
        activate(cell);
        return;
      }
      if (target.closest(".so-clear")) {
        input.value = "";
        applyFilter();
        input.focus();
      }
    });
    this.on(this, "keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(SORTABLE)) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate(target);
    });
    this.on(input, "input", applyFilter);
    this.on(input, "keydown", (event) => {
      if (event.key === "Escape" && input.value !== "") {
        event.preventDefault();
        input.value = "";
        applyFilter();
      } else if (event.key === "ArrowDown") {
        const current = controller.shown().find((row) => row.tabIndex === 0) ?? controller.shown()[0];
        if (!current) return;
        event.preventDefault();
        controller.focusRow(current, true);
      }
    });
    const toggleEye = (row) => {
      const rows = controller.rows();
      const start = rows.indexOf(row);
      const hide = !row.querySelector(".so-eye")?.classList.contains("is-off");
      const level = controller.level(row);
      for (let i = start; i < rows.length && (i === start || controller.level(rows[i]) > level); i++) {
        const eye = rows[i].querySelector(".so-eye");
        if (!eye) continue;
        eye.classList.toggle("is-off", hide);
        eye.querySelector("use")?.setAttribute("href", hide ? "#so-eye-off" : "#so-eye");
      }
    };
    this.on(rowsEl, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = controller.rowOf(target);
      if (row && target.closest(".so-gutter")) {
        toggleEye(row);
        return;
      }
      controller.click(event);
    });
    this.on(rowsEl, "dblclick", (event) => controller.doubleClick(event));
    this.on(rowsEl, "keydown", (event) => {
      controller.keyDown(event);
    });
    const sorted = cells().find((cell) => modeOf(cell) !== "none");
    for (const cell of cells()) paintHeader(cell, modeOf(cell));
    if (sorted) sortRows(sorted.dataset.column ?? "label", modeOf(sorted));
    else controller.refresh();
  }
};
define("ue-scene-outliner", SceneOutliner);
export {
  SceneOutliner
};
