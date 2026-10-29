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

// design-system/src/_shared/tabstack.ts
var TARGET_KEYS = ["ArrowRight", "ArrowLeft", "Home", "End"];
function targetElement(event) {
  return event.target instanceof Element ? event.target : null;
}
var TabStackElement = class extends UeElement {
  #snapshot = null;
  setup() {
    this.#snapshot ??= this.innerHTML;
    this.on(this, "pointerdown", (event) => {
      if (event.button !== 0 && event.button !== 2) return;
      const target = targetElement(event);
      const tab = target?.closest("." + this.names.tab);
      if (!tab || !this.owns(tab) || target?.closest("." + this.names.close)) return;
      this.#activate(tab);
    });
    this.on(this, "click", (event) => {
      const target = targetElement(event);
      if (!this.owns(target)) return;
      const closeButton = target?.closest("." + this.names.close);
      if (closeButton) {
        const tab = closeButton.closest("." + this.names.tab);
        if (tab) this.#close(tab);
        return;
      }
      if (target?.closest("." + this.names.reset)) this.#restore();
    });
    this.on(this, "auxclick", (event) => {
      if (event.button !== 1) return;
      const tab = targetElement(event)?.closest("." + this.names.tab);
      if (!tab || !this.owns(tab)) return;
      event.preventDefault();
      this.#close(tab);
    });
    this.on(this, "keydown", (event) => {
      const tab = targetElement(event)?.closest("." + this.names.tab);
      if (!tab || event.target !== tab || !this.owns(tab)) return;
      const stack = tab.closest("." + this.names.stack);
      if (!stack) return;
      const tabs = this.#tabsOf(stack);
      const index = tabs.indexOf(tab);
      if (TARGET_KEYS.includes(event.key)) {
        const target = this.#neighbour(tabs, index, event.key);
        event.preventDefault();
        this.#activate(target);
        target.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.#activate(tab);
      } else if (event.key === "Delete") {
        event.preventDefault();
        this.#close(tab);
      }
    });
  }
  #neighbour(tabs, index, key) {
    if (key === "Home") return tabs[0];
    if (key === "End") return tabs[tabs.length - 1];
    const step = key === "ArrowRight" ? 1 : -1;
    return tabs[(index + step + tabs.length) % tabs.length];
  }
  #tabsOf(stack) {
    const well = stack.querySelector("." + this.names.well);
    return Array.from(well?.children ?? []).filter((child) => child instanceof HTMLElement && child.classList.contains(this.names.tab));
  }
  // The panel of this tab. A panel that belongs to a stack nested inside this
  // never matches.
  #panelOf(stack, tab) {
    const panels = Array.from(stack.querySelectorAll("[data-panel]")).filter((panel) => panel.closest("." + this.names.stack) === stack);
    return panels.find((panel) => panel.dataset.panel === tab.dataset.tab) ?? null;
  }
  #detail(tab) {
    const label = (tab.querySelector("." + this.names.label)?.textContent ?? "").trim();
    return { id: tab.dataset.tab ?? label, label };
  }
  // Every tab of this element in document order, each owned by this element.
  tabs() {
    return this.all("." + this.names.tab).filter((tab) => this.owns(tab));
  }
  // Makes the tab with this data-tab the foreground tab and the active one.
  activateTab(id) {
    const tab = this.tabs().find((candidate) => this.#detail(candidate).id === id);
    if (tab) this.#activate(tab);
  }
  // Closes the tab with this data-tab.
  closeTab(id) {
    const tab = this.tabs().find((candidate) => this.#detail(candidate).id === id);
    if (tab) this.#close(tab);
  }
  // Every active tab of every live stack of this component in the page.
  #activeTabs() {
    const selector = this.tagName.toLowerCase() + " ." + this.names.tab + "." + this.names.active;
    return Array.from(document.querySelectorAll(selector));
  }
  // Makes the tab the foreground tab of its stack and shows its panel.
  #bringToFront(stack, tab) {
    const changed = !tab.classList.contains(this.names.foreground);
    for (const candidate of this.#tabsOf(stack)) {
      const foreground = candidate === tab;
      candidate.classList.toggle(this.names.foreground, foreground);
      candidate.setAttribute("aria-selected", String(foreground));
      candidate.tabIndex = foreground ? 0 : -1;
      const panel = this.#panelOf(stack, candidate);
      if (panel) panel.hidden = !foreground;
    }
    if (changed) this.emit("ue-tab-activate", this.#detail(tab));
  }
  // Foreground plus active. One tab per page is active, like the focused stack of the editor.
  #activate(tab) {
    const stack = tab.closest("." + this.names.stack);
    if (!stack) return;
    this.#bringToFront(stack, tab);
    for (const other of this.#activeTabs()) other.classList.remove(this.names.active);
    tab.classList.add(this.names.active);
  }
  // SDockingTabWell::RemoveAndDestroyTab, SDockingTabWell.cpp:617-633: closing the foreground tab selects its left neighbour, or the new first tab.
  #close(tab) {
    const stack = tab.closest("." + this.names.stack);
    if (!stack) return;
    const tabs = this.#tabsOf(stack);
    const index = tabs.indexOf(tab);
    const old = tabs.findIndex((candidate) => candidate.classList.contains(this.names.foreground));
    const hadFocus = tab.contains(document.activeElement);
    const wasActive = tab.classList.contains(this.names.active);
    const closed = this.#detail(tab);
    this.#panelOf(stack, tab)?.remove();
    tab.remove();
    this.emit("ue-tab-close", closed);
    const rest = tabs.filter((candidate) => candidate !== tab);
    if (rest.length === 0) return;
    let next;
    if (old === -1) next = rest[0];
    else if (index <= old) next = rest[Math.max(old - 1, 0)];
    else next = rest[old];
    if (wasActive) this.#activate(next);
    else this.#bringToFront(stack, next);
    if (hadFocus) next.focus();
  }
  // Puts back the markup this element had when it first connected.
  #restore() {
    if (this.#snapshot === null) return;
    this.innerHTML = this.#snapshot;
    const tabs = this.all("." + this.names.tab);
    for (const tab of tabs) tab.classList.remove(this.names.active);
    const foreground = tabs.find((tab) => tab.classList.contains(this.names.foreground));
    if (foreground && this.#activeTabs().length === 0) foreground.classList.add(this.names.active);
  }
};

// design-system/src/TabWell/TabWell.ts
var TabWellElement = class extends TabStackElement {
  names = {
    stack: "tabWell-stack",
    well: "tabWell-well",
    tab: "tabWell-tab",
    label: "tabWell-label",
    close: "tabWell-close",
    reset: "tabWell-reset",
    foreground: "tabWell-tab--foreground",
    active: "tabWell-tab--active"
  };
};
define("ue-tab-well", TabWellElement);
