// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
<<<<<<< HEAD
  connectedCallback() {
    this.style.display = "contents";
    this.setup();
  }
  disconnectedCallback() {
    for (const dispose of this.#disposers.splice(0)) dispose();
  }
=======
  #ready = false;
  #pendingSetup = null;
  // The bundle can load before the parser reaches this element's children, so setup waits for the document to finish parsing.
  // A pinned specimen (data-pinned on the element or an ancestor) keeps its authored markup: setup never runs.
  connectedCallback() {
    this.style.display = "contents";
    if (this.closest("[data-pinned]")) return;
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
>>>>>>> claude/adoring-faraday-94vc0i
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
<<<<<<< HEAD
=======
  // True when the nearest element of this tag above the target is this element, so a nested instance keeps its own events.
  owns(target) {
    return target instanceof Element && target.closest(this.localName) === this;
  }
>>>>>>> claude/adoring-faraday-94vc0i
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

<<<<<<< HEAD
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
=======
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
function rowLabel(row, labelSelector) {
  const label = row.querySelector(labelSelector);
  return (label ?? row).textContent?.trim() ?? "";
}

// design-system/src/PopupMenu/PopupMenu.ts
var ROW = ".popupmenu__row";
var CURRENT = "popupmenu__row--hover";
var OPEN = "popupmenu__row--open";
var PRESSED2 = "popupmenu__row--pressed";
var KEYS = "popupmenu--keys";
function rowOf(target) {
  return target instanceof Element ? target.closest(ROW) : null;
}
function isDisabled2(row) {
  return row.getAttribute("aria-disabled") === "true";
}
function submenuOf(row) {
  return row.querySelector(":scope > .popupmenu__sub");
}
function menuOf(row) {
  return row.parentElement;
}
var UePopupMenuElement = class extends UeElement {
  // The focusable .popupmenu list.
  get root() {
    const root = this.one(".popupmenu[tabindex]");
    if (!root) throw new Error("ue-popup-menu needs a .popupmenu[tabindex] element");
    return root;
  }
  // Focuses the list and marks `row` current. `keys` hides the hover highlight, as after an arrow key.
  focusMenu(row, keys) {
    const root = this.root;
    root.focus({ preventScroll: true });
    root.classList.toggle(KEYS, keys);
    this.#show(root, row, null);
  }
  // Clears the current row and closes every submenu.
  reset() {
    const root = this.root;
    root.classList.remove(KEYS);
    this.#show(root, null, null);
  }
  // The enabled rows of the top level, in order.
  topRows() {
    return enabledRows(this.root, ":scope > " + ROW);
  }
  setup() {
    void this.root;
    this.on(this, "mousemove", (event) => {
      const row = rowOf(event.target);
      if (!row || !ownedBy(this, event.target)) return;
      const root = this.root;
      root.classList.remove(KEYS);
      if (isDisabled2(row)) return;
      const sub = submenuOf(row);
      const open = sub !== null && !sub.hidden;
      if (row.classList.contains(CURRENT) && (sub === null || open)) return;
      this.#show(root, row, sub ? row : null);
    });
    this.on(this, "pointerdown", (event) => {
      const row = rowOf(event.target);
      if (row && ownedBy(this, event.target) && event.button === 0 && !isDisabled2(row)) row.classList.add(PRESSED2);
    });
    const release = () => {
      for (const row of this.all(ROW + "." + PRESSED2)) row.classList.remove(PRESSED2);
    };
    this.on(this, "pointerup", release);
    this.on(this, "pointercancel", release);
    this.on(this, "pointerout", (event) => {
      const row = rowOf(event.target);
      if (row && !(event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) row.classList.remove(PRESSED2);
    });
    this.on(this, "click", (event) => {
      const row = rowOf(event.target);
      if (!row || !ownedBy(this, event.target) || isDisabled2(row)) return;
      const sub = submenuOf(row);
      if (sub) {
        this.#show(this.root, row, sub.hidden ? row : null);
        return;
      }
      this.#show(this.root, row, null);
      this.#activate(row);
    });
    this.on(this, "mouseout", (event) => {
      const root = this.root;
      if (!ownedBy(this, event.target) || event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
      if (!root.classList.contains(KEYS)) this.#show(root, null, null);
    });
    this.on(this, "keydown", (event) => {
      if (event.target === this.root) this.#key(event, this.root);
    });
    this.on(this, "focusout", (event) => {
      const root = this.root;
      if (!root.contains(event.target)) return;
      if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) this.#show(root, null, null);
    });
  }
  // Marks one row current, opens the submenus on its path, and optionally opens the submenu of `open`.
  #show(root, current, open) {
    const keep = /* @__PURE__ */ new Set();
    for (let row = current; row; row = row.parentElement?.closest(ROW) ?? null) {
      if (row !== current) keep.add(row);
    }
    if (open) keep.add(open);
    for (const row of Array.from(root.querySelectorAll(ROW))) {
      row.classList.toggle(CURRENT, row === current);
      const sub = submenuOf(row);
      if (sub) {
        const isOpen = keep.has(row);
        sub.hidden = !isOpen;
        row.classList.toggle(OPEN, isOpen);
        row.setAttribute("aria-expanded", String(isOpen));
      }
    }
  }
  #activate(row) {
    const role = row.getAttribute("role");
    const label = rowLabel(row, ".popupmenu__label");
    let checked = null;
    let text = label;
    if (role === "menuitemcheckbox") {
      checked = row.getAttribute("aria-checked") !== "true";
      row.setAttribute("aria-checked", String(checked));
      text += checked ? " (checked)" : " (unchecked)";
    } else if (role === "menuitemradio") {
      for (const other of Array.from(menuOf(row)?.querySelectorAll(':scope > [role="menuitemradio"]') ?? [])) {
        other.setAttribute("aria-checked", String(other === row));
      }
      checked = true;
      text += " (selected)";
    }
    const detail = { label, role, checked, text, value: row.dataset.value ?? label, row };
    this.emit("ue-menu-activate", detail);
  }
  #key(event, root) {
    const current = root.querySelector(ROW + "." + CURRENT);
    const menu = current ? menuOf(current) : root;
    if (!menu) return;
    const rows = enabledRows(menu, ":scope > " + ROW);
    const index = current ? rows.indexOf(current) : -1;
    const go = (next) => {
      root.classList.add(KEYS);
      if (next) this.#show(root, next, null);
    };
    switch (event.key) {
      case "ArrowDown":
        go(rows[index < 0 ? 0 : (index + 1) % rows.length]);
        break;
      case "ArrowUp":
        go(rows[index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length]);
        break;
      case "Home":
        go(rows[0]);
        break;
      case "End":
        go(rows[rows.length - 1]);
        break;
      case "ArrowRight":
        this.#enter(root, current);
        break;
      case "ArrowLeft":
        this.#leave(root, current);
        break;
      case "Escape":
        root.classList.add(KEYS);
        if (current && menu !== root) {
          this.#leave(root, current);
          event.stopPropagation();
        } else {
          this.#show(root, null, null);
        }
        break;
      case "Enter":
      case " ":
        root.classList.add(KEYS);
        if (event.repeat || !current) break;
        if (submenuOf(current)) this.#enter(root, current);
        else this.#activate(current);
        break;
      default:
        return;
    }
    event.preventDefault();
  }
  // Opens the submenu of the current row and moves to its first enabled row.
  #enter(root, current) {
    root.classList.add(KEYS);
    const sub = current ? submenuOf(current) : null;
    if (!current || !sub) return;
    const first = enabledRows(sub, ":scope > " + ROW)[0];
    this.#show(root, first ?? current, current);
  }
  // Closes the submenu that holds the current row and returns to its parent row.
  #leave(root, current) {
    root.classList.add(KEYS);
    const parent = current ? menuOf(current)?.closest(ROW) ?? null : null;
    if (parent) this.#show(root, parent, null);
  }
};
define("ue-popup-menu", UePopupMenuElement);

// design-system/src/ComboButton/ComboButton.ts
var OPEN2 = "combobutton--open";
var ACTIVATE_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];
var UeComboButtonElement = class extends UeElement {
  #trigger;
  #panel;
  // In value mode: the value of the picked row. The setter picks the row whose value or label matches, shows its label and fires no ue-combo-pick. This is because the owner that sets it
  // already knows.
  get value() {
    const picked = this.querySelector('.popupmenu__row[aria-selected="true"]');
    return picked?.dataset.value ?? (picked ? rowLabel(picked, ".popupmenu__label") : "");
  }
  set value(next) {
    const row = this.querySelectorAll(".popupmenu[tabindex] > .popupmenu__row");
    const match = Array.from(row).find((each) => (each.dataset.value ?? rowLabel(each, ".popupmenu__label")) === next);
    if (!match) throw new Error("ue-combo-button has no row with the value " + next);
    const label = this.querySelector(".combobutton__label");
    if (label) label.textContent = rowLabel(match, ".popupmenu__label");
    for (const each of row) each.setAttribute("aria-selected", String(each === match));
  }
  setup() {
    const trigger = this.one(".combobutton");
    const panel = this.one(".combobutton-menu");
    if (!trigger || !panel) throw new Error("ue-combo-button needs a .combobutton trigger and a .combobutton-menu panel");
    if (!panel.querySelector("ue-popup-menu")) throw new Error("the .combobutton-menu panel needs a ue-popup-menu");
    this.#trigger = trigger;
    this.#panel = panel;
    const anchor = trigger.closest(".combobutton-anchor") ?? this;
    if (!this.#isAction()) this.#markSelected(this.#labelText());
    this.on(trigger, "click", () => {
      if (this.#disabled()) return;
      if (panel.hidden) this.#open(false, false);
      else this.#close(false);
    });
    this.on(trigger, "keydown", (event) => {
      if (event.target !== trigger || this.#disabled() || !ACTIVATE_KEYS.includes(event.key)) return;
      event.preventDefault();
      if (panel.hidden && !event.repeat) this.#open(true, event.key === "ArrowUp");
    });
    this.on(panel, "mousedown", (event) => event.preventDefault());
    this.on(panel, "keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.#close(true);
      } else if (event.key === "Tab") {
        this.#close(false);
      }
    });
    this.on(this, "ue-menu-activate", (event) => {
      if (ownedBy(this, event.target)) this.#pick(event.detail);
    });
    this.on(document, "pointerdown", (event) => {
      if (!panel.hidden && !(event.target instanceof Node && anchor.contains(event.target))) this.#close(false);
    });
  }
  // True while the panel shows.
  get isOpen() {
    return !this.#panel.hidden;
  }
  // Opens the panel. `keys` moves the focus into the list, `fromEnd` starts at the last row.
  open(keys = false, fromEnd = false) {
    if (this.#disabled() || this.isOpen) return;
    this.#open(keys, fromEnd);
  }
  // Closes the panel. `refocus` returns the focus to the trigger.
  close(refocus = false) {
    if (this.isOpen) this.#close(refocus);
  }
  #disabled() {
    return this.#trigger.getAttribute("aria-disabled") === "true";
  }
  // Action mode keeps the label fixed. Value mode shows the picked row. mode="value" gives a simple trigger value mode.
  #isAction() {
    const mode = this.getAttribute("mode");
    if (mode === "action" || this.#label() === null) return true;
    return mode !== "value" && this.#trigger.classList.contains("combobutton--simple");
  }
  #label() {
    return this.#trigger.querySelector(".combobutton__label");
  }
  #labelText() {
    return this.#label()?.textContent?.trim() ?? "";
  }
  // The popup menu is upgraded by its own module, which can load after this.
  #popup() {
    const popup = this.#panel.querySelector("ue-popup-menu");
    if (!popup || typeof popup.focusMenu !== "function") throw new Error("ue-popup-menu is not defined");
    return popup;
  }
  #rows() {
    return Array.from(this.#panel.querySelectorAll(".popupmenu[tabindex] > .popupmenu__row")).filter((row) => row.getAttribute("aria-disabled") !== "true");
  }
  #markSelected(label) {
    for (const row of this.#rows()) row.setAttribute("aria-selected", String(rowLabel(row, ".popupmenu__label") === label));
  }
  #open(keys, fromEnd) {
    const popup = this.#popup();
    this.#panel.hidden = false;
    this.#trigger.classList.add(OPEN2);
    this.#trigger.setAttribute("aria-expanded", "true");
    const rows = this.#rows();
    const selected = rows.find((row) => row.getAttribute("aria-selected") === "true" || row.getAttribute("aria-checked") === "true");
    popup.focusMenu(keys ? selected ?? (fromEnd ? rows[rows.length - 1] : rows[0]) ?? null : null, keys);
  }
  #close(refocus) {
    this.#panel.hidden = true;
    this.#trigger.classList.remove(OPEN2);
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#popup().reset();
    if (refocus) this.#trigger.focus();
  }
  #pick(detail) {
    const label = this.#label();
    if (!this.#isAction() && label && detail.role !== "menuitemcheckbox") {
      label.textContent = detail.label;
      this.#markSelected(detail.label);
    }
    this.#close(true);
    this.emit("ue-combo-pick", { value: detail.value, label: detail.label, checked: detail.checked });
  }
};
define("ue-combo-button", UeComboButtonElement);

// design-system/src/ContentToolbar/ContentToolbar.ts
var CHEVRON = '<svg class="combobutton__icon" viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
>>>>>>> claude/adoring-faraday-94vc0i
var CHILDREN = {
  All: ["Content", "Plugins"],
  Content: ["StarterContent", "Developers"],
  StarterContent: ["Architecture", "Audio", "Blueprints", "HDRI", "Maps", "Materials", "Particles", "Props", "Shapes", "Textures"]
};
var FALLBACK_CHILDREN = ["Architecture", "Audio", "Blueprints"];
<<<<<<< HEAD
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
=======
var escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function crumbHtml(name, index, children) {
  const rows = children.map((child) => '<div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">' + escape(child) + "</span></span></div>").join("");
  return '<ue-button data-crumb="' + index + '"><button type="button" class="button button--simple button--tight">' + escape(name) + '</button></ue-button><ue-combo-button mode="action" data-crumb-menu="' + index + '"><div class="combobutton-anchor"><span class="combobutton combobutton--icon" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" aria-label="Sub-folders of ' + escape(name) + '">' + CHEVRON + '</span><div class="combobutton-menu" hidden><ue-popup-menu><div class="popupmenu" role="menu" tabindex="0">' + rows + "</div></ue-popup-menu></div></div></ue-combo-button>";
}
var ContentToolbarElement = class extends UeElement {
  // Names of the folders inside the folder at `path`. The chevron after a crumb lists them.
  childrenOf = (path) => CHILDREN[path[path.length - 1]] ?? FALLBACK_CHILDREN;
  #crumbs;
  #path = [];
  #history = [];
  #index = 0;
  get path() {
    return this.#path;
  }
  setup() {
    const crumbs = this.one(".ContentToolbar__crumbs");
    if (!crumbs) throw new Error("ue-content-toolbar needs a .ContentToolbar__crumbs element");
    this.#crumbs = crumbs;
    this.#path = this.all("ue-button[data-crumb]").filter((host) => this.owns(host)).map((host) => (host.textContent ?? "").trim());
    this.#history = [this.#path];
    this.#index = 0;
    this.#render();
    this.on(this, "ue-button-click", (event) => {
      if (!this.owns(event.target)) return;
      const host = event.target.closest("ue-button");
      if (host?.dataset.action === "back") this.#walk(-1);
      else if (host?.dataset.action === "forward") this.#walk(1);
      else if (host?.dataset.crumb !== void 0) this.#go(this.#path.slice(0, Number(host.dataset.crumb) + 1));
    });
    this.on(this, "ue-combo-pick", (event) => {
      if (!this.owns(event.target)) return;
      const host = event.target.closest("ue-combo-button");
      if (host?.dataset.crumbMenu === void 0) return;
      this.#go(this.#path.slice(0, Number(host.dataset.crumbMenu) + 1).concat(event.detail.label));
    });
  }
  // Replaces the history. `index` is the entry that is current. The path follows it. No event fires.
  setHistory(entries, index) {
    this.#history = entries.map((entry) => entry.slice());
    this.#index = index;
    this.#path = this.#history[index].slice();
    this.#render();
  }
  // Moves to `path` and records it in the history, as a navigation by another part of the page does. No event fires.
  navigate(path) {
    this.#record(path);
    this.#render();
  }
  #record(path) {
    this.#history = this.#history.slice(0, this.#index + 1);
    this.#history.push(path.slice());
    this.#index = this.#history.length - 1;
    this.#path = path.slice();
  }
  #go(path) {
    this.#record(path);
    this.#render();
    this.emit("contenttoolbar:navigate", { path: path.slice() });
>>>>>>> claude/adoring-faraday-94vc0i
  }
  #walk(delta) {
    const next = this.#index + delta;
    if (next < 0 || next >= this.#history.length) return;
<<<<<<< HEAD
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
=======
    const hadFocus = this.#navButton(delta < 0 ? "back" : "forward") === document.activeElement;
    this.#index = next;
    this.#path = this.#history[next].slice();
    this.#render();
    if (hadFocus) {
      const own = this.#navButton(delta < 0 ? "back" : "forward");
      (own && !own.disabled ? own : this.#navButton(delta < 0 ? "forward" : "back"))?.focus();
    }
    this.emit("contenttoolbar:navigate", { path: this.#path.slice() });
  }
  #navButton(action) {
    return this.one('ue-button[data-action="' + action + '"] .button');
  }
  #render() {
    this.#crumbs.innerHTML = this.#path.map((name, index) => crumbHtml(name, index, this.childrenOf(this.#path.slice(0, index + 1)))).join("");
    const back = this.#navButton("back");
    const forward = this.#navButton("forward");
    if (back) back.disabled = this.#index === 0;
    if (forward) forward.disabled = this.#index >= this.#history.length - 1;
  }
};
define("ue-content-toolbar", ContentToolbarElement);
export {
  ContentToolbarElement
};
>>>>>>> claude/adoring-faraday-94vc0i
