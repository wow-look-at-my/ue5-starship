// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
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

// design-system/src/AssetList/AssetList.ts
var ROW = ".AssetList__row";
var CUBE = '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M16 3l11 6v14l-11 6-11-6V9z"/><path d="M5 9l11 6 11-6M16 15v14"/></g></svg>';
var AssetListElement = class extends UeElement {
  #query = "";
  #showEngine = false;
  #descending = false;
  setup() {
    const rows = this.#rows;
    rows.setAttribute("role", "listbox");
    for (const row of this.#all()) row.setAttribute("role", "option");
    this.#showEngine = this.hasAttribute("show-engine");
    this.#refresh();
    this.on(rows, "click", (event) => {
      const row = this.#rowAt(event.target);
      if (!row) return;
      this.#choose(row);
      this.emit("ue-asset-list-activate", { id: this.#idOf(row) });
    });
    this.on(rows, "keydown", (event) => {
      if (event.target !== rows) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") this.move(event.key === "ArrowDown" ? 1 : -1);
      else if (event.key === "Home") this.#choose(this.visibleRows()[0] ?? null);
      else if (event.key === "End") this.#choose(this.visibleRows().at(-1) ?? null);
      else if (event.key === "Enter") this.activate();
      else return;
      event.preventDefault();
    });
    this.on(this, "ue-scrollbar-visibility", (event) => {
      const spacer = this.one(".hr-spacer");
      if (spacer) spacer.hidden = !event.detail.visible;
    });
    this.on(this, "ue-sort", (event) => {
      const detail = event.detail;
      if (detail.column !== "name") return;
      this.#descending = detail.direction === "descending";
      this.#sort();
    });
  }
  // The text filter. A row shows while its name contains the text, ignoring case.
  get query() {
    return this.#query;
  }
  set query(text) {
    this.#query = text;
    this.#refresh();
  }
  // Engine content (a path under /Engine/) shows only while this is true.
  get showEngine() {
    return this.#showEngine;
  }
  set showEngine(show) {
    this.#showEngine = show;
    this.toggleAttribute("show-engine", show);
    this.#refresh();
  }
  // The id of the selected row, or null.
  get selectedId() {
    const row = this.#all().find((each) => each.getAttribute("aria-selected") === "true");
    return row ? this.#idOf(row) : null;
  }
  // The object path of the row with this id, or null.
  pathOf(id) {
    return this.#all().find((row) => this.#idOf(row) === id)?.dataset.path ?? null;
  }
  // The rows the filters leave, in order.
  visibleRows() {
    return this.#all().filter((row) => !row.hidden);
  }
  // Selects the row with this id, or clears the selection for null or an unknown id. Fires no event.
  select(id) {
    const row = this.#all().find((each) => this.#idOf(each) === id) ?? null;
    this.#mark(row);
    this.#reveal(row);
  }
  // Moves the selection by `delta` through the visible rows, wrapping, as SAssetView::AdjustActiveSelection does.
  // With no selection the first row is selected.
  move(delta) {
    const rows = this.visibleRows();
    if (rows.length === 0) {
      this.#choose(null);
      return;
    }
    const at = rows.findIndex((row) => row.getAttribute("aria-selected") === "true");
    const next = at < 0 ? 0 : (at + delta + rows.length) % rows.length;
    this.#choose(rows[next]);
  }
  // Activates the selected visible row, or the first visible row when none is selected. Returns the id, or null for an empty list.
  activate() {
    const rows = this.visibleRows();
    const row = rows.find((each) => each.getAttribute("aria-selected") === "true") ?? rows[0];
    if (!row) return null;
    this.#choose(row);
    const id = this.#idOf(row);
    this.emit("ue-asset-list-activate", { id });
    return id;
  }
  // Replaces every row with rows drawn from data.
  setItems(items) {
    this.#rows.replaceChildren(...items.map((item) => this.#draw(item)));
    this.#sort();
  }
  // Looked up on each use, so an owner may call the API before this element's own setup runs.
  get #rows() {
    const rows = this.one(".AssetList__rows");
    if (!rows) throw new Error("ue-asset-list needs a .AssetList__rows listbox");
    return rows;
  }
  get #count() {
    return this.one(".AssetList__count");
  }
  #all() {
    return Array.from(this.#rows.querySelectorAll(":scope > " + ROW));
  }
  #rowAt(target) {
    const row = target instanceof Element ? target.closest(ROW) : null;
    return row && row.parentElement === this.#rows ? row : null;
  }
  #idOf(row) {
    return row.dataset.id ?? (row.querySelector(".AssetList__name")?.textContent ?? "").trim();
  }
  #mark(row) {
    for (const each of this.#all()) each.setAttribute("aria-selected", String(each === row));
    this.#writeCount();
  }
  // Scrolls only the list view so the row shows, as RequestScrollIntoView does. The page itself never scrolls.
  #reveal(row) {
    const view = this.#rows.closest(".sb-view");
    if (!row || row.hidden || !view) return;
    const box = view.getBoundingClientRect();
    const at = row.getBoundingClientRect();
    if (at.top < box.top) view.scrollTop -= box.top - at.top;
    else if (at.bottom > box.bottom) view.scrollTop += at.bottom - box.bottom;
  }
  // Selects a row and announces the change.
  #choose(row) {
    const before = this.selectedId;
    this.#mark(row);
    this.#reveal(row);
    const id = row ? this.#idOf(row) : null;
    if (id !== before) this.emit("ue-asset-list-select", { id });
  }
  // Applies the filters, restripes the visible rows and rewrites the count line (SAssetView::GetAssetCountText, SAssetView.cpp:5513-5543).
  #refresh() {
    const text = this.#query.trim().toLowerCase();
    let shown = 0;
    for (const row of this.#all()) {
      const name = (row.querySelector(".AssetList__name")?.textContent ?? "").toLowerCase();
      const engine = (row.dataset.path ?? "").startsWith("/Engine/");
      row.hidden = engine && !this.#showEngine || text !== "" && !name.includes(text);
      if (row.hidden) {
        if (row.getAttribute("aria-selected") === "true") row.setAttribute("aria-selected", "false");
        continue;
      }
      row.classList.toggle("is-odd", shown % 2 === 1);
      shown++;
    }
    this.#writeCount();
  }
  #writeCount() {
    if (!this.#count) return;
    const rows = this.visibleRows();
    const selected = rows.filter((row) => row.getAttribute("aria-selected") === "true").length;
    const items = rows.length === 1 ? "1 item" : rows.length + " items";
    this.#count.textContent = selected === 0 ? items : items + " (" + selected + " selected)";
  }
  #sort() {
    const rows = this.#all();
    const name = (row) => (row.querySelector(".AssetList__name")?.textContent ?? "").trim();
    rows.sort((a, b) => name(a).localeCompare(name(b)) * (this.#descending ? -1 : 1));
    this.#rows.append(...rows);
    this.#refresh();
  }
  #draw(item) {
    const row = document.createElement("div");
    row.className = "AssetList__row";
    row.dataset.id = item.id;
    if (item.path) row.dataset.path = item.path;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", "false");
    row.innerHTML = '<span class="AssetList__rc"></span><span class="AssetList__thumb"><span class="AssetList__glyph"></span><i class="AssetList__strip"></i></span><span class="AssetList__text"><span class="AssetList__name"></span><span class="AssetList__class"></span></span>';
    const name = row.querySelector(".AssetList__name");
    if (name) name.textContent = item.label;
    const kind = row.querySelector(".AssetList__class");
    if (kind) kind.textContent = item.typeLabel ?? "";
    const holder = row.querySelector(".AssetList__glyph");
    if (holder && item.thumb) {
      const image = document.createElement("img");
      image.className = "AssetList__image";
      image.src = item.thumb;
      image.alt = "";
      holder.replaceWith(image);
    } else if (holder) {
      holder.insertAdjacentHTML("afterend", CUBE);
      holder.remove();
    }
    if (item.strip) row.querySelector(".AssetList__strip")?.style.setProperty("--strip", item.strip);
    return row;
  }
};
define("ue-asset-list", AssetListElement);
export {
  AssetListElement
};
