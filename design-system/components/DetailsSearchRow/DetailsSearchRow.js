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

// src/_shared/popupmenu.ts
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
    }
  };
}

// src/DetailsSearchRow/DetailsSearchRow.ts
var UeDetailsSearchRow = class extends UeElement {
  setup() {
    const input = this.one(".DetailsSearchRow-text");
    const clear = this.one(".DetailsSearchRow-clear");
    if (input && clear) this.wireSearch(input, clear);
    const star = this.one('[data-role="favorites"]');
    if (star) {
      this.on(star, "click", () => {
        const on = star.getAttribute("aria-pressed") !== "true";
        star.setAttribute("aria-pressed", String(on));
        star.classList.toggle("is-on", on);
        star.title = on ? "Toggle Favorites (on)" : "Toggle Favorites";
        this.emit("ue-favorites", { on });
      });
    }
    const gear = this.one('[data-role="options"]');
    const menu = this.one(".DetailsSearchRow-menu");
    if (gear && menu) {
      const handle = wireMenu({
        trigger: gear,
        menu,
        itemSelector: ".DetailsSearchRow-menuItem",
        onPick: (item) => {
          if (item.getAttribute("role") === "menuitemcheckbox") item.setAttribute("aria-checked", String(item.getAttribute("aria-checked") !== "true"));
          this.emit("ue-view-option", { option: item.dataset.option ?? "", checked: item.getAttribute("aria-checked") === "true" });
        }
      });
      this.onDispose(handle.dispose);
    }
  }
  wireSearch(input, clear) {
    const sync = () => {
      const hasText = input.value !== "";
      input.classList.toggle("has-value", hasText);
      clear.classList.toggle("is-hidden", !hasText);
      this.emit("ue-search", { text: input.value });
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
    this.on(clear, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") wipe();
    });
  }
};
define("ue-details-search-row", UeDetailsSearchRow);
