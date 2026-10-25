// src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
  connectedCallback() {
    this.style.display = "contents";
    this.setup();
  }
  disconnectedCallback() {
    for (const dispose of this.#disposers.splice(0)) dispose();
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
    const start = list.find((item) => item.getAttribute("aria-checked") === "true") ?? list[0];
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

// src/AssetPicker/AssetPicker.ts
var UeAssetPicker = class extends UeElement {
  setup() {
    const row = this.one(".AssetPicker-row");
    const combo = this.one(".AssetPicker-combo");
    const menu = this.one(".AssetPicker-menu");
    const label = this.one(".AssetPicker-combo .label");
    const thumb = this.one(".AssetPicker-thumbFrame");
    const reset = this.one(".AssetPicker-reset");
    if (!row || !combo || !menu || !label) return;
    const fallback = row.dataset.default ?? "None";
    const render = (value) => {
      row.dataset.value = value;
      label.textContent = value;
      for (const item of menu.querySelectorAll(".AssetPicker-menuItem")) item.setAttribute("aria-selected", String(item.dataset.asset === value));
      if (thumb) {
        thumb.title = value === "None" ? "None" : "/Game/Props/" + value + "." + value;
        thumb.setAttribute("aria-label", value);
      }
      if (reset) {
        reset.classList.toggle("is-idle", value === fallback);
        reset.tabIndex = value === fallback ? -1 : 0;
      }
      this.emit("ue-asset-change", { asset: value });
    };
    render(label.textContent ?? fallback);
    const handle = wireMenu({
      trigger: combo,
      menu,
      itemSelector: ".AssetPicker-menuItem",
      onPick: (item) => render(item.dataset.asset ?? fallback)
    });
    this.onDispose(handle.dispose);
    const use = this.one('[data-role="use"]');
    if (use) this.on(use, "click", () => render(row.dataset.selection ?? fallback));
    const browse = this.one('[data-role="browse"]');
    if (browse) this.on(browse, "click", () => this.emit("ue-asset-browse", { asset: row.dataset.value ?? fallback }));
    if (reset) this.on(reset, "click", () => render(fallback));
  }
};
define("ue-asset-picker", UeAssetPicker);
