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

// design-system/src/ContentToolbar/ContentToolbar.ts
var CHEVRON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
var PREFIX = "ContentToolbar";
var CHILDREN = {
  All: ["Content", "Plugins"],
  Content: ["StarterContent", "Developers"],
  StarterContent: ["Architecture", "Audio", "Blueprints", "HDRI", "Maps", "Materials", "Particles", "Props", "Shapes", "Textures"]
};
var FALLBACK_CHILDREN = ["Architecture", "Audio", "Blueprints"];
var ADD_ENTRIES = [
  { label: "Import to Current Folder" },
  { separator: true },
  { label: "New Folder" },
  { label: "Blueprint Class" },
  { label: "Level" },
  { label: "Material" }
];
var SETTINGS_DEFAULTS = [
  ["Show Folders", true],
  ["Show Empty Folders", false],
  ["Show Favorites", false],
  ["Show Developers Content", false],
  ["Show Engine Content", false],
  ["Show Plugin Content", true]
];
var ContentToolbarElement = class extends UeElement {
  #root;
  #history = [];
  #index = 0;
  #menu = null;
  #checks = /* @__PURE__ */ new Map();
  setup() {
    const root = this.one(".ContentToolbar");
    if (!root) throw new Error("ue-content-toolbar needs a .ContentToolbar child");
    this.#root = root;
    this.#history = [this.#trail()];
    this.#index = 0;
    this.#menu = null;
    this.#checks = new Map(SETTINGS_DEFAULTS);
    this.#syncNav();
    this.on(root, "click", (event) => this.#click(event));
    this.onDispose(() => this.#menu?.close());
  }
  #trail() {
    return this.all(".ContentToolbar__crumb").map((crumb) => (crumb.textContent ?? "").trim());
  }
  #nav(which) {
    return this.one(".ContentToolbar__nav--" + which);
  }
  #click(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button");
    if (!button || !this.#root.contains(button) || button.disabled) return;
    const list = button.classList;
    if (list.contains("ContentToolbar__crumb")) {
      const at = this.all(".ContentToolbar__crumb").indexOf(button);
      this.#navigate(this.#trail().slice(0, at + 1), at);
    } else if (list.contains("ContentToolbar__delim")) {
      this.#openChildren(button);
    } else if (list.contains("ContentToolbar__nav--back")) {
      this.#walk(-1);
    } else if (list.contains("ContentToolbar__nav--fwd")) {
      this.#walk(1);
    } else if (list.contains("ContentToolbar__add")) {
      this.#toggleMenu(button, ADD_ENTRIES, () => void 0);
    } else if (list.contains("ContentToolbar__settings")) {
      const entries = Array.from(this.#checks, ([label, checked]) => ({ label, checkable: true, checked }));
      this.#toggleMenu(button, entries, (index) => {
        const label = entries[index].label ?? "";
        this.#checks.set(label, !this.#checks.get(label));
      });
    } else if (list.contains("ContentToolbar__btn")) {
      this.emit("contenttoolbar:action", { label: (button.textContent ?? "").trim() });
    }
  }
  #openChildren(delim) {
    const delims = this.all(".ContentToolbar__delim");
    const at = delims.indexOf(delim);
    const trail = this.#trail().slice(0, at + 1);
    const names = CHILDREN[trail[at]] ?? FALLBACK_CHILDREN;
    this.#toggleMenu(
      delim,
      names.map((label) => ({ label })),
      (index) => this.#navigate(trail.concat(names[index]), trail.length)
    );
  }
  #toggleMenu(anchor, entries, onPick) {
    const previous = this.#menu;
    if (previous) {
      previous.close();
      if (previous.anchor === anchor) return;
    }
    anchor.setAttribute("aria-haspopup", "menu");
    this.#menu = openMenu(this.#root, anchor, {
      prefix: PREFIX,
      entries,
      onPick,
      onClose: () => {
        this.#menu = null;
      }
    });
  }
  #navigate(trail, focusAt) {
    const current = this.#history[this.#index];
    if (trail.join("/") === current.join("/")) return;
    this.#history = this.#history.slice(0, this.#index + 1);
    this.#history.push(trail);
    this.#index = this.#history.length - 1;
    this.#renderTrail(focusAt);
    this.#syncNav();
    this.emit("contenttoolbar:navigate", { path: trail });
  }
  #walk(delta) {
    const next = this.#index + delta;
    if (next < 0 || next >= this.#history.length) return;
    const hadFocus = this.#root.contains(document.activeElement) && document.activeElement instanceof HTMLButtonElement && document.activeElement.classList.contains("ContentToolbar__nav");
    this.#index = next;
    this.#renderTrail(-1);
    this.#syncNav();
    if (hadFocus) {
      const own = this.#nav(delta < 0 ? "back" : "fwd");
      const other = this.#nav(delta < 0 ? "fwd" : "back");
      (own && !own.disabled ? own : other)?.focus();
    }
    this.emit("contenttoolbar:navigate", { path: this.#history[this.#index] });
  }
  #syncNav() {
    const back = this.#nav("back");
    const fwd = this.#nav("fwd");
    if (back) back.disabled = this.#index === 0;
    if (fwd) fwd.disabled = this.#index >= this.#history.length - 1;
  }
  // Rebuilds the crumbs and delimiters from the history entry.
  #renderTrail(focusAt) {
    const path = this.one(".ContentToolbar__path");
    if (!path) throw new Error("ue-content-toolbar needs a .ContentToolbar__path");
    const hadFocus = focusAt >= 0 && path.contains(document.activeElement);
    for (const old of this.all(".ContentToolbar__crumb, .ContentToolbar__delim")) old.remove();
    for (const name of this.#history[this.#index]) {
      const crumb = document.createElement("button");
      crumb.type = "button";
      crumb.className = "ContentToolbar__crumb";
      crumb.textContent = name;
      const delim = document.createElement("button");
      delim.type = "button";
      delim.className = "ContentToolbar__delim";
      delim.setAttribute("aria-label", "Sub-folders of " + name);
      delim.innerHTML = CHEVRON;
      path.append(crumb, delim);
    }
    if (hadFocus) this.all(".ContentToolbar__crumb")[focusAt]?.focus();
  }
};
define("ue-content-toolbar", ContentToolbarElement);
