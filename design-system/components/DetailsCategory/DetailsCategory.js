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
=======
// design-system/src/_shared/popupmenu.ts
function wireMenu(wiring) {
  const { trigger, menu, itemSelector } = wiring;
  const items = () => Array.from(menu.querySelectorAll(itemSelector));
  const isOpen = () => menu.classList.contains("is-open");
  const setOpen = (open2) => {
    menu.classList.toggle("is-open", open2);
    trigger.setAttribute("aria-expanded", String(open2));
    wiring.onOpenChange?.(open2);
  };
  const open = () => {
    setOpen(true);
    const list = items();
    const start = list.find((item) => item.getAttribute("aria-checked") === "true" || item.getAttribute("aria-selected") === "true") ?? list[0];
    start?.focus();
  };
  const close = (returnFocus) => {
    if (!isOpen()) return;
    setOpen(false);
    if (returnFocus) trigger.focus();
  };
  const move = (delta, absolute) => {
    const list = items();
    const at = list.indexOf(document.activeElement);
    const next = absolute ?? (at < 0 ? 0 : (at + delta + list.length) % list.length);
    list[next]?.focus();
  };
  const pick = (item) => {
    wiring.onPick(item);
    close(true);
  };
  const onTrigger = () => isOpen() ? close(false) : open();
  const onTriggerKey = (event) => {
    if (event.key === "ArrowDown" && !isOpen()) {
      event.preventDefault();
      open();
    }
  };
  const onMenuClick = (event) => {
    const item = event.target.closest(itemSelector);
    if (item && menu.contains(item)) pick(item);
  };
  const onMenuKey = (event) => {
    const active = document.activeElement;
    if (event.key === "ArrowDown") move(1, null);
    else if (event.key === "ArrowUp") move(-1, null);
    else if (event.key === "Home") move(0, 0);
    else if (event.key === "End") move(0, items().length - 1);
    else if ((event.key === "Enter" || event.key === " ") && items().includes(active)) pick(active);
    else if (event.key === "Escape") close(true);
    else if (event.key === "Tab") close(false);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onOutside = (event) => {
    const target = event.target;
    if (isOpen() && !menu.contains(target) && !trigger.contains(target)) close(false);
  };
  trigger.addEventListener("click", onTrigger);
  trigger.addEventListener("keydown", onTriggerKey);
  menu.addEventListener("click", onMenuClick);
  menu.addEventListener("keydown", onMenuKey);
  document.addEventListener("pointerdown", onOutside);
  return {
    open,
    close,
    isOpen,
    dispose: () => {
      trigger.removeEventListener("click", onTrigger);
      trigger.removeEventListener("keydown", onTriggerKey);
      menu.removeEventListener("click", onMenuClick);
      menu.removeEventListener("keydown", onMenuKey);
      document.removeEventListener("pointerdown", onOutside);
>>>>>>> origin/master
    }
  };
}

<<<<<<< HEAD
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

// design-system/src/Checkbox/Checkbox.ts
function disabled(el) {
  return el.getAttribute("aria-disabled") === "true";
}
function nextState(el) {
  const state = el.getAttribute("aria-checked");
  if (el.classList.contains("checkbox--tristate")) {
    if (state === "false") return "true";
    return state === "true" ? "mixed" : "false";
  }
  return state === "true" ? "false" : "true";
}
var UeCheckboxElement = class extends UeElement {
  setup() {
    const el = this.one(".checkbox, .checkbox-toggle");
    if (!el) throw new Error("ue-checkbox needs a .checkbox or .checkbox-toggle element");
    const pressedClass = el.classList.contains("checkbox") ? "checkbox--pressed" : "checkbox-toggle--pressed";
    this.on(el, "click", () => {
      if (!disabled(el)) this.#toggle(el);
    });
    this.on(el, "keydown", (event) => {
      if (disabled(el) || el !== event.target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) el.classList.add(pressedClass);
    });
    this.on(el, "keyup", (event) => {
      if (disabled(el) || el !== event.target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (el.classList.contains(pressedClass)) {
        el.classList.remove(pressedClass);
        this.#toggle(el);
      }
    });
    this.on(el, "focusout", () => el.classList.remove(pressedClass));
  }
  #toggle(el) {
    let text;
    let checked;
    if (el.classList.contains("checkbox-toggle")) {
      const on = !el.classList.contains("checkbox-toggle--checked");
      el.classList.toggle("checkbox-toggle--checked", on);
      el.setAttribute("aria-pressed", String(on));
      text = on ? "on" : "off";
      checked = on;
    } else {
      const state = nextState(el);
      el.setAttribute("aria-checked", state);
      text = state === "mixed" ? "undetermined" : state === "true" ? "checked" : "unchecked";
      checked = state === "mixed" ? null : state === "true";
    }
    const label = el.dataset.label ?? el.getAttribute("aria-label") ?? el.querySelector(".checkbox__label")?.textContent?.trim() ?? el.textContent?.trim() ?? "";
    this.emit("ue-checkbox-change", { label, state: text, checked, text: label + " is " + text });
  }
};
define("ue-checkbox", UeCheckboxElement);

// design-system/src/_shared/popup.ts
function enabledRows(menu, rowSelector) {
  return Array.from(menu.querySelectorAll(rowSelector)).filter((row) => !row.hidden && row.getAttribute("aria-disabled") !== "true");
}
function rowLabel(row, labelSelector) {
  const label = row.querySelector(labelSelector);
  return (label ?? row).textContent?.trim() ?? "";
}

// design-system/src/PopupMenu/PopupMenu.ts
var ROW2 = ".popupmenu__row";
var CURRENT = "popupmenu__row--hover";
var OPEN = "popupmenu__row--open";
var PRESSED2 = "popupmenu__row--pressed";
var KEYS = "popupmenu--keys";
function rowOf(target) {
  return target instanceof Element ? target.closest(ROW2) : null;
}
function isDisabled2(row) {
  return row.getAttribute("aria-disabled") === "true";
}
function submenuOf(row) {
  return row.querySelector(":scope > .popupmenu__sub");
}
function menuOf(row) {
  return row.parentElement;
}
var UePopupMenuElement = class extends UeElement {
  // The focusable .popupmenu list.
  get root() {
    const root = this.one(".popupmenu[tabindex]");
    if (!root) throw new Error("ue-popup-menu needs a .popupmenu[tabindex] element");
    return root;
  }
  // Focuses the list and marks `row` current. `keys` hides the hover highlight, as after an arrow key.
  focusMenu(row, keys) {
    const root = this.root;
    root.focus({ preventScroll: true });
    root.classList.toggle(KEYS, keys);
    this.#show(root, row, null);
  }
  // Clears the current row and closes every submenu.
  reset() {
    const root = this.root;
    root.classList.remove(KEYS);
    this.#show(root, null, null);
  }
  // The enabled rows of the top level, in order.
  topRows() {
    return enabledRows(this.root, ":scope > " + ROW2);
  }
  setup() {
    void this.root;
    this.on(this, "mousemove", (event) => {
      const row = rowOf(event.target);
      if (!row || !ownedBy(this, event.target)) return;
      const root = this.root;
      root.classList.remove(KEYS);
      if (isDisabled2(row)) return;
      const sub = submenuOf(row);
      const open = sub !== null && !sub.hidden;
      if (row.classList.contains(CURRENT) && (sub === null || open)) return;
      this.#show(root, row, sub ? row : null);
    });
    this.on(this, "pointerdown", (event) => {
      const row = rowOf(event.target);
      if (row && ownedBy(this, event.target) && event.button === 0 && !isDisabled2(row)) row.classList.add(PRESSED2);
    });
    const release = () => {
      for (const row of this.all(ROW2 + "." + PRESSED2)) row.classList.remove(PRESSED2);
    };
    this.on(this, "pointerup", release);
    this.on(this, "pointercancel", release);
    this.on(this, "pointerout", (event) => {
      const row = rowOf(event.target);
      if (row && !(event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) row.classList.remove(PRESSED2);
    });
    this.on(this, "click", (event) => {
      const row = rowOf(event.target);
      if (!row || !ownedBy(this, event.target) || isDisabled2(row)) return;
      const sub = submenuOf(row);
      if (sub) {
        this.#show(this.root, row, sub.hidden ? row : null);
        return;
      }
      this.#show(this.root, row, null);
      this.#activate(row);
    });
    this.on(this, "mouseout", (event) => {
      const root = this.root;
      if (!ownedBy(this, event.target) || event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
      if (!root.classList.contains(KEYS)) this.#show(root, null, null);
    });
    this.on(this, "keydown", (event) => {
      if (event.target === this.root) this.#key(event, this.root);
    });
    this.on(this, "focusout", (event) => {
      const root = this.root;
      if (!root.contains(event.target)) return;
      if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) this.#show(root, null, null);
    });
  }
  // Marks one row current, opens the submenus on its path, and optionally opens the submenu of `open`.
  #show(root, current, open) {
    const keep = /* @__PURE__ */ new Set();
    for (let row = current; row; row = row.parentElement?.closest(ROW2) ?? null) {
      if (row !== current) keep.add(row);
    }
    if (open) keep.add(open);
    for (const row of Array.from(root.querySelectorAll(ROW2)).filter((each) => ownedBy(this, each))) {
      row.classList.toggle(CURRENT, row === current);
      const sub = submenuOf(row);
      if (sub) {
        const isOpen = keep.has(row);
        sub.hidden = !isOpen;
        row.classList.toggle(OPEN, isOpen);
        row.setAttribute("aria-expanded", String(isOpen));
      }
    }
  }
  #activate(row) {
    const role = row.getAttribute("role");
    const label = rowLabel(row, ".popupmenu__label");
    let checked = null;
    let text = label;
    if (role === "menuitemcheckbox") {
      checked = row.getAttribute("aria-checked") !== "true";
      row.setAttribute("aria-checked", String(checked));
      text += checked ? " (checked)" : " (unchecked)";
    } else if (role === "menuitemradio") {
      for (const other of Array.from(menuOf(row)?.querySelectorAll(':scope > [role="menuitemradio"]') ?? [])) {
        other.setAttribute("aria-checked", String(other === row));
      }
      checked = true;
      text += " (selected)";
    }
    const detail = { label, role, checked, text, value: row.dataset.value ?? label, row };
    this.emit("ue-menu-activate", detail);
  }
  #key(event, root) {
    const current = root.querySelector(ROW2 + "." + CURRENT);
    const menu = current ? menuOf(current) : root;
    if (!menu) return;
    const rows = enabledRows(menu, ":scope > " + ROW2);
    const index = current ? rows.indexOf(current) : -1;
    const go = (next) => {
      root.classList.add(KEYS);
      if (next) this.#show(root, next, null);
    };
    switch (event.key) {
      case "ArrowDown":
        go(rows[index < 0 ? 0 : (index + 1) % rows.length]);
        break;
      case "ArrowUp":
        go(rows[index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length]);
        break;
      case "Home":
        go(rows[0]);
        break;
      case "End":
        go(rows[rows.length - 1]);
        break;
      case "ArrowRight":
        this.#enter(root, current);
        break;
      case "ArrowLeft":
        this.#leave(root, current);
        break;
      case "Escape":
        root.classList.add(KEYS);
        if (current && menu !== root) {
          this.#leave(root, current);
          event.stopPropagation();
        } else {
          this.#show(root, null, null);
        }
        break;
      case "Enter":
      case " ":
        root.classList.add(KEYS);
        if (event.repeat || !current) break;
        if (submenuOf(current)) this.#enter(root, current);
        else this.#activate(current);
        break;
      default:
        return;
    }
    event.preventDefault();
  }
  // Opens the submenu of the current row and moves to its first enabled row.
  #enter(root, current) {
    root.classList.add(KEYS);
    const sub = current ? submenuOf(current) : null;
    if (!current || !sub) return;
    const first = enabledRows(sub, ":scope > " + ROW2)[0];
    this.#show(root, first ?? current, current);
  }
  // Closes the submenu that holds the current row and returns to its parent row.
  #leave(root, current) {
    root.classList.add(KEYS);
    const parent = current ? menuOf(current)?.closest(ROW2) ?? null : null;
    if (parent) this.#show(root, parent, null);
  }
};
define("ue-popup-menu", UePopupMenuElement);

// design-system/src/ComboButton/ComboButton.ts
var OPEN2 = "combobutton--open";
var ACTIVATE_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];
var UeComboButtonElement = class extends UeElement {
  #trigger;
  #panel;
  // In value mode: the value of the picked row. The setter picks the row whose value or label matches, shows its label and fires no ue-combo-pick. This is because the owner that sets it
  // already knows.
  get value() {
    const picked = this.#ownRows().find((row) => row.getAttribute("aria-selected") === "true");
    return picked?.dataset.value ?? (picked ? rowLabel(picked, ".popupmenu__label") : "");
  }
  set value(next) {
    const row = this.#ownRows();
    const match = row.find((each) => (each.dataset.value ?? rowLabel(each, ".popupmenu__label")) === next);
    if (!match) throw new Error("ue-combo-button has no row with the value " + next);
    const label = this.querySelector(".combobutton__label");
    if (label) label.textContent = rowLabel(match, ".popupmenu__label");
    for (const each of row) each.setAttribute("aria-selected", String(each === match));
  }
  setup() {
    const trigger = this.one(".combobutton");
    const panel = this.one(".combobutton-menu");
    if (!trigger || !panel) throw new Error("ue-combo-button needs a .combobutton trigger and a .combobutton-menu panel");
    if (!panel.querySelector("ue-popup-menu")) throw new Error("the .combobutton-menu panel needs a ue-popup-menu");
    this.#trigger = trigger;
    this.#panel = panel;
    const anchor = trigger.closest(".combobutton-anchor") ?? this;
    if (!this.#isAction()) this.#markSelected(this.#labelText());
    this.on(trigger, "click", () => {
      if (this.#disabled()) return;
      if (panel.hidden) this.#open(false, false);
      else this.#close(false);
    });
    this.on(trigger, "keydown", (event) => {
      if (event.target !== trigger || this.#disabled() || !ACTIVATE_KEYS.includes(event.key)) return;
      event.preventDefault();
      if (panel.hidden && !event.repeat) this.#open(true, event.key === "ArrowUp");
    });
    this.on(panel, "mousedown", (event) => {
      if (!this.#inWidget(event.target)) event.preventDefault();
    });
    this.on(panel, "keydown", (event) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented && event.target instanceof HTMLInputElement && this.#inWidget(event.target)) return;
        event.preventDefault();
        if (this.parentElement?.closest(".combobutton-menu")) event.stopPropagation();
        this.#close(true);
      } else if (event.key === "Tab" && !this.#inWidget(event.target)) {
        this.#close(false);
      }
    });
    this.on(this, "ue-menu-activate", (event) => {
      if (ownedBy(this, event.target)) this.#pick(event.detail);
    });
    this.on(document, "pointerdown", (event) => {
      if (!panel.hidden && !(event.target instanceof Node && anchor.contains(event.target))) this.#close(false);
    });
  }
  // True while the panel shows.
  get isOpen() {
    return !this.#panel.hidden;
  }
  // Opens the panel. `keys` moves the focus into the list, `fromEnd` starts at the last row.
  open(keys = false, fromEnd = false) {
    if (this.#disabled() || this.isOpen) return;
    this.#open(keys, fromEnd);
  }
  // Closes the panel. `refocus` returns the focus to the trigger.
  close(refocus = false) {
    if (this.isOpen) this.#close(refocus);
  }
  #disabled() {
    return this.#trigger.getAttribute("aria-disabled") === "true";
  }
  // Action mode keeps the label fixed. Value mode shows the picked row. mode="value" gives a simple trigger value mode.
  #isAction() {
    const mode = this.getAttribute("mode");
    if (mode === "action" || this.#label() === null) return true;
    return mode !== "value" && this.#trigger.classList.contains("combobutton--simple");
  }
  #label() {
    return this.#trigger.querySelector(".combobutton__label");
  }
  #labelText() {
    return this.#label()?.textContent?.trim() ?? "";
  }
  // The popup menu is upgraded by its own module, which can load after this.
  #popup() {
    const popup = this.#panel.querySelector("ue-popup-menu");
    if (!popup || typeof popup.focusMenu !== "function") throw new Error("ue-popup-menu is not defined");
    return popup;
  }
  // The top-level rows of this combo's own list. A combo nested in a widget block keeps its rows.
  #ownRows() {
    const root = this.#panel.querySelector("ue-popup-menu .popupmenu[tabindex]");
    return root ? Array.from(root.querySelectorAll(":scope > .popupmenu__row")) : [];
  }
  #rows() {
    return this.#ownRows().filter((row) => !row.hidden && row.getAttribute("aria-disabled") !== "true");
  }
  // True when the target sits in a widget block (.popupmenu__widget) of this combo's own menu.
  #inWidget(target) {
    const widget = target instanceof Element ? target.closest(".popupmenu__widget") : null;
    return widget !== null && widget.closest(".combobutton-menu") === this.#panel;
  }
  #markSelected(label) {
    for (const row of this.#rows()) row.setAttribute("aria-selected", String(rowLabel(row, ".popupmenu__label") === label));
  }
  #open(keys, fromEnd) {
    const popup = this.#popup();
    this.#panel.hidden = false;
    this.#trigger.classList.add(OPEN2);
    this.#trigger.setAttribute("aria-expanded", "true");
    const rows = this.#rows();
    const selected = rows.find((row) => row.getAttribute("aria-selected") === "true" || row.getAttribute("aria-checked") === "true");
    popup.focusMenu(keys ? selected ?? (fromEnd ? rows[rows.length - 1] : rows[0]) ?? null : null, keys);
    const field = Array.from(this.#panel.querySelectorAll("[data-autofocus]")).find((each) => this.#inWidget(each));
    field?.focus({ preventScroll: true });
    this.emit("ue-combo-toggle", { open: true });
  }
  #close(refocus) {
    this.#panel.hidden = true;
    this.#trigger.classList.remove(OPEN2);
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#popup().reset();
    if (refocus) this.#trigger.focus();
    this.emit("ue-combo-toggle", { open: false });
  }
  #pick(detail) {
    const label = this.#label();
    if (!this.#isAction() && label && detail.role !== "menuitemcheckbox") {
      label.textContent = detail.label;
      this.#markSelected(detail.label);
    }
    this.#close(true);
    this.emit("ue-combo-pick", { value: detail.value, label: detail.label, checked: detail.checked });
  }
};
define("ue-combo-button", UeComboButtonElement);

// design-system/src/ResetToDefault/ResetToDefault.ts
var UeResetToDefaultElement = class extends UeElement {
  static observedAttributes = ["differs"];
  attributeChangedCallback() {
    this.#sync();
  }
  setup() {
    const button = this.one("button.resettodefault");
    if (!button) throw new Error("ue-reset-to-default needs a button.resettodefault element");
    this.#sync();
    this.on(button, "click", () => {
      if (this.hasAttribute("differs")) this.emit("ue-reset", {});
    });
  }
  // The idle button keeps its slot but is invisible, disabled and out of the tab order.
  #sync() {
    const button = this.one("button.resettodefault");
    if (!button) return;
    const differs = this.hasAttribute("differs");
    button.classList.toggle("resettodefault--idle", !differs);
    button.disabled = !differs;
  }
};
define("ue-reset-to-default", UeResetToDefaultElement);

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

// design-system/src/AssetPicker/AssetPicker.ts
var NONE = "None";
var clipboard = null;
var UeAssetPicker = class extends UeElement {
  setup() {
    const row = this.one(".AssetPicker-row");
    const combo = this.one("ue-combo-button");
    const thumb = this.one(".AssetPicker-thumbFrame");
    const reset = this.one("ue-reset-to-default");
    const label = this.one(".combobutton__label");
    const list = this.one("ue-asset-list");
    const field = this.one(".AssetPicker-browse input");
    if (!row || !combo || !label) return;
    const fallback = row.dataset.default ?? NONE;
    const entry = (value) => combo.querySelector('.popupmenu__row[data-value="' + value + '"]');
    const current = () => row.dataset.value ?? fallback;
    const pathOf = (value) => list?.pathOf(value) ?? "/Game/Props/" + value + "." + value;
    const show = (value) => {
      row.dataset.value = value;
      label.textContent = value;
      if (thumb) {
        thumb.title = value === NONE ? NONE : pathOf(value);
        thumb.setAttribute("aria-label", value);
      }
      reset?.toggleAttribute("differs", value !== fallback);
      list?.select(value === NONE ? null : value);
    };
    const change = (value) => {
      show(value);
      this.emit("ue-asset-change", { asset: value });
    };
    show(label.textContent?.trim() ?? fallback);
    this.on(this, "ue-combo-toggle", (event) => {
      if (event.target !== combo || !event.detail.open) return;
      if (field && field.value !== "") {
        field.value = "";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (list) list.query = "";
      list?.select(current() === NONE ? null : current());
      const edit = entry("edit");
      if (edit) edit.hidden = current() === NONE;
      entry("paste")?.setAttribute("aria-disabled", String(clipboard === null));
    });
    this.on(this, "ue-text-input", (event) => {
      if (list && field && event.target.contains(field)) list.query = event.detail.value;
    });
    if (field && list) {
      this.on(field, "keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") list.move(event.key === "ArrowDown" ? 1 : -1);
        else if (event.key === "Enter") list.activate();
        else return;
        event.preventDefault();
      });
    }
    this.on(this, "ue-asset-list-activate", (event) => {
      if (!this.owns(event.target)) return;
      change(event.detail.id);
      combo.close(true);
    });
    this.on(this, "ue-combo-pick", (event) => {
      const detail = event.detail;
      if (event.target !== combo) {
        if (list && this.owns(event.target) && detail.value === "engine") list.showEngine = detail.checked === true;
        return;
      }
      if (detail.value === "edit") this.emit("ue-asset-edit", { asset: current() });
      else if (detail.value === "copy") clipboard = current();
      else if (detail.value === "paste" && clipboard !== null) change(clipboard);
      else if (detail.value === "clear") change(NONE);
    });
    this.on(this, "ue-button-click", (event) => {
      if (!this.owns(event.target)) return;
      const role = event.target.querySelector("[data-role]")?.getAttribute("data-role");
      if (role === "use") {
        change(row.dataset.selection ?? fallback);
      } else if (role === "browse") {
        this.emit("ue-asset-browse", { asset: current() });
      }
    });
    this.on(this, "ue-reset", (event) => {
      if (!this.owns(event.target)) return;
      change(fallback);
    });
  }
};
define("ue-asset-picker", UeAssetPicker);

// design-system/src/DetailsHeader/DetailsHeader.ts
var UeDetailsHeader = class extends UeElement {
  setup() {
    const label = this.one(".DetailsHeader-label");
    if (label) this.wireLabel(label);
  }
  // Enter commits, Escape restores the text from before the edit. The instance row shows the committed name.
  wireLabel(label) {
    let before = label.textContent ?? "";
    this.on(label, "focus", () => {
      before = label.textContent ?? "";
    });
    this.on(label, "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        label.blur();
      } else if (event.key === "Escape") {
        label.textContent = before;
        label.blur();
      }
    });
    this.on(label, "blur", () => {
      const text = (label.textContent ?? "").trim();
      label.textContent = text === "" ? before : text;
      for (const name of this.all(".DetailsHeader-instance .DetailsHeader-instanceName")) name.textContent = label.textContent;
    });
  }
};
define("ue-details-header", UeDetailsHeader);

// design-system/src/DetailsSearchRow/DetailsSearchRow.ts
var UeDetailsSearchRow = class extends UeElement {
  setup() {
    this.on(this, "ue-text-input", (event) => {
      if (this.owns(event.target)) this.emit("ue-search", { text: event.detail.value });
    });
    this.on(this, "ue-button-click", (event) => {
      const star = this.owns(event.target) ? event.target.querySelector('[data-role="favorites"]') : null;
      if (!star) return;
      const on = event.detail.pressed === true;
      star.title = on ? "Toggle Favorites (on)" : "Toggle Favorites";
      this.emit("ue-favorites", { on });
    });
    this.on(this, "ue-combo-pick", (event) => {
      if (!this.owns(event.target)) return;
      const { value, checked } = event.detail;
      this.emit("ue-view-option", { option: value, checked: checked === true });
    });
  }
};
define("ue-details-search-row", UeDetailsSearchRow);

// design-system/src/FilterPills/FilterPills.ts
var CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
var UeFilterPills = class extends UeElement {
  #strip = null;
  setup() {
    const strip = this.all(".FilterPills-strip").find((candidate) => this.owns(candidate)) ?? this.#createStrip();
    this.#strip = strip;
    this.on(strip, "click", (event) => {
      if (!this.owns(event.target)) return;
      const target = event.target;
      const remove = target.closest(".FilterPills-chipRemove");
      const chip = remove?.closest(".FilterPills-chip");
      if (chip) {
        this.removeChip(this.#chipId(chip));
        return;
      }
      const pill = target.closest(".FilterPills-pill");
      if (pill && strip.contains(pill)) this.#select(pill, false);
    });
    this.on(strip, "keydown", (event) => {
      if (!this.owns(event.target)) return;
      const pills = this.#pills();
      const at = pills.indexOf(document.activeElement);
      if (at < 0) return;
      let next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % pills.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + pills.length) % pills.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = pills.length - 1;
      if (next < 0) return;
      event.preventDefault();
      this.#select(pills[next], true);
    });
    if (this.#pills().length > 0 && !strip.hasAttribute("role")) strip.setAttribute("role", "tablist");
    if (strip.classList.contains("FilterPills-strip--chips")) strip.setAttribute("role", "list");
  }
  #createStrip() {
    const strip = document.createElement("div");
    strip.className = "FilterPills-strip";
    this.append(strip);
    return strip;
  }
  #pills() {
    return Array.from(this.#strip?.querySelectorAll(".FilterPills-pill") ?? []);
  }
  #chips() {
    return Array.from(this.#strip?.querySelectorAll(".FilterPills-chip") ?? []);
  }
  #valueOf(pill) {
    return pill.dataset.value ?? (pill.textContent ?? "").trim();
  }
  #chipId(chip) {
    return chip.dataset.id ?? (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim();
  }
  // The value of the checked pill, or an empty string when no pill is checked.
  get value() {
    const checked = this.#pills().find((pill) => pill.classList.contains("is-checked"));
    return checked ? this.#valueOf(checked) : "";
  }
  // Checks the pill with this value. It fires ue-filter-change when that changes the checked pill.
  set value(value) {
    const pill = this.#pills().find((candidate) => this.#valueOf(candidate) === value);
    if (pill) this.#select(pill, false);
  }
  #select(pill, focus) {
    const changed = !pill.classList.contains("is-checked");
    for (const other of this.#pills()) {
      const on = other === pill;
      other.classList.toggle("is-checked", on);
      other.setAttribute("aria-selected", String(on));
      other.tabIndex = on ? 0 : -1;
    }
    if (focus) pill.focus();
    if (changed) this.emit("ue-filter-change", { value: this.#valueOf(pill), label: (pill.textContent ?? "").trim() });
  }
  // Replaces every pill. The first pill with checked set is checked; with none, no pill is checked.
  setPills(pills) {
    const strip = this.#strip;
    if (!strip) return;
    const drawn = pills.map((data) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "FilterPills-pill" + (data.checked ? " is-checked" : "");
      pill.setAttribute("role", "tab");
      pill.setAttribute("aria-selected", String(data.checked === true));
      pill.dataset.value = data.value;
      pill.textContent = data.label;
      return pill;
    });
    strip.replaceChildren(...drawn);
    strip.setAttribute("role", "tablist");
    const stop = drawn.find((pill) => pill.classList.contains("is-checked")) ?? drawn[0];
    for (const pill of drawn) pill.tabIndex = pill === stop ? 0 : -1;
  }
  // The chips in order.
  getChips() {
    return this.#chips().map((chip) => ({ id: this.#chipId(chip), label: (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim(), color: chip.querySelector(".FilterPills-chipColor")?.style.background || void 0 }));
  }
  // Adds a removable chip at the end. An id that is already there is ignored.
  addChip(data) {
    const strip = this.#strip;
    if (!strip || this.#chips().some((chip2) => this.#chipId(chip2) === data.id)) return;
    strip.classList.add("FilterPills-strip--chips");
    strip.setAttribute("role", "list");
    const chip = document.createElement("span");
    chip.className = "FilterPills-chip";
    chip.setAttribute("role", "listitem");
    chip.dataset.id = data.id;
    chip.setAttribute("aria-label", "Filter: " + data.label);
    const color = document.createElement("span");
    color.className = "FilterPills-chipColor";
    if (data.color) color.style.background = data.color;
    const name = document.createElement("span");
    name.className = "FilterPills-chipName";
    name.textContent = data.label;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "FilterPills-chipRemove";
    remove.setAttribute("aria-label", "Remove " + data.label + " filter");
    remove.innerHTML = CROSS;
    chip.append(color, name, remove);
    strip.append(chip);
    strip.hidden = false;
    this.emit("ue-pill-add", { id: data.id, label: data.label, color: data.color });
  }
  // Removes the chip with this id. It fires ue-pill-remove.
  removeChip(id) {
    const chip = this.#chips().find((candidate) => this.#chipId(candidate) === id);
    if (!chip) return;
    const detail = { id, label: (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim() };
    chip.remove();
    if (this.#strip && this.#chips().length === 0) this.#strip.hidden = true;
    this.emit("ue-pill-remove", detail);
  }
  // Replaces every chip. It fires ue-pill-add for each new chip and ue-pill-remove for each chip that was dropped.
  setChips(chips) {
    const wanted = new Set(chips.map((chip) => chip.id));
    for (const have of this.getChips()) if (!wanted.has(have.id)) this.removeChip(have.id);
    for (const chip of chips) this.addChip(chip);
  }
};
define("ue-filter-pills", UeFilterPills);

// design-system/src/SpinBox/SpinBox.ts
var DRAG_TRIGGER = 5;
var MIN_SLIDER_WIDTH = 100;
function numberAttr(el, name) {
  const raw = el.dataset[name];
  if (raw === void 0 || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function rangeOf(box) {
  const min = numberAttr(box, "min");
  const max = numberAttr(box, "max");
  return { min: min ?? -Infinity, max: max ?? Infinity, bounded: min !== null && max !== null, delta: numberAttr(box, "delta") ?? numberAttr(box, "step") ?? 0 };
}
function valueOf(box) {
  return numberAttr(box, "value") ?? 0;
}
function format(value) {
  const rounded = Math.round(value * 1e3) / 1e3;
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}
function clamp(value, range) {
  return Math.min(range.max, Math.max(range.min, value));
}
var UeSpinBoxElement = class extends UeElement {
  #drags = /* @__PURE__ */ new WeakMap();
  // The current value. The setter redraws the box and fires no ue-spin-change, because the owner that sets it already knows.
  get value() {
    const box = this.one(".spinbox");
    return box ? valueOf(box) : 0;
  }
  set value(next) {
    const box = this.one(".spinbox");
    if (!box) throw new Error("ue-spin-box needs a .spinbox element");
    box.dataset.value = String(next);
    this.#render(box);
  }
  setup() {
    const box = this.one(".spinbox");
    if (!box) throw new Error("ue-spin-box needs a .spinbox element");
    this.#render(box);
    this.on(box, "pointerdown", (event) => {
      if (event.button !== 0 || box.getAttribute("aria-disabled") === "true") return;
      if (box.classList.contains("spinbox--text")) return;
      box.setPointerCapture(event.pointerId);
      this.#drags.set(box, { pointerId: event.pointerId, lastX: event.clientX, distance: 0, dragging: false, before: valueOf(box), internal: valueOf(box) });
      box.focus();
      event.preventDefault();
    });
    this.on(box, "pointermove", (event) => {
      const state = this.#drags.get(box);
      if (!state || state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.lastX;
      state.lastX = event.clientX;
      if (!state.dragging) {
        state.distance += Math.abs(dx);
        if (state.distance > DRAG_TRIGGER) {
          state.dragging = true;
          box.classList.add("spinbox--active");
        }
        return;
      }
      this.#drag(box, state, dx);
    });
    const finish = (event) => {
      const state = this.#drags.get(box);
      if (!state || state.pointerId !== event.pointerId) return;
      this.#drags.delete(box);
      if (box.hasPointerCapture(event.pointerId)) box.releasePointerCapture(event.pointerId);
      box.classList.remove("spinbox--active");
      if (event.type === "pointercancel") return;
      if (state.dragging) {
        const range = rangeOf(box);
        if (range.delta > 0) this.#set(box, clamp(Math.round(valueOf(box) / range.delta) * range.delta, range));
      } else {
        this.#enterText(box);
      }
    };
    this.on(box, "pointerup", finish);
    this.on(box, "pointercancel", finish);
    this.on(box, "keydown", (event) => {
      if (box.getAttribute("aria-disabled") === "true") return;
      const state = this.#drags.get(box);
      if (event.key === "Escape" && state?.dragging) {
        this.#drags.delete(box);
        if (box.hasPointerCapture(state.pointerId)) box.releasePointerCapture(state.pointerId);
        box.classList.remove("spinbox--active");
        this.#set(box, state.before);
        event.preventDefault();
        return;
      }
      if (event.target !== box) return;
      const range = rangeOf(box);
      if (event.key === "ArrowUp" || event.key === "ArrowRight") this.#set(box, clamp(valueOf(box) + range.delta, range));
      else if (event.key === "ArrowDown" || event.key === "ArrowLeft") this.#set(box, clamp(valueOf(box) - range.delta, range));
      else if (event.key === "Enter") this.#enterText(box);
      else return;
      event.preventDefault();
    });
    this.on(box, "focusout", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.classList.contains("spinbox__field")) this.#exitText(box, true, false);
    });
  }
  // The value change of one mouse move while dragging, from SSpinBox::OnMouseMove.
  #drag(box, state, dx) {
    const range = rangeOf(box);
    const width = Math.max(box.getBoundingClientRect().width, MIN_SLIDER_WIDTH);
    let next;
    if (range.bounded) {
      const step = range.max - range.min <= 10 ? 0.1 : 1;
      const filled = Math.min(width, Math.max(0, (state.internal - range.min) / (range.max - range.min) * width + dx * step));
      next = range.min + filled / width * (range.max - range.min);
    } else {
      const sign = dx > 0 ? 1 : -1;
      next = state.internal + sign * (Math.abs(dx) / width) * Math.max(Math.abs(state.internal), 1);
    }
    state.internal = clamp(next, range);
    this.#set(box, state.internal);
  }
  #set(box, value) {
    const before = valueOf(box);
    box.dataset.value = String(value);
    this.#render(box);
    if (value !== before) this.emit("ue-spin-change", { value, text: format(value) + (box.dataset.unit ? " " + box.dataset.unit : "") });
  }
  #render(box) {
    const range = rangeOf(box);
    const value = valueOf(box);
    box.setAttribute("aria-valuenow", String(value));
    if (range.bounded) {
      box.setAttribute("aria-valuemin", String(range.min));
      box.setAttribute("aria-valuemax", String(range.max));
      box.style.setProperty("--spinbox-fill", String((value - range.min) / (range.max - range.min)));
    }
    box.classList.toggle("spinbox--unbounded", !range.bounded);
    const text = box.querySelector(".spinbox__text");
    if (text && !box.classList.contains("spinbox--text")) text.textContent = format(value);
    const unit = box.dataset.unit;
    let suffix = box.querySelector(".spinbox__unit");
    if (unit && !suffix && text) {
      suffix = document.createElement("span");
      suffix.className = "spinbox__unit";
      text.after(suffix);
    }
    if (suffix) suffix.textContent = unit ?? "";
  }
  #enterText(box) {
    const text = box.querySelector(".spinbox__text");
    if (!text) return;
    box.classList.add("spinbox--text");
    const field = document.createElement("input");
    field.className = "spinbox__field";
    field.type = "text";
    field.value = format(valueOf(box));
    field.setAttribute("aria-label", "Value");
    text.replaceChildren(field);
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.#exitText(box, true, true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.#exitText(box, false, true);
      }
    });
    field.focus();
    field.select();
  }
  #exitText(box, commit, refocus) {
    const field = box.querySelector(".spinbox__field");
    if (!field || !box.classList.contains("spinbox--text")) return;
    const typed = Number(field.value.trim());
    box.classList.remove("spinbox--text");
    const range = rangeOf(box);
    if (commit && field.value.trim() !== "" && Number.isFinite(typed)) this.#set(box, clamp(typed, range));
    else this.#render(box);
    if (refocus) box.focus();
  }
};
define("ue-spin-box", UeSpinBoxElement);

// design-system/src/VectorInput/VectorInput.ts
var round = (value) => Math.round(value * 1e6) / 1e6;
var UeVectorInput = class extends UeElement {
  // The values of each row as of the last change, which is the basis of the lock ratio.
  #last = /* @__PURE__ */ new WeakMap();
  setup() {
    for (const row of this.all(".VectorInput-row")) {
      if (!this.owns(row)) continue;
      this.#last.set(row, this.#read(row));
      this.#syncReset(row, this.#read(row));
    }
    this.on(this, "ue-spin-change", (event) => {
      const row = this.#rowOf(event.target);
      if (!row) return;
      const fields = this.#fields(row);
      const index = fields.indexOf(event.target);
      const values = this.#read(row);
      const before = this.#last.get(row) ?? values;
      if (this.#locked(row)) {
        for (let j = 0; j < fields.length; j++) {
          if (j === index) continue;
          values[j] = before[index] === 0 ? values[index] : round(before[j] * values[index] / before[index]);
          fields[j].value = values[j];
        }
      }
      this.#commit(row, values);
    });
    this.on(this, "ue-reset", (event) => {
      const row = this.#rowOf(event.target);
      if (!row) return;
      const defaults = (row.dataset.default ?? "").split(",").map(Number);
      this.#fields(row).forEach((field, i) => {
        field.value = defaults[i];
      });
      this.#commit(row, defaults);
    });
    this.on(this, "ue-button-click", (event) => {
      const lock = this.#rowOf(event.target) ? event.target.querySelector('[data-role="lock"]') : null;
      if (lock) lock.title = event.detail.pressed ? "Scale uniformly (locked)" : "Scale uniformly (unlocked)";
    });
    this.on(this, "ue-combo-pick", (event) => {
      if (this.#rowOf(event.target)) this.emit("ue-vector-space", { space: event.detail.label });
    });
  }
  // The row of this element that holds the target, or null for a target of a nested instance.
  #rowOf(target) {
    if (!this.owns(target)) return null;
    return target.closest(".VectorInput-row");
  }
  #fields(row) {
    return Array.from(row.querySelectorAll("ue-spin-box"));
  }
  #read(row) {
    return Array.from(row.querySelectorAll(".spinbox"), (box) => Number(box.dataset.value));
  }
  #locked(row) {
    return row.querySelector('[data-role="lock"]')?.getAttribute("aria-pressed") === "true";
  }
  // Shows the reset arrow only while a value differs from its default.
  #syncReset(row, values) {
    const defaults = (row.dataset.default ?? "").split(",").map(Number);
    row.querySelector("ue-reset-to-default")?.toggleAttribute("differs", values.some((value, i) => Math.abs(value - defaults[i]) > 1e-9));
  }
  #commit(row, values) {
    this.#last.set(row, values);
    this.#syncReset(row, values);
    this.emit("ue-vector-change", { values });
  }
};
define("ue-vector-input", UeVectorInput);

// design-system/src/DetailsCategory/DetailsCategory.ts
var isIn = (el, selector) => el.closest(selector);
var isRow = (el) => el.classList.contains("DetailsCategory-row") || el.dataset.label !== void 0;
var UeDetailsCategory = class extends UeElement {
  #query = "";
  #section = "";
  #onlyModified = false;
  setup() {
    const frame = this.one(".DetailsCategory-frame");
    if (!frame) return;
    this.#section = this.one(".FilterPills-pill.is-checked")?.dataset.value ?? "";
    this.wireFrame(frame);
    this.wireControls(frame);
    for (const row of this.all(".DetailsCategory-row")) this.syncReset(row);
    this.refresh(frame);
  }
  // The panel controls announce themselves with events. The tree only listens.
  wireControls(frame) {
    this.on(this, "ue-search", (event) => {
      this.#query = event.detail.text.trim().toLowerCase();
      this.refresh(frame);
    });
    this.on(this, "ue-filter-change", (event) => {
      this.#section = event.detail.value;
      this.refresh(frame);
    });
    this.on(this, "ue-view-option", (event) => {
      const { option, checked } = event.detail;
      if (option === "modified") this.#onlyModified = checked;
      else if (option === "collapseAll" || option === "expandAll") {
        for (const cat of this.all(".DetailsCategory-cat")) cat.classList.toggle("is-collapsed", option === "collapseAll");
      }
      this.refresh(frame);
    });
=======
// design-system/src/DetailsCategory/DetailsCategory.ts
var DOWN = "#DetailsCategory-down";
var RIGHT = "#DetailsCategory-right";
var isIn = (el, selector) => el.closest(selector);
var UeDetailsCategory = class extends UeElement {
  setup() {
    const frame = this.one(".DetailsCategory-frame");
    if (!frame) return;
    this.wireFrame(frame);
    if (this.one(".DetailsCategory-panel")) this.wirePanel(frame);
    for (const row of this.all(".DetailsCategory-row")) this.syncReset(row);
    this.refresh(frame);
  }
  query() {
    return (this.one(".DetailsCategory-srInput")?.value ?? "").trim().toLowerCase();
  }
  section() {
    return this.one(".DetailsCategory-pill.is-checked")?.dataset.section ?? "";
  }
  modifiedOnly() {
    return this.one('[data-option="modified"]')?.getAttribute("aria-checked") === "true";
>>>>>>> origin/master
  }
  wireFrame(frame) {
    this.on(frame, "click", (event) => {
      const target = event.target;
      const catRow = isIn(target, ".DetailsCategory-catRow");
      const advRow = isIn(target, ".DetailsCategory-advRow");
      const arrow = isIn(target, ".DetailsCategory-rowArrow.has-children");
<<<<<<< HEAD
      if (catRow) catRow.closest(".DetailsCategory-cat")?.classList.toggle("is-collapsed");
      else if (advRow) advRow.closest(".DetailsCategory-adv")?.classList.toggle("is-open");
      else if (arrow) arrow.closest(".DetailsCategory-row")?.classList.toggle("is-collapsed");
      else return;
=======
      const check = isIn(target, '.DetailsCategory-check[role="checkbox"]');
      const reset = isIn(target, '.DetailsCategory-reset[role="button"]');
      if (catRow) catRow.closest(".DetailsCategory-cat")?.classList.toggle("is-collapsed");
      else if (advRow) advRow.closest(".DetailsCategory-adv")?.classList.toggle("is-open");
      else if (arrow) arrow.closest(".DetailsCategory-row")?.classList.toggle("is-collapsed");
      else if (check) {
        const on = check.getAttribute("aria-checked") !== "true";
        check.setAttribute("aria-checked", String(on));
        check.classList.toggle("is-off", !on);
        return;
      } else if (reset) {
        const row = reset.closest(".DetailsCategory-row");
        const text = row?.querySelector(".DetailsCategory-text");
        if (row && text) {
          text.textContent = row.dataset.default ?? "";
          this.syncReset(row);
          this.refresh(frame);
        }
        return;
      } else return;
>>>>>>> origin/master
      this.refresh(frame);
    });
    this.on(frame, "keydown", (event) => {
      const target = event.target;
      const catRow = target.matches(".DetailsCategory-catRow") ? target.closest(".DetailsCategory-cat") : null;
      if (catRow && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        catRow.classList.toggle("is-collapsed", event.key === "ArrowLeft");
        this.refresh(frame);
        return;
      }
<<<<<<< HEAD
      const activates = target.matches(".DetailsCategory-catRow, .DetailsCategory-advRow, .DetailsCategory-rowArrow");
=======
      const activates = target.matches(".DetailsCategory-catRow, .DetailsCategory-advRow, .DetailsCategory-rowArrow, .DetailsCategory-check, .DetailsCategory-reset");
>>>>>>> origin/master
      if (activates && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
    this.on(frame, "focusin", (event) => {
<<<<<<< HEAD
      const field = this.fieldOf(event.target);
      if (field) field.dataset.before = field.value;
    });
    this.on(frame, "keydown", (event) => {
      const field = this.fieldOf(event.target);
      if (!field) return;
      if (event.key === "Enter") field.blur();
      else if (event.key === "Escape") {
        field.value = field.dataset.before ?? "";
        this.touched(field);
        field.blur();
      } else return;
      event.preventDefault();
    });
    this.on(frame, "ue-text-input", (event) => this.touched(event.target));
    this.on(frame, "ue-spin-change", (event) => this.touched(event.target));
    this.on(frame, "ue-vector-change", () => this.refresh(frame));
    this.on(frame, "ue-asset-change", () => this.refresh(frame));
    this.on(frame, "ue-reset", (event) => {
      const row = isIn(event.target, ".DetailsCategory-row");
      if (!row) return;
      const def = row.dataset.default ?? "";
      const field = row.querySelector(".textinput__field");
      const spin = row.querySelector("ue-spin-box");
      if (field) field.value = def;
      else if (spin) spin.value = Number(def);
=======
      const text = isIn(event.target, ".DetailsCategory-text");
      if (text) text.dataset.before = text.textContent ?? "";
    });
    this.on(frame, "keydown", (event) => {
      const text = isIn(event.target, ".DetailsCategory-text");
      if (!text) return;
      if (event.key === "Enter") {
        event.preventDefault();
        text.blur();
      } else if (event.key === "Escape") {
        text.textContent = text.dataset.before ?? "";
        text.blur();
      }
    });
    this.on(frame, "focusout", (event) => {
      const text = isIn(event.target, ".DetailsCategory-text");
      const row = text?.closest(".DetailsCategory-row");
      if (!text || !row) return;
      text.textContent = (text.textContent ?? "").trim();
>>>>>>> origin/master
      this.syncReset(row);
      this.refresh(frame);
    });
  }
<<<<<<< HEAD
  // The text field of a row value, or null for any other target.
  fieldOf(target) {
    const el = target;
    const field = el instanceof HTMLInputElement && el.classList.contains("textinput__field") ? el : null;
    return field && isIn(field, ".DetailsCategory-row") ? field : null;
  }
  touched(target) {
    const row = isIn(target, ".DetailsCategory-row");
    const frame = row?.closest(".DetailsCategory-frame");
    if (!row || !frame) return;
    this.syncReset(row);
    this.refresh(frame);
  }
  valueOf(row) {
    const field = row.querySelector(".textinput__field");
    if (field) return field.value;
    return row.querySelector(".spinbox")?.dataset.value ?? null;
  }
  // The reset arrow shows only while the value differs from the row default.
  syncReset(row) {
    const reset = row.querySelector("ue-reset-to-default");
    const value = this.valueOf(row);
    if (!reset || value === null || row.dataset.default === void 0) return;
    reset.toggleAttribute("differs", value !== row.dataset.default);
  }
  // Recomputes which cats, rows and the Advanced bar show, and the arrow states.
  refresh(frame) {
    const query = this.#query;
    const searching = query !== "";
    const section = this.#section;
    const onlyModified = this.#onlyModified;
    const children = [];
    for (const child of Array.from(frame.children)) {
      if (child.localName.startsWith("ue-")) children.push(...Array.from(child.children));
      else children.push(child);
    }
    const items = [];
    for (const el of children) {
      if (el.classList.contains("DetailsCategory-cat")) items.push({ el, kind: "cat", level: 0, matchesText: true, isModified: true });
      else if (el.classList.contains("DetailsCategory-adv")) items.push({ el, kind: "adv", level: 0, matchesText: true, isModified: true });
      else if (isRow(el)) {
        const label = (el.dataset.label ?? el.querySelector(".DetailsCategory-label")?.textContent ?? "").toLowerCase();
=======
  // The reset arrow shows only while the text differs from the row default.
  syncReset(row) {
    const text = row.querySelector(".DetailsCategory-text");
    const reset = row.querySelector('.DetailsCategory-reset[role="button"]');
    if (!text || !reset || row.dataset.default === void 0) return;
    const idle = (text.textContent ?? "") === row.dataset.default;
    reset.classList.toggle("is-idle", idle);
    reset.tabIndex = idle ? -1 : 0;
  }
  wirePanel(frame) {
    const input = this.one(".DetailsCategory-srInput");
    const clear = this.one(".DetailsCategory-srClear");
    if (input && clear) {
      const sync = () => {
        input.classList.toggle("has-value", input.value !== "");
        clear.classList.toggle("is-hidden", input.value === "");
        this.refresh(frame);
      };
      const wipe = () => {
        input.value = "";
        sync();
        input.focus();
      };
      this.on(input, "input", sync);
      this.on(input, "keydown", (event) => {
        if (event.key === "Escape" && input.value !== "") {
          event.preventDefault();
          wipe();
        }
      });
      this.on(clear, "click", wipe);
    }
    const name = this.one(".DetailsCategory-hdrName");
    if (name) {
      let before = name.textContent ?? "";
      this.on(name, "focus", () => {
        before = name.textContent ?? "";
      });
      this.on(name, "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          name.blur();
        } else if (event.key === "Escape") {
          name.textContent = before;
          name.blur();
        }
      });
      this.on(name, "blur", () => {
        const text = (name.textContent ?? "").trim();
        name.textContent = text === "" ? before : text;
      });
    }
    const lock = this.one('[data-role="lock"]');
    if (lock) {
      this.on(lock, "click", () => {
        const on = lock.getAttribute("aria-pressed") !== "true";
        lock.setAttribute("aria-pressed", String(on));
        lock.querySelector("use")?.setAttribute("href", on ? "#DetailsCategory-locked" : "#DetailsCategory-unlock");
      });
    }
    const star = this.one('[data-role="favorites"]');
    if (star) {
      this.on(star, "click", () => {
        const on = star.getAttribute("aria-pressed") !== "true";
        star.setAttribute("aria-pressed", String(on));
        star.classList.toggle("is-on", on);
      });
    }
    const gear = this.one('[data-role="options"]');
    const menu = this.one(".DetailsCategory-menu");
    if (gear && menu) {
      const handle = wireMenu({
        trigger: gear,
        menu,
        itemSelector: ".DetailsCategory-menuItem",
        onPick: (item) => {
          const option = item.dataset.option;
          if (option === "modified") item.setAttribute("aria-checked", String(item.getAttribute("aria-checked") !== "true"));
          else if (option === "collapseAll" || option === "expandAll") {
            for (const cat of this.all(".DetailsCategory-cat")) cat.classList.toggle("is-collapsed", option === "collapseAll");
          }
          this.refresh(frame);
        }
      });
      this.onDispose(handle.dispose);
    }
    const strip = this.one(".DetailsCategory-pills");
    if (strip) {
      const pills = () => Array.from(strip.querySelectorAll(".DetailsCategory-pill"));
      const select = (pill, focus) => {
        for (const other of pills()) {
          other.classList.toggle("is-checked", other === pill);
          other.setAttribute("aria-selected", String(other === pill));
          other.tabIndex = other === pill ? 0 : -1;
        }
        if (focus) pill.focus();
        this.refresh(frame);
      };
      this.on(strip, "click", (event) => {
        const pill = isIn(event.target, ".DetailsCategory-pill");
        if (pill) select(pill, false);
      });
      this.on(strip, "keydown", (event) => {
        const all = pills();
        const at = all.indexOf(document.activeElement);
        if (at < 0) return;
        let next = -1;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % all.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + all.length) % all.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = all.length - 1;
        if (next < 0) return;
        event.preventDefault();
        select(all[next], true);
      });
    }
  }
  // Recomputes which cats, rows and the Advanced bar show, and the arrow glyphs.
  refresh(frame) {
    const query = this.query();
    const searching = query !== "";
    const section = this.section();
    const onlyModified = this.modifiedOnly();
    const items = [];
    for (const el of Array.from(frame.children)) {
      if (el.classList.contains("DetailsCategory-cat")) items.push({ el, kind: "cat", level: 0, matchesText: true, isModified: true });
      else if (el.classList.contains("DetailsCategory-adv")) items.push({ el, kind: "adv", level: 0, matchesText: true, isModified: true });
      else if (el.classList.contains("DetailsCategory-row")) {
        const label = (el.querySelector(".DetailsCategory-label")?.textContent ?? "").toLowerCase();
        const reset = el.querySelector('.DetailsCategory-reset[role="button"]');
>>>>>>> origin/master
        items.push({
          el,
          kind: "row",
          level: el.querySelectorAll(":scope > .DetailsCategory-indent").length,
          matchesText: !searching || label.includes(query),
<<<<<<< HEAD
          isModified: !onlyModified || el.querySelector("ue-reset-to-default[differs]") !== null
=======
          isModified: !onlyModified || reset !== null && !reset.classList.contains("is-idle")
>>>>>>> origin/master
        });
      }
    }
    const keep = items.map((item, i) => {
      if (item.kind !== "row") return true;
      let textOk = item.matchesText;
      let modOk = item.isModified;
      let want = item.level;
      for (let j = i - 1; j >= 0 && items[j].kind !== "cat" && want > 0; j--) {
        if (items[j].kind === "row" && items[j].level < want) {
          textOk = textOk || items[j].matchesText;
          want = items[j].level;
        }
      }
      for (let j = i + 1; j < items.length && items[j].kind === "row" && items[j].level > item.level; j++) {
        textOk = textOk || items[j].matchesText;
        modOk = modOk || items[j].isModified;
      }
      return textOk && modOk;
    });
    let anyCatShown = false;
    let cat = null;
    let catHidden = false;
    let catFolded = false;
    let catHasRows = false;
    let advOpen = true;
    let inAdv = false;
    const closed = [];
    const finishCat = () => {
      if (!cat) return;
      const empty = !catHasRows && (searching || onlyModified);
      cat.classList.toggle("is-hidden", catHidden || empty);
      if (!catHidden && !empty) anyCatShown = true;
    };
    items.forEach((item, i) => {
      const { el } = item;
      if (item.kind === "cat") {
        finishCat();
        cat = el;
        const own = el.dataset.section;
        catHidden = section !== "" && own !== void 0 && own !== section;
        catFolded = el.classList.contains("is-collapsed") && !searching;
        catHasRows = false;
        inAdv = false;
        closed.length = 0;
<<<<<<< HEAD
=======
        this.setArrow(el.querySelector(".DetailsCategory-arrow use"), !catFolded);
>>>>>>> origin/master
        el.querySelector(".DetailsCategory-catRow")?.setAttribute("aria-expanded", String(!catFolded));
      } else if (item.kind === "adv") {
        inAdv = true;
        advOpen = el.classList.contains("is-open") || searching;
        el.classList.toggle("is-hidden", catHidden || catFolded || searching);
<<<<<<< HEAD
=======
        this.setArrow(el.querySelector(".DetailsCategory-arrow use"), advOpen);
>>>>>>> origin/master
        el.querySelector(".DetailsCategory-advRow")?.setAttribute("aria-expanded", String(advOpen));
      } else {
        closed.length = item.level;
        const parentClosed = !searching && closed.some(Boolean);
        const hidden = catHidden || catFolded || parentClosed || inAdv && !advOpen || !keep[i];
        el.classList.toggle("is-hidden", hidden);
        const toggle = el.querySelector(".DetailsCategory-rowArrow.has-children");
        const folded = toggle !== null && el.classList.contains("is-collapsed") && !searching;
        closed[item.level] = folded;
<<<<<<< HEAD
        toggle?.setAttribute("aria-expanded", String(!folded));
=======
        if (toggle) {
          this.setArrow(toggle.querySelector("use"), !folded);
          toggle.setAttribute("aria-expanded", String(!folded));
        }
>>>>>>> origin/master
        if (!hidden) catHasRows = true;
      }
    });
    finishCat();
    frame.querySelector(".DetailsCategory-empty")?.classList.toggle("is-shown", !anyCatShown && (searching || section !== "" || onlyModified));
  }
<<<<<<< HEAD
=======
  setArrow(use, expanded) {
    use?.setAttribute("href", expanded ? DOWN : RIGHT);
  }
>>>>>>> origin/master
};
define("ue-details-category", UeDetailsCategory);
