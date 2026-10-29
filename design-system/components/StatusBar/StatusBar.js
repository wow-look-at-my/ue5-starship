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

// design-system/src/StatusBar/StatusBar.ts
var DRAWER = ".statusBar-btn";
var COMBO = ".statusBar-combo";
var MENU = ".statusBar-menu";
var ROW = ".statusBar-row";
var MAX_LINES = 4;
var StatusBar = class extends UeElement {
  setup() {
    const field = this.one(".statusBar-field");
    const history = this.one(".statusBar-history");
    const recalled = [];
    let recallIndex = 0;
    const openMenu = () => this.one(MENU + ".is-open");
    const comboOf = (menu) => menu.parentElement?.querySelector(COMBO) ?? null;
    const close = (restoreFocus) => {
      const menu = openMenu();
      if (!menu) return;
      menu.classList.remove("is-open");
      const combo = comboOf(menu);
      if (!combo) return;
      combo.setAttribute("aria-expanded", "false");
      if (restoreFocus) combo.focus();
    };
    const open = (combo, focusFirst) => {
      const menu = combo.parentElement?.querySelector(MENU);
      if (!menu) return;
      close(false);
      menu.classList.add("is-open");
      combo.setAttribute("aria-expanded", "true");
      if (!focusFirst) return;
      const rows = enabledRows(menu, ROW);
      if (rows.length > 0) rows[0].focus();
    };
    const toggleDrawer = (button) => {
      const bar = button.closest(".statusBar");
      const opening = !button.classList.contains("is-open");
      if (bar) {
        for (const other of Array.from(bar.querySelectorAll(DRAWER))) {
          other.classList.remove("is-open");
          other.setAttribute("aria-expanded", "false");
        }
      }
      if (opening) {
        button.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
      const label = button.querySelector(".statusBar-txt")?.textContent ?? "";
      this.emit("ue-drawer-change", { drawer: opening ? label : null });
    };
    const choose = (row) => {
      const label = row.textContent?.trim() ?? "";
      for (const other of Array.from(row.parentElement?.querySelectorAll(ROW) ?? [])) {
        other.setAttribute("aria-checked", String(other === row));
      }
      const combo = comboOf(row.closest(MENU) ?? row);
      const text = combo?.querySelector(".statusBar-txt");
      if (text) text.textContent = label;
      this.emit("ue-executor-change", { executor: label });
      close(true);
    };
    const run = (command) => {
      if (history) {
        const line = document.createElement("div");
        line.className = "statusBar-history-line";
        line.textContent = "> " + command;
        history.append(line);
        while (history.children.length > MAX_LINES) history.firstElementChild?.remove();
      }
      recalled.push(command);
      recallIndex = recalled.length;
      this.emit("ue-command", { command });
    };
    this.on(this, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest(ROW);
      if (row) {
        choose(row);
        return;
      }
      const drawer = target.closest(DRAWER);
      if (drawer && this.contains(drawer)) {
        toggleDrawer(drawer);
        return;
      }
      const combo = target.closest(COMBO + ".statusBar-cmd");
      if (!combo) return;
      if (combo.getAttribute("aria-expanded") === "true") close(false);
      else open(combo, false);
    });
    this.on(this, "pointerover", (event) => {
      const row = event.target instanceof Element ? event.target.closest(ROW) : null;
      if (row) row.focus({ preventScroll: true });
    });
    this.on(this, "keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const key = event.key;
      if (target === field && field) {
        if (key === "Enter") {
          const command = field.value.trim();
          event.preventDefault();
          if (command === "") return;
          run(command);
          field.value = "";
        } else if (key === "ArrowUp" || key === "ArrowDown") {
          event.preventDefault();
          recallIndex = Math.min(Math.max(recallIndex + (key === "ArrowUp" ? -1 : 1), 0), recalled.length);
          field.value = recalled[recallIndex] ?? "";
        }
        return;
      }
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
      if (key === "Escape" && openMenu()) {
        event.preventDefault();
        close(true);
      } else if ((key === "Enter" || key === " ") && target.matches(DRAWER + ", " + COMBO)) {
        event.preventDefault();
        target.click();
      } else if ((key === "ArrowUp" || key === "ArrowDown") && target.matches(COMBO + ".statusBar-cmd")) {
        event.preventDefault();
        open(target, true);
      }
    });
    this.on(document, "pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const menu = openMenu();
      if (!menu || menu.contains(target)) return;
      const combo = comboOf(menu);
      if (combo && combo.contains(target)) return;
      close(false);
    });
  }
};
define("ue-status-bar", StatusBar);
export {
  StatusBar
};
