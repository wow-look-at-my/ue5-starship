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

// design-system/src/ResetToDefault/ResetToDefault.ts
var UeResetToDefaultElement = class extends UeElement {
  static observedAttributes = ["differs"];
  attributeChangedCallback() {
    this.#sync();
  }
  setup() {
    const button = this.one("button.resettodefault");
    if (!button) throw new Error("ue-reset-to-default needs a button.resettodefault element");
    this.#sync();
    this.on(button, "click", () => {
      if (this.hasAttribute("differs")) this.emit("ue-reset", {});
    });
  }
  // The idle button keeps its slot but is invisible, disabled and out of the tab order.
  #sync() {
    const button = this.one("button.resettodefault");
    if (!button) return;
    const differs = this.hasAttribute("differs");
    button.classList.toggle("resettodefault--idle", !differs);
    button.disabled = !differs;
  }
};
define("ue-reset-to-default", UeResetToDefaultElement);

// design-system/src/SpinBox/SpinBox.ts
var DRAG_TRIGGER = 5;
var MIN_SLIDER_WIDTH = 100;
function numberAttr(el, name) {
  const raw = el.dataset[name];
  if (raw === void 0 || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function rangeOf(box) {
  const min = numberAttr(box, "min");
  const max = numberAttr(box, "max");
  return { min: min ?? -Infinity, max: max ?? Infinity, bounded: min !== null && max !== null, delta: numberAttr(box, "delta") ?? numberAttr(box, "step") ?? 0 };
}
function valueOf(box) {
  return numberAttr(box, "value") ?? 0;
}
function format(value) {
  const rounded = Math.round(value * 1e3) / 1e3;
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}
function clamp(value, range) {
  return Math.min(range.max, Math.max(range.min, value));
}
var UeSpinBoxElement = class extends UeElement {
  #drags = /* @__PURE__ */ new WeakMap();
  // The current value. The setter redraws the box and fires no ue-spin-change, because the owner that sets it already knows.
  get value() {
    const box = this.one(".spinbox");
    return box ? valueOf(box) : 0;
  }
  set value(next) {
    const box = this.one(".spinbox");
    if (!box) throw new Error("ue-spin-box needs a .spinbox element");
    box.dataset.value = String(next);
    this.#render(box);
  }
  setup() {
    const box = this.one(".spinbox");
    if (!box) throw new Error("ue-spin-box needs a .spinbox element");
    this.#render(box);
    this.on(box, "pointerdown", (event) => {
      if (event.button !== 0 || box.getAttribute("aria-disabled") === "true") return;
      if (box.classList.contains("spinbox--text")) return;
      box.setPointerCapture(event.pointerId);
      this.#drags.set(box, { pointerId: event.pointerId, lastX: event.clientX, distance: 0, dragging: false, before: valueOf(box), internal: valueOf(box) });
      box.focus();
      event.preventDefault();
    });
    this.on(box, "pointermove", (event) => {
      const state = this.#drags.get(box);
      if (!state || state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.lastX;
      state.lastX = event.clientX;
      if (!state.dragging) {
        state.distance += Math.abs(dx);
        if (state.distance > DRAG_TRIGGER) {
          state.dragging = true;
          box.classList.add("spinbox--active");
        }
        return;
      }
      this.#drag(box, state, dx);
    });
    const finish = (event) => {
      const state = this.#drags.get(box);
      if (!state || state.pointerId !== event.pointerId) return;
      this.#drags.delete(box);
      if (box.hasPointerCapture(event.pointerId)) box.releasePointerCapture(event.pointerId);
      box.classList.remove("spinbox--active");
      if (event.type === "pointercancel") return;
      if (state.dragging) {
        const range = rangeOf(box);
        if (range.delta > 0) this.#set(box, clamp(Math.round(valueOf(box) / range.delta) * range.delta, range));
      } else {
        this.#enterText(box);
      }
    };
    this.on(box, "pointerup", finish);
    this.on(box, "pointercancel", finish);
    this.on(box, "keydown", (event) => {
      if (box.getAttribute("aria-disabled") === "true") return;
      const state = this.#drags.get(box);
      if (event.key === "Escape" && state?.dragging) {
        this.#drags.delete(box);
        if (box.hasPointerCapture(state.pointerId)) box.releasePointerCapture(state.pointerId);
        box.classList.remove("spinbox--active");
        this.#set(box, state.before);
        event.preventDefault();
        return;
      }
      if (event.target !== box) return;
      const range = rangeOf(box);
      if (event.key === "ArrowUp" || event.key === "ArrowRight") this.#set(box, clamp(valueOf(box) + range.delta, range));
      else if (event.key === "ArrowDown" || event.key === "ArrowLeft") this.#set(box, clamp(valueOf(box) - range.delta, range));
      else if (event.key === "Enter") this.#enterText(box);
      else return;
      event.preventDefault();
    });
    this.on(box, "focusout", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.classList.contains("spinbox__field")) this.#exitText(box, true, false);
    });
  }
  // The value change of one mouse move while dragging, from SSpinBox::OnMouseMove.
  #drag(box, state, dx) {
    const range = rangeOf(box);
    const width = Math.max(box.getBoundingClientRect().width, MIN_SLIDER_WIDTH);
    let next;
    if (range.bounded) {
      const step = range.max - range.min <= 10 ? 0.1 : 1;
      const filled = Math.min(width, Math.max(0, (state.internal - range.min) / (range.max - range.min) * width + dx * step));
      next = range.min + filled / width * (range.max - range.min);
    } else {
      const sign = dx > 0 ? 1 : -1;
      next = state.internal + sign * (Math.abs(dx) / width) * Math.max(Math.abs(state.internal), 1);
    }
    state.internal = clamp(next, range);
    this.#set(box, state.internal);
  }
  #set(box, value) {
    const before = valueOf(box);
    box.dataset.value = String(value);
    this.#render(box);
    if (value !== before) this.emit("ue-spin-change", { value, text: format(value) + (box.dataset.unit ? " " + box.dataset.unit : "") });
  }
  #render(box) {
    const range = rangeOf(box);
    const value = valueOf(box);
    box.setAttribute("aria-valuenow", String(value));
    if (range.bounded) {
      box.setAttribute("aria-valuemin", String(range.min));
      box.setAttribute("aria-valuemax", String(range.max));
      box.style.setProperty("--spinbox-fill", String((value - range.min) / (range.max - range.min)));
    }
    box.classList.toggle("spinbox--unbounded", !range.bounded);
    const text = box.querySelector(".spinbox__text");
    if (text && !box.classList.contains("spinbox--text")) text.textContent = format(value);
    const unit = box.dataset.unit;
    let suffix = box.querySelector(".spinbox__unit");
    if (unit && !suffix && text) {
      suffix = document.createElement("span");
      suffix.className = "spinbox__unit";
      text.after(suffix);
    }
    if (suffix) suffix.textContent = unit ?? "";
  }
  #enterText(box) {
    const text = box.querySelector(".spinbox__text");
    if (!text) return;
    box.classList.add("spinbox--text");
    const field = document.createElement("input");
    field.className = "spinbox__field";
    field.type = "text";
    field.value = format(valueOf(box));
    field.setAttribute("aria-label", "Value");
    text.replaceChildren(field);
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.#exitText(box, true, true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.#exitText(box, false, true);
      }
    });
    field.focus();
    field.select();
  }
  #exitText(box, commit, refocus) {
    const field = box.querySelector(".spinbox__field");
    if (!field || !box.classList.contains("spinbox--text")) return;
    const typed = Number(field.value.trim());
    box.classList.remove("spinbox--text");
    const range = rangeOf(box);
    if (commit && field.value.trim() !== "" && Number.isFinite(typed)) this.#set(box, clamp(typed, range));
    else this.#render(box);
    if (refocus) box.focus();
  }
};
define("ue-spin-box", UeSpinBoxElement);

// design-system/src/VectorInput/VectorInput.ts
var round = (value) => Math.round(value * 1e6) / 1e6;
var UeVectorInput = class extends UeElement {
  // The values of each row as of the last change, which is the basis of the lock ratio.
  #last = /* @__PURE__ */ new WeakMap();
  setup() {
    for (const row of this.all(".VectorInput-row")) {
      if (!this.owns(row)) continue;
      this.#last.set(row, this.#read(row));
      this.#syncReset(row, this.#read(row));
    }
    this.on(this, "ue-spin-change", (event) => {
      const row = this.#rowOf(event.target);
      if (!row) return;
      const fields = this.#fields(row);
      const index = fields.indexOf(event.target);
      const values = this.#read(row);
      const before = this.#last.get(row) ?? values;
      if (this.#locked(row)) {
        for (let j = 0; j < fields.length; j++) {
          if (j === index) continue;
          values[j] = before[index] === 0 ? values[index] : round(before[j] * values[index] / before[index]);
          fields[j].value = values[j];
        }
      }
      this.#commit(row, values);
    });
    this.on(this, "ue-reset", (event) => {
      const row = this.#rowOf(event.target);
      if (!row) return;
      const defaults = (row.dataset.default ?? "").split(",").map(Number);
      this.#fields(row).forEach((field, i) => {
        field.value = defaults[i];
      });
      this.#commit(row, defaults);
    });
    this.on(this, "ue-button-click", (event) => {
      const lock = this.#rowOf(event.target) ? event.target.querySelector('[data-role="lock"]') : null;
      if (lock) lock.title = event.detail.pressed ? "Scale uniformly (locked)" : "Scale uniformly (unlocked)";
    });
    this.on(this, "ue-combo-pick", (event) => {
      if (this.#rowOf(event.target)) this.emit("ue-vector-space", { space: event.detail.label });
    });
  }
  // The row of this element that holds the target, or null for a target of a nested instance.
  #rowOf(target) {
    if (!this.owns(target)) return null;
    return target.closest(".VectorInput-row");
  }
  #fields(row) {
    return Array.from(row.querySelectorAll("ue-spin-box"));
  }
  #read(row) {
    return Array.from(row.querySelectorAll(".spinbox"), (box) => Number(box.dataset.value));
  }
  #locked(row) {
    return row.querySelector('[data-role="lock"]')?.getAttribute("aria-pressed") === "true";
  }
  // Shows the reset arrow only while a value differs from its default.
  #syncReset(row, values) {
    const defaults = (row.dataset.default ?? "").split(",").map(Number);
    row.querySelector("ue-reset-to-default")?.toggleAttribute("differs", values.some((value, i) => Math.abs(value - defaults[i]) > 1e-9));
  }
  #commit(row, values) {
    this.#last.set(row, values);
    this.#syncReset(row, values);
    this.emit("ue-vector-change", { values });
  }
};
define("ue-vector-input", UeVectorInput);
