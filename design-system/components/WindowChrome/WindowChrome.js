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

// src/WindowChrome/WindowChrome.ts
var MAXIMIZE_GLYPH = "#windowChrome-i-max";
var RESTORE_GLYPH = "#windowChrome-i-restore";
var WindowChromeElement = class extends UeElement {
  setup() {
    const frame = this.one(".windowChrome-frame");
    if (!frame) throw new Error("ue-window-chrome needs a .windowChrome-frame child");
    const status = this.one(".windowChrome-status");
    const reopen = this.one(".windowChrome-reopen");
    const setActive = (active) => {
      frame.dataset.active = String(active);
      if (status) status.textContent = active ? "Window active" : "Window inactive";
    };
    setActive(frame.contains(document.activeElement));
    this.on(this, "focusin", () => setActive(frame.contains(document.activeElement)));
    this.on(this, "focusout", (event) => setActive(event.relatedTarget instanceof Node && frame.contains(event.relatedTarget)));
    const hideWindow = (label) => {
      frame.hidden = true;
      if (!reopen) return;
      reopen.textContent = label;
      reopen.hidden = false;
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
        if (reopen) reopen.hidden = true;
        frame.focus();
        return;
      }
      const button = target?.closest(".windowChrome-btn");
      if (!button || !frame.contains(button)) return;
      const action = button.dataset.action;
      if (action === "minimize") hideWindow("Window minimized: restore");
      else if (action === "maximize") toggleMaximized(button);
      else if (action === "close") hideWindow("Window closed: reopen");
    });
  }
};
define("ue-window-chrome", WindowChromeElement);
