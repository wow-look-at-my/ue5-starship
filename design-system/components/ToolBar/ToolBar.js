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

// design-system/src/ToolBar/ToolBar.ts
var CONTROL = ".toolBar-btn, .toolBar-modes, .toolBar-wrap, .toolBar-plate";
var TOGGLE = ".toolBar-btn--toggle";
var MENU = ".toolBar-menu";
var ROW = ".toolBar-row";
function isDisabled(el) {
  return el.getAttribute("aria-disabled") === "true";
}
var ToolBar = class extends UeElement {
  setup() {
    const menuOf = (control) => {
      const slot = control.closest(".toolBar-slot");
      return slot ? slot.querySelector(":scope > " + MENU) : null;
    };
    const controlOf = (menu) => {
      const slot = menu.closest(".toolBar-slot");
      return slot ? slot.querySelector(CONTROL) : null;
    };
    const openMenu = () => this.one(MENU + ".is-open");
    const close = (restoreFocus) => {
      const menu = openMenu();
      if (!menu) return;
      menu.classList.remove("is-open");
      const control = controlOf(menu);
      if (!control) return;
      control.setAttribute("aria-expanded", "false");
      if (restoreFocus) control.focus();
    };
    const open = (control, rows) => {
      const menu = menuOf(control);
      if (!menu) return;
      close(false);
      menu.classList.add("is-open");
      control.setAttribute("aria-expanded", "true");
      if (rows === "none") return;
      const list = enabledRows(menu, ROW);
      if (list.length > 0) (rows === "first" ? list[0] : list[list.length - 1]).focus();
    };
    const setPlaying = (bar, playing) => {
      const play = bar.querySelector(".toolBar-plate--play");
      const stop = bar.querySelector(".toolBar-plate--stop");
      if (!play || !stop) return;
      play.classList.toggle("is-pressed", playing);
      play.setAttribute("aria-pressed", String(playing));
      stop.classList.toggle("is-disabled", !playing);
      stop.setAttribute("aria-disabled", String(!playing));
      stop.tabIndex = playing ? 0 : -1;
      if (bar instanceof HTMLElement) bar.dataset.playing = String(playing);
      this.emit("ue-play-change", { playing });
    };
    for (const stop of this.all(".toolBar-plate--stop")) {
      const bar = stop.closest(".toolBar");
      if (bar) setPlaying(bar, bar.getAttribute("data-playing") === "true");
    }
    this.on(this, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest(ROW);
      if (row) {
        if (isDisabled(row)) return;
        this.emit("ue-menu-select", { label: rowLabel(row, ".toolBar-label") });
        close(true);
        return;
      }
      const control = target.closest(CONTROL);
      if (!control || isDisabled(control)) return;
      if (control.matches(TOGGLE)) {
        const checked = control.classList.toggle("is-checked");
        control.setAttribute("aria-pressed", String(checked));
      }
      if (menuOf(control)) {
        if (control.getAttribute("aria-expanded") === "true") close(false);
        else open(control, "none");
        return;
      }
      const bar = control.closest(".toolBar");
      if (!bar) return;
      if (control.matches(".toolBar-plate--play") && bar.getAttribute("data-playing") !== "true") setPlaying(bar, true);
      else if (control.matches(".toolBar-plate--stop")) setPlaying(bar, false);
    });
    this.on(this, "pointerover", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest(ROW);
      if (row && !isDisabled(row)) row.focus({ preventScroll: true });
    });
    this.on(this, "keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const key = event.key;
      const row = target.closest(ROW);
      if (row) {
        if (key === "Escape") {
          event.preventDefault();
          close(true);
        } else if (key === "Tab") close(false);
        else if (moveRowFocus(enabledRows(row.closest(MENU) ?? row, ROW), row, key)) event.preventDefault();
        else if (key === "Enter" || key === " ") {
          event.preventDefault();
          row.click();
        }
        return;
      }
      const control = target.closest(CONTROL);
      if (!control) return;
      if (key === "Escape") {
        if (!openMenu()) return;
        event.preventDefault();
        close(true);
      } else if (key === "Enter" || key === " ") {
        event.preventDefault();
        control.click();
      } else if ((key === "ArrowDown" || key === "ArrowUp") && menuOf(control)) {
        event.preventDefault();
        open(control, key === "ArrowDown" ? "first" : "last");
      } else if (key === "ArrowRight" || key === "ArrowLeft") {
        const bar = control.closest(".toolBar");
        if (!bar) return;
        const list = Array.from(bar.querySelectorAll(CONTROL)).filter((c) => !isDisabled(c));
        const next = list[(list.indexOf(control) + (key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
        event.preventDefault();
        close(false);
        next.focus();
      }
    });
    this.on(document, "pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const menu = openMenu();
      if (!menu || menu.contains(target)) return;
      const control = controlOf(menu);
      if (control && control.contains(target)) return;
      close(false);
    });
  }
};
define("ue-tool-bar", ToolBar);
export {
  ToolBar
};
