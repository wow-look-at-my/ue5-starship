// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
<<<<<<< HEAD
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
=======
  connectedCallback() {
    this.style.display = "contents";
    this.setup();
  }
  disconnectedCallback() {
    for (const dispose of this.#disposers.splice(0)) dispose();
  }
>>>>>>> origin/master
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
  // True when the nearest element of this tag above the target is this element, so a nested instance keeps its own events.
  owns(target) {
    return target instanceof Element && target.closest(this.localName) === this;
  }
=======
>>>>>>> origin/master
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
// design-system/src/_shared/own.ts
function ownedBy(host, target) {
  return target instanceof Element && target.closest(host.localName) === host;
}

// design-system/src/_shared/popup.ts
function enabledRows(menu, rowSelector) {
  return Array.from(menu.querySelectorAll(rowSelector)).filter((row) => !row.hidden && row.getAttribute("aria-disabled") !== "true");
}
function rowLabel(row, labelSelector) {
  const label = row.querySelector(labelSelector);
  return (label ?? row).textContent?.trim() ?? "";
}

// design-system/src/PopupMenu/PopupMenu.ts
var ROW = ".popupmenu__row";
var CURRENT = "popupmenu__row--hover";
var OPEN = "popupmenu__row--open";
var PRESSED = "popupmenu__row--pressed";
var KEYS = "popupmenu--keys";
function rowOf(target) {
  return target instanceof Element ? target.closest(ROW) : null;
}
function isDisabled(row) {
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
      if (isDisabled(row)) return;
      const sub = submenuOf(row);
      const open = sub !== null && !sub.hidden;
      if (row.classList.contains(CURRENT) && (sub === null || open)) return;
      this.#show(root, row, sub ? row : null);
    });
    this.on(this, "pointerdown", (event) => {
      const row = rowOf(event.target);
      if (row && ownedBy(this, event.target) && event.button === 0 && !isDisabled(row)) row.classList.add(PRESSED);
    });
    const release = () => {
      for (const row of this.all(ROW + "." + PRESSED)) row.classList.remove(PRESSED);
    };
    this.on(this, "pointerup", release);
    this.on(this, "pointercancel", release);
    this.on(this, "pointerout", (event) => {
      const row = rowOf(event.target);
      if (row && !(event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) row.classList.remove(PRESSED);
    });
    this.on(this, "click", (event) => {
      const row = rowOf(event.target);
      if (!row || !ownedBy(this, event.target) || isDisabled(row)) return;
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
    for (const row of Array.from(root.querySelectorAll(ROW)).filter((each) => ownedBy(this, each))) {
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
=======
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
>>>>>>> origin/master
      default:
        return;
    }
    event.preventDefault();
  }
<<<<<<< HEAD
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
    const picked = this.#ownRows().find((row) => row.getAttribute("aria-selected") === "true");
    return picked?.dataset.value ?? (picked ? rowLabel(picked, ".popupmenu__label") : "");
  }
  set value(next) {
    const row = this.#ownRows();
    const match = row.find((each) => (each.dataset.value ?? rowLabel(each, ".popupmenu__label")) === next);
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
    this.on(panel, "mousedown", (event) => {
      if (!this.#inWidget(event.target)) event.preventDefault();
    });
    this.on(panel, "keydown", (event) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented && event.target instanceof HTMLInputElement && this.#inWidget(event.target)) return;
        event.preventDefault();
        if (this.parentElement?.closest(".combobutton-menu")) event.stopPropagation();
        this.#close(true);
      } else if (event.key === "Tab" && !this.#inWidget(event.target)) {
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
  // The top-level rows of this combo's own list. A combo nested in a widget block keeps its rows.
  #ownRows() {
    const root = this.#panel.querySelector("ue-popup-menu .popupmenu[tabindex]");
    return root ? Array.from(root.querySelectorAll(":scope > .popupmenu__row")) : [];
  }
  #rows() {
    return this.#ownRows().filter((row) => !row.hidden && row.getAttribute("aria-disabled") !== "true");
  }
  // True when the target sits in a widget block (.popupmenu__widget) of this combo's own menu.
  #inWidget(target) {
    const widget = target instanceof Element ? target.closest(".popupmenu__widget") : null;
    return widget !== null && widget.closest(".combobutton-menu") === this.#panel;
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
    const field = Array.from(this.#panel.querySelectorAll("[data-autofocus]")).find((each) => this.#inWidget(each));
    field?.focus({ preventScroll: true });
    this.emit("ue-combo-toggle", { open: true });
  }
  #close(refocus) {
    this.#panel.hidden = true;
    this.#trigger.classList.remove(OPEN2);
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#popup().reset();
    if (refocus) this.#trigger.focus();
    this.emit("ue-combo-toggle", { open: false });
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
=======
>>>>>>> origin/master
};
define("ue-combo-button", UeComboButtonElement);
export {
  UeComboButtonElement
};
