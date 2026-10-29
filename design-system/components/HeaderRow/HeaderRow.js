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

// src/HeaderRow/HeaderRow.ts
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
export {
  HeaderRow
};
