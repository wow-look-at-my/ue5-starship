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

// design-system/src/_shared/contentMenu.ts
var TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
function openMenu(host, anchor, options) {
  const menu = document.createElement("div");
  menu.className = options.prefix + "__menu";
  menu.setAttribute("role", "menu");
  const items = [];
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    document.removeEventListener("pointerdown", outside, true);
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
    options.onClose?.();
  };
  const outside = (event) => {
    const target = event.target;
    if (target instanceof Node && !menu.contains(target) && !anchor.contains(target)) close();
  };
  options.entries.forEach((entry, index) => {
    if (entry.separator) {
      const rule = document.createElement("div");
      rule.className = options.prefix + "__menusep";
      rule.setAttribute("role", "separator");
      menu.append(rule);
      return;
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = options.prefix + "__menuitem";
    item.tabIndex = -1;
    item.disabled = entry.disabled === true;
    if (entry.checkable) {
      item.setAttribute("role", "menuitemcheckbox");
      item.setAttribute("aria-checked", String(entry.checked === true));
    } else {
      item.setAttribute("role", "menuitem");
    }
    const check = document.createElement("span");
    check.className = options.prefix + "__menucheck";
    if (entry.checked) check.innerHTML = TICK;
    const label = document.createElement("span");
    label.textContent = entry.label ?? "";
    item.append(check, label);
    item.addEventListener("click", () => {
      close();
      anchor.focus();
      options.onPick(index);
    });
    items.push(item);
    menu.append(item);
  });
  menu.addEventListener("keydown", (event) => {
    const enabled = items.filter((item) => !item.disabled);
    const at = enabled.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = enabled[(at + 1) % enabled.length];
    else if (event.key === "ArrowUp") next = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      anchor.focus();
      return;
    } else if (event.key === "Tab") {
      close();
      return;
    } else return;
    event.preventDefault();
    next?.focus();
  });
  host.append(menu);
  const hostBox = host.getBoundingClientRect();
  const anchorBox = anchor.getBoundingClientRect();
  let left = anchorBox.left - hostBox.left;
  if (left + menu.offsetWidth > hostBox.width) left = Math.max(0, anchorBox.right - hostBox.left - menu.offsetWidth);
  menu.style.left = left + "px";
  menu.style.top = anchorBox.bottom - hostBox.top + "px";
  anchor.setAttribute("aria-expanded", "true");
  document.addEventListener("pointerdown", outside, true);
  items.find((item) => !item.disabled)?.focus();
  return { element: menu, anchor, close };
}

// design-system/src/AssetSearchBar/AssetSearchBar.ts
var PREFIX = "AssetSearchBar";
var CROSS = '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
var FILTERS = [
  { name: "Static Mesh", color: "var(--accent-blue)" },
  { name: "Material", color: "var(--accent-green)" },
  { name: "Texture", color: "var(--accent-orange)" },
  { name: "Blueprint", color: "var(--accent-purple)" },
  { name: "Level", color: "var(--accent-pink)" }
];
var AssetSearchBarElement = class extends UeElement {
  #row;
  #input;
  #active = [];
  #menu = null;
  setup() {
    const row = this.one(".AssetSearchBar");
    const input = this.one(".AssetSearchBar__input");
    if (!row || !input) throw new Error("ue-asset-search-bar needs a .AssetSearchBar row with a .AssetSearchBar__input");
    this.#row = row;
    this.#input = input;
    this.#active = [];
    this.#menu = null;
    this.#sync();
    this.on(input, "input", () => {
      this.#sync();
      this.emit("assetsearchbar:change", { text: input.value, filters: this.#active.slice() });
    });
    this.on(input, "keydown", (event) => {
      if (event.key === "Escape" && input.value !== "") {
        event.preventDefault();
        this.#clear();
      }
    });
    this.on(row, "click", (event) => this.#click(event));
    this.on(this, "click", (event) => this.#pillClick(event));
    this.onDispose(() => this.#menu?.close());
  }
  // Shows the in-field buttons only while the field has text.
  #sync() {
    const hasText = this.#input.value !== "";
    for (const button of this.all(".AssetSearchBar__clear, .AssetSearchBar__plus")) button.hidden = !hasText;
  }
  #clear() {
    this.#input.value = "";
    this.#sync();
    this.#input.focus();
    this.emit("assetsearchbar:change", { text: "", filters: this.#active.slice() });
  }
  #click(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest(".AssetSearchBar__clear")) {
      this.#clear();
    } else if (target.closest(".AssetSearchBar__plus") || target.closest(".AssetSearchBar__btn") && !target.closest(".AssetSearchBar__filter")) {
      this.emit("assetsearchbar:save", { text: this.#input.value });
    } else if (target.closest(".AssetSearchBar__filter")) {
      this.#toggleMenu(target.closest(".AssetSearchBar__filter"));
    }
  }
  #toggleMenu(anchor) {
    if (!anchor) return;
    const previous = this.#menu;
    if (previous) {
      previous.close();
      if (previous.anchor === anchor) return;
    }
    anchor.setAttribute("aria-haspopup", "menu");
    const entries = FILTERS.map((filter) => ({ label: filter.name, checkable: true, checked: this.#active.includes(filter.name) }));
    this.#menu = openMenu(this.#row, anchor, {
      prefix: PREFIX,
      entries,
      onPick: (index) => this.#toggleFilter(FILTERS[index].name),
      onClose: () => {
        this.#menu = null;
      }
    });
  }
  #toggleFilter(name) {
    this.#active = this.#active.includes(name) ? this.#active.filter((each) => each !== name) : this.#active.concat(name);
    this.#renderPills();
    this.emit("assetsearchbar:change", { text: this.#input.value, filters: this.#active.slice() });
  }
  #pillClick(event) {
    const remove = event.target instanceof Element ? event.target.closest(".AssetSearchBar__pillRemove") : null;
    const name = remove?.closest(".AssetSearchBar__pill")?.getAttribute("aria-label")?.replace(/^Filter: /, "");
    if (name) this.#toggleFilter(name);
  }
  #renderPills() {
    let strip = this.one(".AssetSearchBar__pills");
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "AssetSearchBar__pills";
      strip.setAttribute("role", "list");
      this.#row.after(strip);
    }
    strip.replaceChildren();
    for (const name of this.#active) {
      const filter = FILTERS.find((each) => each.name === name);
      const pill = document.createElement("span");
      pill.className = "AssetSearchBar__pill";
      pill.setAttribute("role", "listitem");
      pill.setAttribute("aria-label", "Filter: " + name);
      const colour = document.createElement("span");
      colour.className = "AssetSearchBar__pillColor";
      colour.style.background = filter?.color ?? "var(--accent-gray)";
      const label = document.createElement("span");
      label.className = "AssetSearchBar__pillName";
      label.textContent = name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "AssetSearchBar__pillRemove";
      remove.setAttribute("aria-label", "Remove " + name + " filter");
      remove.innerHTML = CROSS;
      pill.append(colour, label, remove);
      strip.append(pill);
    }
  }
};
define("ue-asset-search-bar", AssetSearchBarElement);
