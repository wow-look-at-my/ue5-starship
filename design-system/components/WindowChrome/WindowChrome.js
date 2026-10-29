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

// design-system/src/MenuBar/MenuBar.ts
var ITEM = ".menuBar-item";
var ROW = ".menuBar-row";
var MENU = ".menuBar-menu";
var MenuBar = class extends UeElement {
  setup() {
    const items = () => this.all(ITEM);
    const openItem = () => this.one(ITEM + ".is-open");
    const menuOf = (item) => {
      const menu = item.nextElementSibling;
      return menu instanceof HTMLElement && menu.matches(MENU) ? menu : null;
    };
    const itemOf = (menu) => {
      const item = menu.previousElementSibling;
      return item instanceof HTMLElement && item.matches(ITEM) ? item : null;
    };
    const setCurrent = (item) => {
      for (const other of items()) other.tabIndex = other === item ? 0 : -1;
    };
    const close = (restoreFocus) => {
      const item = openItem();
      if (!item) return;
      item.classList.remove("is-open");
      item.setAttribute("aria-expanded", "false");
      if (restoreFocus) item.focus();
    };
    const open = (item, rows) => {
      const menu = menuOf(item);
      if (!menu) return;
      for (const other of items()) {
        if (other === item) continue;
        other.classList.remove("is-open");
        other.setAttribute("aria-expanded", "false");
      }
      item.classList.add("is-open");
      item.setAttribute("aria-expanded", "true");
      setCurrent(item);
      if (rows === "none") return;
      const list = enabledRows(menu, ROW);
      if (list.length > 0) (rows === "first" ? list[0] : list[list.length - 1]).focus();
    };
    const step = (item, delta) => {
      const list = items();
      return list[(list.indexOf(item) + delta + list.length) % list.length];
    };
    this.on(this, "pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || event.button !== 0) return;
      const item = target.closest(ITEM);
      if (!item || !this.contains(item)) return;
      if (item.classList.contains("is-open")) close(false);
      else open(item, "none");
    });
    this.on(this, "pointerover", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest(ROW);
      if (row) {
        if (row.getAttribute("aria-disabled") !== "true") row.focus({ preventScroll: true });
        return;
      }
      const item = target.closest(ITEM);
      if (item && openItem() && !item.classList.contains("is-open")) open(item, "none");
    });
    this.on(this, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest(ROW);
      if (!row || row.getAttribute("aria-disabled") === "true") return;
      this.emit("ue-menu-select", { label: rowLabel(row, ".menuBar-label") });
      close(true);
    });
    this.on(this, "keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const key = event.key;
      const row = target.closest(ROW);
      const item = row ? itemOf(row.closest(MENU) ?? row) : target.closest(ITEM);
      if (!item) return;
      if (key === "Escape") {
        if (!openItem()) return;
        event.preventDefault();
        close(true);
        return;
      }
      if (key === "Tab") {
        close(false);
        return;
      }
      if (key === "ArrowRight" || key === "ArrowLeft") {
        event.preventDefault();
        const next = step(item, key === "ArrowRight" ? 1 : -1);
        if (row) open(next, "first");
        else {
          next.focus();
          setCurrent(next);
          if (openItem()) open(next, "none");
        }
        return;
      }
      if (row) {
        if (moveRowFocus(enabledRows(row.closest(MENU) ?? row, ROW), row, key)) event.preventDefault();
        else if (key === "Enter" || key === " ") {
          event.preventDefault();
          row.click();
        }
        return;
      }
      if (key === "ArrowDown" || key === "Enter" || key === " ") {
        event.preventDefault();
        open(item, "first");
      } else if (key === "ArrowUp") {
        event.preventDefault();
        open(item, "last");
      }
    });
    this.on(document, "pointerdown", (event) => {
      if (event.target instanceof Node && !this.contains(event.target)) close(false);
    });
  }
};
define("ue-menu-bar", MenuBar);

// design-system/src/WindowChrome/WindowChrome.ts
var MAXIMIZE_GLYPH = "#windowChrome-i-max";
var RESTORE_GLYPH = "#windowChrome-i-restore";
var WindowChromeElement = class extends UeElement {
  setup() {
    const frame = this.one(".windowChrome-frame");
    if (!frame) throw new Error("ue-window-chrome needs a .windowChrome-frame child");
    const status = this.one(".windowChrome-status");
    const reopenHost = this.one(".windowChrome-reopen");
    const reopen = reopenHost?.querySelector(".button") ?? null;
    const setActive = (active) => {
      frame.dataset.active = String(active);
      if (status) status.textContent = active ? "Window active" : "Window inactive";
    };
    setActive(frame.contains(document.activeElement));
    this.on(this, "focusin", () => setActive(frame.contains(document.activeElement)));
    this.on(this, "focusout", (event) => setActive(event.relatedTarget instanceof Node && frame.contains(event.relatedTarget)));
    const hideWindow = (label) => {
      frame.hidden = true;
      if (!reopenHost || !reopen) return;
      reopen.textContent = label;
      reopenHost.hidden = false;
      reopen.focus();
    };
    const toggleMaximized = (button) => {
      const maximized = frame.toggleAttribute("data-maximized");
      button.querySelector("use")?.setAttribute("href", maximized ? RESTORE_GLYPH : MAXIMIZE_GLYPH);
      const label = maximized ? "Restore Down" : "Maximize";
      button.setAttribute("aria-label", label);
      button.title = label;
    };
    this.on(this, "click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".windowChrome-reopen")) {
        frame.hidden = false;
        if (reopenHost) reopenHost.hidden = true;
        frame.focus();
        return;
      }
      const button = target?.closest(".button[data-action]");
      if (!button || !frame.contains(button)) return;
      const action = button.dataset.action;
      if (action === "minimize") hideWindow("Window minimized: restore");
      else if (action === "maximize") toggleMaximized(button);
      else if (action === "close") hideWindow("Window closed: reopen");
    });
  }
};
define("ue-window-chrome", WindowChromeElement);
