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

// design-system/src/ComboButton/ComboButton.ts
var ITEM = ".combobutton-row-item";
var HOT = "combobutton-row-item--hover";
var RING = "combobutton-row-item--focus";
var KEYS = "combobutton-menu--keys";
var OPEN = "combobutton--open";
function partsOf(node) {
  const anchor = node?.closest(".combobutton-anchor") ?? null;
  const trigger = anchor?.querySelector(":scope > .combobutton") ?? null;
  const menu = anchor?.querySelector(":scope > .combobutton-menu") ?? null;
  return anchor && trigger && menu ? { anchor, trigger, menu } : null;
}
var UeComboButtonElement = class extends UeElement {
  setup() {
    for (const anchor of this.all(".combobutton-anchor")) {
      const parts = partsOf(anchor);
      if (parts && !parts.trigger.classList.contains("combobutton--simple")) this.#markSelected(parts, this.#labelOf(parts));
    }
    this.on(this, "click", (event) => {
      if (!(event.target instanceof Element)) return;
      const item = event.target.closest(ITEM);
      if (item) {
        const parts2 = partsOf(item);
        if (parts2) this.#choose(parts2, item);
        return;
      }
      const trigger = event.target.closest(".combobutton");
      const parts = partsOf(trigger);
      if (!trigger || !parts || trigger.getAttribute("aria-disabled") === "true") return;
      if (parts.menu.hidden) this.#open(parts);
      else this.#close(parts, false);
    });
    this.on(this, "mousedown", (event) => {
      if (event.target instanceof Element && event.target.closest(".combobutton-menu")) event.preventDefault();
    });
    this.on(this, "mousemove", (event) => {
      if (!(event.target instanceof Element)) return;
      const item = event.target.closest(ITEM);
      const parts = partsOf(item);
      if (!item || !parts) return;
      parts.menu.classList.remove(KEYS);
      this.#highlight(parts, item, false);
    });
    this.on(this, "keydown", (event) => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest(".combobutton");
      const parts = partsOf(trigger);
      if (!trigger || !parts || trigger !== parts.trigger || trigger.getAttribute("aria-disabled") === "true") return;
      this.#key(event, parts);
    });
    this.on(document, "pointerdown", (event) => {
      for (const anchor of this.all(".combobutton-anchor")) {
        const parts = partsOf(anchor);
        if (parts && !parts.menu.hidden && !(event.target instanceof Node && anchor.contains(event.target))) this.#close(parts, false);
      }
    });
  }
  #items(parts) {
    return Array.from(parts.menu.querySelectorAll(ITEM));
  }
  #labelOf(parts) {
    return parts.trigger.querySelector(".combobutton__label")?.textContent?.trim() ?? "";
  }
  #markSelected(parts, label) {
    for (const item of this.#items(parts)) item.setAttribute("aria-selected", String(item.textContent?.trim() === label));
  }
  #highlight(parts, item, ring) {
    for (const other of this.#items(parts)) {
      other.classList.toggle(HOT, other === item);
      other.classList.toggle(RING, other === item && ring);
    }
  }
  #open(parts) {
    for (const anchor of this.all(".combobutton-anchor")) {
      const other = partsOf(anchor);
      if (other && other.anchor !== parts.anchor && !other.menu.hidden) this.#close(other, false);
    }
    parts.menu.hidden = false;
    parts.menu.classList.remove(KEYS);
    parts.trigger.classList.add(OPEN);
    parts.trigger.setAttribute("aria-expanded", "true");
    this.#highlight(parts, null, false);
  }
  #close(parts, refocus) {
    parts.menu.hidden = true;
    parts.trigger.classList.remove(OPEN);
    parts.trigger.setAttribute("aria-expanded", "false");
    this.#highlight(parts, null, false);
    if (refocus) parts.trigger.focus();
  }
  #choose(parts, item) {
    const text = item.textContent?.trim() ?? "";
    const label = parts.trigger.querySelector(".combobutton__label");
    if (!parts.trigger.classList.contains("combobutton--simple")) {
      if (label) label.textContent = text;
      this.#markSelected(parts, text);
    }
    const status = this.one(".combobutton-status");
    if (status) status.textContent = "Picked: " + text;
    this.#close(parts, true);
    this.emit("ue-combo-pick", { value: text });
  }
  #key(event, parts) {
    const items = this.#items(parts);
    const current = items.findIndex((item) => item.classList.contains(HOT));
    const move = (index) => {
      parts.menu.classList.add(KEYS);
      this.#highlight(parts, items[index] ?? null, true);
    };
    if (parts.menu.hidden) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        this.#open(parts);
        const selected = items.findIndex((item) => item.getAttribute("aria-selected") === "true");
        move(selected >= 0 ? selected : event.key === "ArrowUp" ? items.length - 1 : 0);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        move(current < 0 ? 0 : (current + 1) % items.length);
        break;
      case "ArrowUp":
        move(current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(items.length - 1);
        break;
      case "Enter":
      case " ":
        if (current >= 0) this.#choose(parts, items[current]);
        else this.#close(parts, true);
        break;
      case "Escape":
        this.#close(parts, true);
        break;
      case "Tab":
        this.#close(parts, false);
        return;
      default:
        return;
    }
    event.preventDefault();
  }
};
define("ue-combo-button", UeComboButtonElement);
export {
  UeComboButtonElement
};
