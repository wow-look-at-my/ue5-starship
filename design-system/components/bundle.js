/* @ds-bundle: {"format":4,"namespace":"UEStarship","components":[]} */
(() => {
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
  function moveRowFocus(rows, current, key) {
    if (rows.length === 0) return false;
    const index = current instanceof HTMLElement ? rows.indexOf(current) : -1;
    let next;
    if (key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % rows.length;
    else if (key === "ArrowUp") next = index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length;
    else if (key === "Home") next = 0;
    else if (key === "End") next = rows.length - 1;
    else return false;
    rows[next].focus();
    return true;
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
    #disabled() {
      return this.#trigger.getAttribute("aria-disabled") === "true";
    }
    // Action mode keeps the label fixed. Value mode shows the picked row.
    #isAction() {
      return this.#trigger.classList.contains("combobutton--simple") || this.getAttribute("mode") === "action" || this.#label() === null;
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

  // design-system/src/AssetPicker/AssetPicker.ts
  var UeAssetPicker = class extends UeElement {
    setup() {
      const row = this.one(".AssetPicker-row");
      const combo = this.one("ue-combo-button");
      const thumb = this.one(".AssetPicker-thumbFrame");
      const reset = this.one("ue-reset-to-default");
      const label = this.one(".combobutton__label");
      if (!row || !combo || !label) return;
      const fallback = row.dataset.default ?? "None";
      const show = (value) => {
        row.dataset.value = value;
        if (thumb) {
          thumb.title = value === "None" ? "None" : "/Game/Props/" + value + "." + value;
          thumb.setAttribute("aria-label", value);
        }
        reset?.toggleAttribute("differs", value !== fallback);
      };
      const change = (value) => {
        show(value);
        this.emit("ue-asset-change", { asset: value });
      };
      show(label.textContent?.trim() ?? fallback);
      this.on(this, "ue-combo-pick", (event) => {
        if (this.owns(event.target)) change(event.detail.value);
      });
      this.on(this, "ue-button-click", (event) => {
        if (!this.owns(event.target)) return;
        const role = event.target.querySelector("[data-role]")?.getAttribute("data-role");
        if (role === "use") {
          combo.value = row.dataset.selection ?? fallback;
          change(combo.value);
        } else if (role === "browse") {
          this.emit("ue-asset-browse", { asset: row.dataset.value ?? fallback });
        }
      });
      this.on(this, "ue-reset", (event) => {
        if (!this.owns(event.target)) return;
        combo.value = fallback;
        change(fallback);
      });
    }
  };
  define("ue-asset-picker", UeAssetPicker);

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

  // design-system/src/_shared/tileGrid.ts
  function nearestInRow(tiles, from, down) {
    const tops = new Map(tiles.map((tile) => [tile, tile.getBoundingClientRect()]));
    const box = from.getBoundingClientRect();
    const rows = tiles.filter((tile) => {
      const top = tops.get(tile)?.top ?? box.top;
      return down ? top > box.top + 1 : top < box.top - 1;
    });
    if (rows.length === 0) return void 0;
    const edgeTops = rows.map((tile) => tops.get(tile)?.top ?? 0);
    const edge = down ? Math.min(...edgeTops) : Math.max(...edgeTops);
    const centre = box.left + box.width / 2;
    const distance = (tile) => {
      const rect = tops.get(tile);
      return rect ? Math.abs(rect.left + rect.width / 2 - centre) : Infinity;
    };
    const line = rows.filter((tile) => tops.get(tile)?.top === edge);
    return line.reduce((best, tile) => distance(tile) < distance(best) ? tile : best);
  }

  // design-system/src/AssetTile/AssetTile.ts
  var SELECTED = "is-selected";
  var FOLDER = '<svg class="AssetTile__folderIcon" viewBox="0 0 64 64" aria-hidden="true"><path d="M2 13a2 2 0 0 1 2-2h18l5 6h33a2 2 0 0 1 2 2v31a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="currentColor"/><path d="M2 13a2 2 0 0 1 2-2h18l5 6H2z" fill="#fff" opacity=".12"/><path d="M2 24h60v26a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#000" opacity=".12"/></svg>';
  var CUBE = '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M16 3l11 6v14l-11 6-11-6V9z"/><path d="M5 9l11 6 11-6M16 15v14"/></g></svg>';
  var AssetTileElement = class extends UeElement {
    #anchor = null;
    #grid = null;
    #lastIds = "";
    setup() {
      this.#anchor = null;
      const grid = this.all(".AssetTile-grid").find((candidate) => this.owns(candidate)) ?? this.#createGrid();
      this.#grid = grid;
      grid.setAttribute("role", "listbox");
      grid.setAttribute("aria-multiselectable", String(!this.#single()));
      for (const tile of this.#tiles()) {
        tile.setAttribute("role", "option");
        tile.setAttribute("aria-selected", String(tile.classList.contains(SELECTED)));
      }
      this.#rove(null);
      this.#lastIds = this.getSelectedIds().join("\n");
      this.on(this, "click", (event) => {
        if (this.owns(event.target)) this.#click(event);
      });
      this.on(this, "dblclick", (event) => {
        if (this.owns(event.target)) this.#open(this.#tileAt(event.target));
      });
      this.on(this, "keydown", (event) => {
        if (this.owns(event.target)) this.#keydown(event);
      });
    }
    #createGrid() {
      const grid = document.createElement("div");
      grid.className = "AssetTile-grid";
      this.append(grid);
      return grid;
    }
    // select="single" makes every click and key pick one tile. The default is multiple selection.
    #single() {
      return this.getAttribute("select") === "single";
    }
    #tiles() {
      return Array.from(this.#grid?.children ?? []).filter((child2) => child2 instanceof HTMLElement && child2.classList.contains("AssetTile"));
    }
    #tileAt(target) {
      const tile = target instanceof Element ? target.closest(".AssetTile") : null;
      return tile && this.#tiles().includes(tile) ? tile : null;
    }
    #name(tile) {
      return (tile.querySelector(".AssetTile__name")?.textContent ?? "").trim();
    }
    #idOf(tile) {
      return tile.dataset.id ?? this.#name(tile);
    }
    // Ids of the selected tiles in grid order.
    getSelectedIds() {
      return this.#tiles().filter((tile) => tile.classList.contains(SELECTED)).map((tile) => this.#idOf(tile));
    }
    // Selects exactly these tiles. Ids that name no tile are ignored. A single-select grid keeps the first.
    select(ids) {
      const wanted = new Set(this.#single() ? ids.slice(0, 1) : ids);
      const tiles = this.#tiles();
      for (const tile of tiles) this.#mark(tile, wanted.has(this.#idOf(tile)));
      this.#anchor = tiles.find((tile) => tile.classList.contains(SELECTED)) ?? null;
      this.#rove(this.#anchor);
      this.#announce();
    }
    // Replaces every tile with tiles drawn from data.
    setTiles(tiles) {
      const grid = this.#grid;
      if (!grid) return;
      grid.replaceChildren(...tiles.map((data) => this.#draw(data)));
      this.#anchor = null;
      this.#rove(null);
      this.#lastIds = this.getSelectedIds().join("\n");
    }
    #draw(data) {
      const tile = document.createElement("div");
      const folder = data.kind === "folder";
      tile.className = "AssetTile " + (folder ? "AssetTile--folder" : "AssetTile--asset") + (data.selected ? " " + SELECTED : "");
      tile.dataset.id = data.id;
      tile.setAttribute("role", "option");
      tile.setAttribute("aria-selected", String(data.selected === true));
      const thumb = folder ? FOLDER : '<div class="AssetTile__asset"><span class="AssetTile__glyph"></span><span class="AssetTile__strip"></span></div>';
      tile.innerHTML = '<div class="AssetTile__card"><div class="AssetTile__thumb">' + thumb + '</div><div class="AssetTile__nameArea"><div class="AssetTile__name"></div>' + (folder ? "" : '<div class="AssetTile__class"></div>') + "</div></div>";
      const name = tile.querySelector(".AssetTile__name");
      if (name) name.textContent = data.label;
      if (!folder) {
        const holder = tile.querySelector(".AssetTile__glyph");
        if (holder && data.thumb) {
          const image = document.createElement("img");
          image.className = "AssetTile__image";
          image.src = data.thumb;
          image.alt = "";
          holder.replaceWith(image);
        } else {
          holder?.insertAdjacentHTML("afterend", CUBE);
          holder?.remove();
        }
        const kind = tile.querySelector(".AssetTile__class");
        if (kind) kind.textContent = data.typeLabel ?? "";
        if (data.strip) tile.querySelector(".AssetTile__strip")?.style.setProperty("--strip", data.strip);
      }
      return tile;
    }
    // One tile takes the Tab stop: `stop`, else the first selected tile, else the first tile.
    #rove(stop) {
      const tiles = this.#tiles();
      const chosen = stop ?? tiles.find((tile) => tile.classList.contains(SELECTED)) ?? tiles[0];
      for (const tile of tiles) tile.tabIndex = tile === chosen ? 0 : -1;
    }
    // Announces the selection when it differs from the last one announced.
    #announce() {
      const ids = this.getSelectedIds();
      const key = ids.join("\n");
      if (key === this.#lastIds) return;
      this.#lastIds = key;
      this.emit("ue-tile-select", { ids });
    }
    #mark(tile, selected) {
      tile.classList.toggle(SELECTED, selected);
      tile.setAttribute("aria-selected", String(selected));
    }
    // Applies a click or key movement to the selection of the tile's group.
    #choose(tile, wantToggle, wantRange) {
      const toggle = wantToggle && !this.#single();
      const range = wantRange && !this.#single();
      const tiles = this.#tiles();
      if (range && this.#anchor && tiles.includes(this.#anchor)) {
        const from = tiles.indexOf(this.#anchor);
        const to = tiles.indexOf(tile);
        tiles.forEach((each, i) => this.#mark(each, i >= Math.min(from, to) && i <= Math.max(from, to)));
      } else if (toggle) {
        this.#mark(tile, !tile.classList.contains(SELECTED));
        this.#anchor = tile;
      } else {
        for (const each of tiles) this.#mark(each, each === tile);
        this.#anchor = tile;
      }
      this.#rove(tile);
      this.#announce();
    }
    #click(event) {
      const tile = this.#tileAt(event.target);
      if (!tile) return;
      this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
      tile.focus();
    }
    #open(tile) {
      if (!tile) return;
      this.emit("ue-tile-open", { id: this.#idOf(tile) });
    }
    #keydown(event) {
      const tile = event.target instanceof HTMLElement && event.target.matches(".AssetTile") ? this.#tileAt(event.target) : null;
      if (!tile) return;
      const tiles = this.#tiles();
      const at = tiles.indexOf(tile);
      let go;
      switch (event.key) {
        case "ArrowRight":
          go = tiles[at + 1];
          break;
        case "ArrowLeft":
          go = tiles[at - 1];
          break;
        case "ArrowDown":
          go = nearestInRow(tiles, tile, true);
          break;
        case "ArrowUp":
          go = nearestInRow(tiles, tile, false);
          break;
        case "Home":
          go = tiles[0];
          break;
        case "End":
          go = tiles[tiles.length - 1];
          break;
        case "Enter":
          event.preventDefault();
          this.#open(tile);
          return;
        case " ":
          event.preventDefault();
          this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
          return;
        case "a":
        case "A":
          if (!(event.ctrlKey || event.metaKey) || this.#single()) return;
          event.preventDefault();
          for (const each of tiles) this.#mark(each, true);
          this.#announce();
          return;
        default:
          return;
      }
      event.preventDefault();
      if (!go) return;
      if ((event.ctrlKey || event.metaKey) && !this.#single()) {
        this.#rove(go);
      } else {
        this.#choose(go, false, event.shiftKey);
      }
      go.focus();
    }
  };
  define("ue-asset-tile", AssetTileElement);

  // design-system/src/Checkbox/Checkbox.ts
  function disabled(el) {
    return el.getAttribute("aria-disabled") === "true";
  }
  function nextState(el) {
    const state = el.getAttribute("aria-checked");
    if (el.classList.contains("checkbox--tristate")) {
      if (state === "false") return "true";
      return state === "true" ? "mixed" : "false";
    }
    return state === "true" ? "false" : "true";
  }
  var UeCheckboxElement = class extends UeElement {
    setup() {
      const el = this.one(".checkbox, .checkbox-toggle");
      if (!el) throw new Error("ue-checkbox needs a .checkbox or .checkbox-toggle element");
      const pressedClass = el.classList.contains("checkbox") ? "checkbox--pressed" : "checkbox-toggle--pressed";
      this.on(el, "click", () => {
        if (!disabled(el)) this.#toggle(el);
      });
      this.on(el, "keydown", (event) => {
        if (disabled(el) || el !== event.target) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!event.repeat) el.classList.add(pressedClass);
      });
      this.on(el, "keyup", (event) => {
        if (disabled(el) || el !== event.target) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        if (el.classList.contains(pressedClass)) {
          el.classList.remove(pressedClass);
          this.#toggle(el);
        }
      });
      this.on(el, "focusout", () => el.classList.remove(pressedClass));
    }
    #toggle(el) {
      let text;
      let checked;
      if (el.classList.contains("checkbox-toggle")) {
        const on = !el.classList.contains("checkbox-toggle--checked");
        el.classList.toggle("checkbox-toggle--checked", on);
        el.setAttribute("aria-pressed", String(on));
        text = on ? "on" : "off";
        checked = on;
      } else {
        const state = nextState(el);
        el.setAttribute("aria-checked", state);
        text = state === "mixed" ? "undetermined" : state === "true" ? "checked" : "unchecked";
        checked = state === "mixed" ? null : state === "true";
      }
      const label = el.dataset.label ?? el.getAttribute("aria-label") ?? el.querySelector(".checkbox__label")?.textContent?.trim() ?? el.textContent?.trim() ?? "";
      this.emit("ue-checkbox-change", { label, state: text, checked, text: label + " is " + text });
    }
  };
  define("ue-checkbox", UeCheckboxElement);

  // design-system/src/_shared/drag.ts
  var THRESHOLD = 3;
  function drag(target, handlers) {
    let originX = 0;
    let originY = 0;
    let active = false;
    let moved = false;
    const down = (event) => {
      if (event.button !== 0) return;
      active = true;
      moved = false;
      originX = event.clientX;
      originY = event.clientY;
      target.setPointerCapture(event.pointerId);
      handlers.start?.(event);
    };
    const move = (event) => {
      if (!active) return;
      const dx = event.clientX - originX;
      const dy = event.clientY - originY;
      if (!moved && Math.hypot(dx, dy) < THRESHOLD) return;
      moved = true;
      handlers.move(event, dx, dy);
    };
    const up = (event) => {
      if (!active) return;
      active = false;
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      handlers.end?.(event, moved);
    };
    target.addEventListener("pointerdown", down);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
    return () => {
      target.removeEventListener("pointerdown", down);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
  }

  // design-system/src/ContentBrowser/ContentBrowser.ts
  var PREFIX2 = "ContentBrowser";
  var INDENT_PX = 10;
  var MIN_SOURCES = 120;
  var MIN_ASSETS = 200;
  var HANDLE_PX = 2;
  var CHEVRON = '<span class="ContentBrowser__delim"><svg><use href="#cb-chev-r"/></svg></span>';
  var STARTER = [
    ["Architecture", ["Walls", "Floors"]],
    ["Audio", ["Music", "Ambient"]],
    ["Blueprints", ["Actors"]],
    ["HDRI", ["Outdoor"]],
    ["Maps", ["Overview", "Test"]],
    ["Materials", ["Metal", "Wood"]],
    ["Particles", ["Fire", "Smoke"]],
    ["Props", ["Furniture", "Lamps"]],
    ["Shapes", ["Primitives"]],
    ["Textures", ["Brick", "Stone"]]
  ];
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
  function child(parent, name) {
    const folder = { name, parent, kids: [] };
    parent.kids.push(folder);
    return folder;
  }
  function buildModel() {
    const all = { name: "All", parent: null, kids: [] };
    const content = child(all, "Content");
    const start = child(content, "StarterContent");
    for (const [name, kids] of STARTER) {
      const folder = child(start, name);
      for (const kid of kids) child(folder, kid);
    }
    return { all, start };
  }
  function pathOf(folder) {
    const path = [];
    for (let at = folder; at; at = at.parent) path.unshift(at);
    return path;
  }
  function escape(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }
  var ContentBrowserElement = class extends UeElement {
    #root;
    #top;
    #body;
    #sources;
    #split;
    #tree;
    #tiles;
    #status;
    #input;
    #all;
    #cur;
    #open = /* @__PURE__ */ new Set();
    #history = [];
    #index = 0;
    #picked = /* @__PURE__ */ new Set();
    #anchor = null;
    #rowFolder = /* @__PURE__ */ new WeakMap();
    #tileFolder = /* @__PURE__ */ new WeakMap();
    #menu = null;
    #checks = /* @__PURE__ */ new Map();
    setup() {
      this.#root = this.#need(".ContentBrowser");
      this.#top = this.#need(".ContentBrowser__top");
      this.#body = this.#need(".ContentBrowser__body");
      this.#sources = this.#need(".ContentBrowser__sources");
      this.#split = this.#need(".ContentBrowser__split");
      this.#tree = this.#need(".ContentBrowser__tree[data-folders]");
      this.#tiles = this.#need(".ContentBrowser__tiles");
      this.#status = this.#need(".ContentBrowser__status");
      this.#input = this.#need(".ContentBrowser__input");
      const keptNames = this.all(".ContentBrowser__tile.is-sel .ContentBrowser__label div").map((label) => (label.textContent ?? "").trim());
      const model = buildModel();
      this.#all = model.all;
      this.#cur = model.start;
      this.#open = new Set(pathOf(model.start));
      this.#history = [model.start.parent ?? model.start, model.start];
      this.#index = 1;
      this.#picked = new Set(model.start.kids.filter((folder) => keptNames.includes(folder.name)));
      this.#anchor = null;
      this.#menu = null;
      this.#checks = new Map(SETTINGS_DEFAULTS);
      for (const title of this.all(".ContentBrowser__title")) {
        const area = title.closest(".ContentBrowser__area");
        const body = area?.querySelector(".ContentBrowser__tree");
        title.setAttribute("role", "button");
        title.tabIndex = 0;
        title.setAttribute("aria-expanded", String(body ? !body.hidden : false));
      }
      for (const control of this.all(".ContentBrowser__tool")) {
        control.setAttribute("role", "button");
        control.tabIndex = 0;
        control.setAttribute("aria-pressed", "false");
      }
      this.#tree.setAttribute("role", "tree");
      this.#tiles.setAttribute("role", "listbox");
      this.#tiles.setAttribute("aria-multiselectable", "true");
      this.#split.setAttribute("role", "separator");
      this.#split.setAttribute("aria-orientation", "vertical");
      this.#split.tabIndex = 0;
      this.#setSourcesWidth(this.#sources.offsetWidth);
      this.#render();
      this.on(this.#root, "click", (event) => this.#click(event));
      this.on(this.#root, "dblclick", (event) => {
        const folder = this.#folderOfTile(event.target);
        if (folder) this.#go(folder);
      });
      this.on(this.#root, "keydown", (event) => this.#keydown(event));
      this.on(this.#input, "input", () => this.#renderTiles());
      let startWidth = 0;
      this.onDispose(
        drag(this.#split, {
          start: () => {
            startWidth = this.#sources.offsetWidth;
            this.#split.classList.add("is-dragging");
          },
          move: (_event, dx) => this.#setSourcesWidth(startWidth + dx),
          end: () => this.#split.classList.remove("is-dragging")
        })
      );
      this.onDispose(() => this.#menu?.close());
    }
    #need(selector) {
      const found = this.one(selector);
      if (!found) throw new Error("ue-content-browser needs " + selector);
      return found;
    }
    // ---- navigation ----
    #go(folder) {
      if (folder === this.#cur) return;
      this.#history = this.#history.slice(0, this.#index + 1);
      this.#history.push(folder);
      this.#index = this.#history.length - 1;
      this.#show(folder);
    }
    #walk(delta) {
      const next = this.#index + delta;
      if (next < 0 || next >= this.#history.length) return;
      const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains("ContentBrowser__nav");
      this.#index = next;
      this.#show(this.#history[next]);
      if (hadFocus) {
        const own = this.one(delta < 0 ? ".ContentBrowser__nav--back" : ".ContentBrowser__nav--fwd");
        const other = this.one(delta < 0 ? ".ContentBrowser__nav--fwd" : ".ContentBrowser__nav--back");
        (own && !own.disabled ? own : other)?.focus();
      }
    }
    #show(folder) {
      for (let at = folder.parent; at; at = at.parent) this.#open.add(at);
      this.#cur = folder;
      this.#picked.clear();
      this.#anchor = null;
      this.#input.value = "";
      this.#render();
      this.emit("contentbrowser:navigate", { path: pathOf(folder).map((each) => each.name) });
    }
    #toggleOpen(folder) {
      if (this.#open.has(folder)) {
        this.#open.delete(folder);
        if (pathOf(this.#cur).includes(folder) && this.#cur !== folder) {
          this.#go(folder);
          return;
        }
      } else {
        this.#open.add(folder);
      }
      this.#render();
    }
    // ---- rendering ----
    #render() {
      const active = document.activeElement;
      const rowFolder = active ? this.#rowFolder.get(active) : void 0;
      const tileFolder = active ? this.#tileFolder.get(active) : void 0;
      this.#input.placeholder = "Search " + this.#cur.name;
      this.#renderCrumbs();
      this.#renderNav();
      this.#renderTree();
      this.#renderTiles();
      if (rowFolder) this.#rowOf(rowFolder)?.focus();
      else if (tileFolder) this.#tileOf(tileFolder)?.focus();
    }
    #renderCrumbs() {
      const path = this.#need(".ContentBrowser__path");
      for (const old of this.all(".ContentBrowser__crumb, .ContentBrowser__delim")) old.remove();
      for (const folder of pathOf(this.#cur)) path.insertAdjacentHTML("beforeend", '<button class="ContentBrowser__crumb">' + escape(folder.name) + "</button>" + CHEVRON);
    }
    #renderNav() {
      const back = this.one(".ContentBrowser__nav--back");
      const fwd = this.one(".ContentBrowser__nav--fwd");
      if (back) back.disabled = this.#index === 0;
      if (fwd) fwd.disabled = this.#index >= this.#history.length - 1;
    }
    #renderTree() {
      const lines = [];
      const folders = [];
      const parents = new Set(pathOf(this.#cur).slice(0, -1));
      const walk = (folder, depth) => {
        const kids = folder.kids.length > 0;
        const open = kids && this.#open.has(folder);
        const classes = ["ContentBrowser__row"];
        if (parents.has(folder)) classes.push("ContentBrowser__row--parent");
        if (depth === 0) classes.push("ContentBrowser__row--root");
        const selected = folder === this.#cur;
        if (selected) classes.push("ContentBrowser__row--sel");
        const expanded = kids ? ' aria-expanded="' + open + '"' : "";
        const style = depth > 0 ? ' style="padding-left:' + depth * INDENT_PX + 'px"' : "";
        const caret = kids ? '<svg><use href="#cb-' + (open ? "cd" : "cr") + '"/></svg>' : "";
        lines.push(
          '<div class="' + classes.join(" ") + '" role="treeitem" aria-level="' + (depth + 1) + '" aria-selected="' + selected + '"' + expanded + ' tabindex="' + (selected ? 0 : -1) + '"' + style + '><span class="ContentBrowser__exp">' + caret + '</span><svg class="ContentBrowser__fi"><use href="#cb-' + (open ? "fo" : "fc") + '"/></svg><span class="ContentBrowser__name">' + escape(folder.name) + "</span></div>"
        );
        folders.push(folder);
        if (open) for (const kid of folder.kids) walk(kid, depth + 1);
      };
      walk(this.#all, 0);
      this.#tree.innerHTML = lines.join("");
      this.#tree.querySelectorAll(".ContentBrowser__row").forEach((row, i) => this.#rowFolder.set(row, folders[i]));
      this.#revealSelected();
    }
    // Scrolls only the tree, never the page.
    #revealSelected() {
      const row = this.#tree.querySelector(".ContentBrowser__row--sel");
      if (!row || this.#tree.hidden) return;
      const area = this.#tree.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      if (box.top < area.top) this.#tree.scrollTop -= area.top - box.top;
      else if (box.bottom > area.bottom) this.#tree.scrollTop += box.bottom - area.bottom;
    }
    #shownKids() {
      const query = this.#input.value.trim().toLowerCase();
      return this.#cur.kids.filter((folder) => folder.name.toLowerCase().includes(query));
    }
    #renderTiles() {
      const shown = this.#shownKids();
      const stop = shown.find((folder) => this.#picked.has(folder)) ?? shown[0];
      this.#tiles.innerHTML = shown.map(
        (folder) => '<div class="ContentBrowser__tile' + (this.#picked.has(folder) ? " is-sel" : "") + '" role="option" aria-selected="' + this.#picked.has(folder) + '" tabindex="' + (folder === stop ? 0 : -1) + '"><div class="ContentBrowser__card"><div class="ContentBrowser__thumb"><svg><use href="#cb-folder64"/></svg></div><div class="ContentBrowser__label"><div>' + escape(folder.name) + "</div></div></div></div>"
      ).join("");
      this.#tiles.querySelectorAll(".ContentBrowser__tile").forEach((tile, i) => this.#tileFolder.set(tile, shown[i]));
      this.#renderStatus(shown);
      const clear = this.one(".ContentBrowser__clear");
      if (clear) clear.hidden = this.#input.value === "";
    }
    #renderStatus(shown) {
      const picked = shown.filter((folder) => this.#picked.has(folder)).length;
      const count = shown.length === 1 ? "1 item" : shown.length + " items";
      this.#status.textContent = picked === 0 ? count : count + " (" + picked + " selected)";
    }
    #rowOf(folder) {
      return Array.from(this.#tree.querySelectorAll(".ContentBrowser__row")).find((row) => this.#rowFolder.get(row) === folder);
    }
    #tileOf(folder) {
      return Array.from(this.#tiles.querySelectorAll(".ContentBrowser__tile")).find((tile) => this.#tileFolder.get(tile) === folder);
    }
    #folderOfTile(target) {
      const tile = target instanceof Element ? target.closest(".ContentBrowser__tile") : null;
      return tile ? this.#tileFolder.get(tile) : void 0;
    }
    // ---- input ----
    #pick(folder, toggle, range) {
      const shown = this.#shownKids();
      if (range && this.#anchor && shown.includes(this.#anchor)) {
        const from = shown.indexOf(this.#anchor);
        const to = shown.indexOf(folder);
        this.#picked = new Set(shown.slice(Math.min(from, to), Math.max(from, to) + 1));
      } else if (toggle) {
        if (!this.#picked.delete(folder)) this.#picked.add(folder);
        this.#anchor = folder;
      } else {
        this.#picked = /* @__PURE__ */ new Set([folder]);
        this.#anchor = folder;
      }
      this.#syncTiles();
      this.#tileOf(folder)?.focus();
    }
    // Updates the selection marks in place. The tiles must stay the same elements, or a double-click would lose its target.
    #syncTiles() {
      const shown = this.#shownKids();
      const stop = shown.find((folder) => this.#picked.has(folder)) ?? shown[0];
      for (const tile of this.#tiles.querySelectorAll(".ContentBrowser__tile")) {
        const folder = this.#tileFolder.get(tile);
        const picked = folder !== void 0 && this.#picked.has(folder);
        tile.classList.toggle("is-sel", picked);
        tile.setAttribute("aria-selected", String(picked));
        tile.tabIndex = folder === stop ? 0 : -1;
      }
      this.#renderStatus(shown);
    }
    #setSourcesWidth(width) {
      const room = this.#body.clientWidth - HANDLE_PX - MIN_ASSETS;
      const clamped = Math.round(Math.max(MIN_SOURCES, Math.min(room, width)));
      this.#sources.style.width = clamped + "px";
      this.#split.setAttribute("aria-valuenow", String(clamped));
    }
    #clearSearch() {
      this.#input.value = "";
      this.#renderTiles();
      this.#input.focus();
    }
    #toggleMenu(anchor, entries, onPick) {
      const previous = this.#menu;
      if (previous) {
        previous.close();
        if (previous.anchor === anchor) return;
      }
      anchor.setAttribute("aria-haspopup", "menu");
      this.#menu = openMenu(this.#top, anchor, {
        prefix: PREFIX2,
        entries,
        onPick,
        onClose: () => {
          this.#menu = null;
        }
      });
    }
    #setSection(area, open) {
      const tree = area.querySelector(".ContentBrowser__tree");
      const arrow = area.querySelector(".ContentBrowser__head .ContentBrowser__arrow use");
      area.classList.toggle("is-collapsed", !open);
      if (tree) tree.hidden = !open;
      area.querySelector(".ContentBrowser__title")?.setAttribute("aria-expanded", String(open));
      arrow?.setAttribute("href", open ? "#cb-cd" : "#cb-cr");
    }
    #click(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const button = target.closest("button");
      if (button?.disabled) return;
      if (target.closest(".ContentBrowser__crumb")) {
        const at = this.all(".ContentBrowser__crumb").indexOf(target.closest(".ContentBrowser__crumb"));
        const folder = pathOf(this.#cur)[at];
        if (folder) this.#go(folder);
      } else if (target.closest(".ContentBrowser__nav--back")) {
        this.#walk(-1);
      } else if (target.closest(".ContentBrowser__nav--fwd")) {
        this.#walk(1);
      } else if (target.closest(".ContentBrowser__add")) {
        this.#toggleMenu(target.closest(".ContentBrowser__add"), ADD_ENTRIES, () => void 0);
      } else if (target.closest(".ContentBrowser__settings")) {
        const entries = Array.from(this.#checks, ([label, checked]) => ({ label, checkable: true, checked }));
        this.#toggleMenu(target.closest(".ContentBrowser__settings"), entries, (index) => {
          const label = entries[index].label ?? "";
          this.#checks.set(label, !this.#checks.get(label));
        });
      } else if (target.closest(".ContentBrowser__clear")) {
        this.#clearSearch();
      } else if (target.closest(".ContentBrowser__tool")) {
        const tool = target.closest(".ContentBrowser__tool");
        tool.setAttribute("aria-pressed", String(tool.getAttribute("aria-pressed") !== "true"));
      } else if (target.closest(".ContentBrowser__head")) {
        const area = target.closest(".ContentBrowser__area");
        if (area) this.#setSection(area, area.classList.contains("is-collapsed"));
      } else if (target.closest(".ContentBrowser__row")) {
        const row = target.closest(".ContentBrowser__row");
        const folder = this.#rowFolder.get(row);
        if (!folder) return;
        if (target.closest(".ContentBrowser__exp")) this.#toggleOpen(folder);
        else {
          this.#go(folder);
          this.#rowOf(folder)?.focus();
        }
      } else {
        const folder = this.#folderOfTile(target);
        if (folder) this.#pick(folder, event.ctrlKey || event.metaKey, event.shiftKey);
      }
    }
    #keydown(event) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const activate = event.key === "Enter" || event.key === " ";
      if (activate && target.matches(".ContentBrowser__title, .ContentBrowser__tool")) {
        event.preventDefault();
        target.click();
      } else if (target === this.#input) {
        if (event.key === "Escape" && this.#input.value !== "") {
          event.preventDefault();
          this.#clearSearch();
        }
      } else if (target === this.#split) {
        const step = event.shiftKey ? 50 : 10;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          this.#setSourcesWidth(this.#sources.offsetWidth + (event.key === "ArrowLeft" ? -step : step));
        }
      } else if (target.matches(".ContentBrowser__row")) {
        this.#treeKey(event, target);
      } else if (target.matches(".ContentBrowser__tile")) {
        this.#tileKey(event, target);
      }
    }
    #treeKey(event, row) {
      const folder = this.#rowFolder.get(row);
      if (!folder) return;
      const rows = Array.from(this.#tree.querySelectorAll(".ContentBrowser__row"));
      const at = rows.indexOf(row);
      const open = folder.kids.length > 0 && this.#open.has(folder);
      let go;
      switch (event.key) {
        case "ArrowDown":
          go = this.#rowFolder.get(rows[at + 1]);
          break;
        case "ArrowUp":
          go = this.#rowFolder.get(rows[at - 1]);
          break;
        case "Home":
          go = this.#rowFolder.get(rows[0]);
          break;
        case "End":
          go = this.#rowFolder.get(rows[rows.length - 1]);
          break;
        case "ArrowRight":
          if (folder.kids.length > 0 && !open) this.#toggleOpen(folder);
          else if (open) go = folder.kids[0];
          break;
        case "ArrowLeft":
          if (open) this.#toggleOpen(folder);
          else go = folder.parent ?? void 0;
          break;
        case "Enter":
        case " ":
          go = folder;
          break;
        default:
          return;
      }
      event.preventDefault();
      if (go) {
        this.#go(go);
        this.#rowOf(go)?.focus();
      } else {
        this.#rowOf(folder)?.focus();
      }
    }
    #tileKey(event, tile) {
      const folder = this.#tileFolder.get(tile);
      if (!folder) return;
      const tiles = Array.from(this.#tiles.querySelectorAll(".ContentBrowser__tile"));
      const at = tiles.indexOf(tile);
      let go;
      switch (event.key) {
        case "ArrowRight":
          go = tiles[at + 1];
          break;
        case "ArrowLeft":
          go = tiles[at - 1];
          break;
        case "ArrowDown":
          go = nearestInRow(tiles, tile, true);
          break;
        case "ArrowUp":
          go = nearestInRow(tiles, tile, false);
          break;
        case "Home":
          go = tiles[0];
          break;
        case "End":
          go = tiles[tiles.length - 1];
          break;
        case "Enter":
          event.preventDefault();
          this.#go(folder);
          this.#tiles.querySelector(".ContentBrowser__tile")?.focus();
          return;
        case " ":
          event.preventDefault();
          this.#pick(folder, event.ctrlKey || event.metaKey, event.shiftKey);
          return;
        default:
          return;
      }
      event.preventDefault();
      const next = go ? this.#tileFolder.get(go) : void 0;
      if (next) this.#pick(next, false, event.shiftKey);
    }
  };
  define("ue-content-browser", ContentBrowserElement);

  // design-system/src/ContentToolbar/ContentToolbar.ts
  var CHEVRON2 = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
  var PREFIX3 = "ContentToolbar";
  var CHILDREN = {
    All: ["Content", "Plugins"],
    Content: ["StarterContent", "Developers"],
    StarterContent: ["Architecture", "Audio", "Blueprints", "HDRI", "Maps", "Materials", "Particles", "Props", "Shapes", "Textures"]
  };
  var FALLBACK_CHILDREN = ["Architecture", "Audio", "Blueprints"];
  var ADD_ENTRIES2 = [
    { label: "Import to Current Folder" },
    { separator: true },
    { label: "New Folder" },
    { label: "Blueprint Class" },
    { label: "Level" },
    { label: "Material" }
  ];
  var SETTINGS_DEFAULTS2 = [
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
      this.#checks = new Map(SETTINGS_DEFAULTS2);
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
        this.#toggleMenu(button, ADD_ENTRIES2, () => void 0);
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
        prefix: PREFIX3,
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
        delim.innerHTML = CHEVRON2;
        path.append(crumb, delim);
      }
      if (hadFocus) this.all(".ContentToolbar__crumb")[focusAt]?.focus();
    }
  };
  define("ue-content-toolbar", ContentToolbarElement);

  // design-system/src/Cover/Cover.ts
  var TOKENS = {
    primary: "primary",
    panel: "panel",
    inactive: "select-inactive",
    folder: "accent-folder",
    green: "accent-green",
    header: "header"
  };
  var UeCoverElement = class extends UeElement {
    setup() {
      for (const strip of this.all("rect.tile")) {
        const token = Object.keys(TOKENS).find((name) => strip.classList.contains(name));
        if (!token || strip.querySelector("title")) continue;
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = TOKENS[token];
        strip.append(title);
      }
    }
  };
  define("ue-cover", UeCoverElement);

  // design-system/src/DetailsHeader/DetailsHeader.ts
  var UeDetailsHeader = class extends UeElement {
    setup() {
      const label = this.one(".DetailsHeader-label");
      if (label) this.wireLabel(label);
    }
    // Enter commits, Escape restores the text from before the edit. The instance row shows the committed name.
    wireLabel(label) {
      let before = label.textContent ?? "";
      this.on(label, "focus", () => {
        before = label.textContent ?? "";
      });
      this.on(label, "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          label.blur();
        } else if (event.key === "Escape") {
          label.textContent = before;
          label.blur();
        }
      });
      this.on(label, "blur", () => {
        const text = (label.textContent ?? "").trim();
        label.textContent = text === "" ? before : text;
        for (const name of this.all(".DetailsHeader-instance .name")) name.textContent = label.textContent;
      });
    }
  };
  define("ue-details-header", UeDetailsHeader);

  // design-system/src/TextInput/TextInput.ts
  var UeTextInputElement = class extends UeElement {
    setup() {
      const box = this.one(".textinput");
      const field = box?.querySelector(".textinput__field");
      if (!box || !field) throw new Error("ue-text-input needs a .textinput box with a .textinput__field input");
      const search = box.classList.contains("textinput--search");
      const sync = () => {
        if (search) box.classList.toggle("textinput--filled", field.value !== "");
      };
      const clear = () => {
        field.value = "";
        sync();
        field.focus();
        this.emit("ue-text-input", { value: "" });
        this.emit("ue-text-clear", {});
      };
      sync();
      this.on(field, "input", () => {
        sync();
        this.emit("ue-text-input", { value: field.value });
      });
      this.on(box, "click", (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest(".textinput__clear")) clear();
        else if (event.target !== field && !event.target.closest(".textinput__trail")) field.focus();
      });
      this.on(field, "keydown", (event) => {
        if (!search || event.key !== "Escape" || field.readOnly || field.value === "") return;
        event.preventDefault();
        clear();
      });
    }
  };
  define("ue-text-input", UeTextInputElement);

  // design-system/src/DetailsSearchRow/DetailsSearchRow.ts
  var UeDetailsSearchRow = class extends UeElement {
    setup() {
      this.on(this, "ue-text-input", (event) => {
        if (this.owns(event.target)) this.emit("ue-search", { text: event.detail.value });
      });
      this.on(this, "ue-button-click", (event) => {
        const star = this.owns(event.target) ? event.target.querySelector('[data-role="favorites"]') : null;
        if (!star) return;
        const on = event.detail.pressed === true;
        star.title = on ? "Toggle Favorites (on)" : "Toggle Favorites";
        this.emit("ue-favorites", { on });
      });
      this.on(this, "ue-combo-pick", (event) => {
        if (!this.owns(event.target)) return;
        const { value, checked } = event.detail;
        this.emit("ue-view-option", { option: value, checked: checked === true });
      });
    }
  };
  define("ue-details-search-row", UeDetailsSearchRow);

  // design-system/src/FilterPills/FilterPills.ts
  var CROSS2 = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  var UeFilterPills = class extends UeElement {
    #strip = null;
    setup() {
      const strip = this.all(".FilterPills-strip").find((candidate) => this.owns(candidate)) ?? this.#createStrip();
      this.#strip = strip;
      this.on(strip, "click", (event) => {
        if (!this.owns(event.target)) return;
        const target = event.target;
        const remove = target.closest(".FilterPills-chipRemove");
        const chip = remove?.closest(".FilterPills-chip");
        if (chip) {
          this.removeChip(this.#chipId(chip));
          return;
        }
        const pill = target.closest(".FilterPills-pill");
        if (pill && strip.contains(pill)) this.#select(pill, false);
      });
      this.on(strip, "keydown", (event) => {
        if (!this.owns(event.target)) return;
        const pills = this.#pills();
        const at = pills.indexOf(document.activeElement);
        if (at < 0) return;
        let next = -1;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % pills.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + pills.length) % pills.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = pills.length - 1;
        if (next < 0) return;
        event.preventDefault();
        this.#select(pills[next], true);
      });
      if (this.#pills().length > 0 && !strip.hasAttribute("role")) strip.setAttribute("role", "tablist");
      if (strip.classList.contains("FilterPills-strip--chips")) strip.setAttribute("role", "list");
    }
    #createStrip() {
      const strip = document.createElement("div");
      strip.className = "FilterPills-strip";
      this.append(strip);
      return strip;
    }
    #pills() {
      return Array.from(this.#strip?.querySelectorAll(".FilterPills-pill") ?? []);
    }
    #chips() {
      return Array.from(this.#strip?.querySelectorAll(".FilterPills-chip") ?? []);
    }
    #valueOf(pill) {
      return pill.dataset.value ?? (pill.textContent ?? "").trim();
    }
    #chipId(chip) {
      return chip.dataset.id ?? (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim();
    }
    // The value of the checked pill, or an empty string when no pill is checked.
    get value() {
      const checked = this.#pills().find((pill) => pill.classList.contains("is-checked"));
      return checked ? this.#valueOf(checked) : "";
    }
    // Checks the pill with this value. It fires ue-filter-change when that changes the checked pill.
    set value(value) {
      const pill = this.#pills().find((candidate) => this.#valueOf(candidate) === value);
      if (pill) this.#select(pill, false);
    }
    #select(pill, focus) {
      const changed = !pill.classList.contains("is-checked");
      for (const other of this.#pills()) {
        const on = other === pill;
        other.classList.toggle("is-checked", on);
        other.setAttribute("aria-selected", String(on));
        other.tabIndex = on ? 0 : -1;
      }
      if (focus) pill.focus();
      if (changed) this.emit("ue-filter-change", { value: this.#valueOf(pill), label: (pill.textContent ?? "").trim() });
    }
    // Replaces every pill. The first pill with checked set is checked; with none, no pill is checked.
    setPills(pills) {
      const strip = this.#strip;
      if (!strip) return;
      const drawn = pills.map((data) => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "FilterPills-pill" + (data.checked ? " is-checked" : "");
        pill.setAttribute("role", "tab");
        pill.setAttribute("aria-selected", String(data.checked === true));
        pill.dataset.value = data.value;
        pill.textContent = data.label;
        return pill;
      });
      strip.replaceChildren(...drawn);
      strip.setAttribute("role", "tablist");
      const stop = drawn.find((pill) => pill.classList.contains("is-checked")) ?? drawn[0];
      for (const pill of drawn) pill.tabIndex = pill === stop ? 0 : -1;
    }
    // The chips in order.
    getChips() {
      return this.#chips().map((chip) => ({ id: this.#chipId(chip), label: (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim(), color: chip.querySelector(".FilterPills-chipColor")?.style.background || void 0 }));
    }
    // Adds a removable chip at the end. An id that is already there is ignored.
    addChip(data) {
      const strip = this.#strip;
      if (!strip || this.#chips().some((chip2) => this.#chipId(chip2) === data.id)) return;
      strip.classList.add("FilterPills-strip--chips");
      strip.setAttribute("role", "list");
      const chip = document.createElement("span");
      chip.className = "FilterPills-chip";
      chip.setAttribute("role", "listitem");
      chip.dataset.id = data.id;
      chip.setAttribute("aria-label", "Filter: " + data.label);
      const color = document.createElement("span");
      color.className = "FilterPills-chipColor";
      if (data.color) color.style.background = data.color;
      const name = document.createElement("span");
      name.className = "FilterPills-chipName";
      name.textContent = data.label;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "FilterPills-chipRemove";
      remove.setAttribute("aria-label", "Remove " + data.label + " filter");
      remove.innerHTML = CROSS2;
      chip.append(color, name, remove);
      strip.append(chip);
      strip.hidden = false;
      this.emit("ue-pill-add", { id: data.id, label: data.label, color: data.color });
    }
    // Removes the chip with this id. It fires ue-pill-remove.
    removeChip(id) {
      const chip = this.#chips().find((candidate) => this.#chipId(candidate) === id);
      if (!chip) return;
      const detail = { id, label: (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim() };
      chip.remove();
      if (this.#strip && this.#chips().length === 0) this.#strip.hidden = true;
      this.emit("ue-pill-remove", detail);
    }
    // Replaces every chip. It fires ue-pill-add for each new chip and ue-pill-remove for each chip that was dropped.
    setChips(chips) {
      const wanted = new Set(chips.map((chip) => chip.id));
      for (const have of this.getChips()) if (!wanted.has(have.id)) this.removeChip(have.id);
      for (const chip of chips) this.addChip(chip);
    }
  };
  define("ue-filter-pills", UeFilterPills);

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

  // design-system/src/DetailsCategory/DetailsCategory.ts
  var isIn = (el, selector) => el.closest(selector);
  var isRow = (el) => el.classList.contains("DetailsCategory-row") || el.dataset.label !== void 0;
  var UeDetailsCategory = class extends UeElement {
    #query = "";
    #section = "";
    #onlyModified = false;
    setup() {
      const frame = this.one(".DetailsCategory-frame");
      if (!frame) return;
      this.#section = this.one(".FilterPills-pill.is-checked")?.dataset.value ?? "";
      this.wireFrame(frame);
      this.wireControls(frame);
      for (const row of this.all(".DetailsCategory-row")) this.syncReset(row);
      this.refresh(frame);
    }
    // The panel controls announce themselves with events. The tree only listens.
    wireControls(frame) {
      this.on(this, "ue-search", (event) => {
        this.#query = event.detail.text.trim().toLowerCase();
        this.refresh(frame);
      });
      this.on(this, "ue-filter-change", (event) => {
        this.#section = event.detail.value;
        this.refresh(frame);
      });
      this.on(this, "ue-view-option", (event) => {
        const { option, checked } = event.detail;
        if (option === "modified") this.#onlyModified = checked;
        else if (option === "collapseAll" || option === "expandAll") {
          for (const cat of this.all(".DetailsCategory-cat")) cat.classList.toggle("is-collapsed", option === "collapseAll");
        }
        this.refresh(frame);
      });
    }
    wireFrame(frame) {
      this.on(frame, "click", (event) => {
        const target = event.target;
        const catRow = isIn(target, ".DetailsCategory-catRow");
        const advRow = isIn(target, ".DetailsCategory-advRow");
        const arrow = isIn(target, ".DetailsCategory-rowArrow.has-children");
        if (catRow) catRow.closest(".DetailsCategory-cat")?.classList.toggle("is-collapsed");
        else if (advRow) advRow.closest(".DetailsCategory-adv")?.classList.toggle("is-open");
        else if (arrow) arrow.closest(".DetailsCategory-row")?.classList.toggle("is-collapsed");
        else return;
        this.refresh(frame);
      });
      this.on(frame, "keydown", (event) => {
        const target = event.target;
        const catRow = target.matches(".DetailsCategory-catRow") ? target.closest(".DetailsCategory-cat") : null;
        if (catRow && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault();
          catRow.classList.toggle("is-collapsed", event.key === "ArrowLeft");
          this.refresh(frame);
          return;
        }
        const activates = target.matches(".DetailsCategory-catRow, .DetailsCategory-advRow, .DetailsCategory-rowArrow");
        if (activates && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      });
      this.on(frame, "focusin", (event) => {
        const field = this.fieldOf(event.target);
        if (field) field.dataset.before = field.value;
      });
      this.on(frame, "keydown", (event) => {
        const field = this.fieldOf(event.target);
        if (!field) return;
        if (event.key === "Enter") field.blur();
        else if (event.key === "Escape") {
          field.value = field.dataset.before ?? "";
          this.touched(field);
          field.blur();
        } else return;
        event.preventDefault();
      });
      this.on(frame, "ue-text-input", (event) => this.touched(event.target));
      this.on(frame, "ue-spin-change", (event) => this.touched(event.target));
      this.on(frame, "ue-vector-change", () => this.refresh(frame));
      this.on(frame, "ue-asset-change", () => this.refresh(frame));
      this.on(frame, "ue-reset", (event) => {
        const row = isIn(event.target, ".DetailsCategory-row");
        if (!row) return;
        const def = row.dataset.default ?? "";
        const field = row.querySelector(".textinput__field");
        const spin = row.querySelector("ue-spin-box");
        if (field) field.value = def;
        else if (spin) spin.value = Number(def);
        this.syncReset(row);
        this.refresh(frame);
      });
    }
    // The text field of a row value, or null for any other target.
    fieldOf(target) {
      const el = target;
      const field = el instanceof HTMLInputElement && el.classList.contains("textinput__field") ? el : null;
      return field && isIn(field, ".DetailsCategory-row") ? field : null;
    }
    touched(target) {
      const row = isIn(target, ".DetailsCategory-row");
      const frame = row?.closest(".DetailsCategory-frame");
      if (!row || !frame) return;
      this.syncReset(row);
      this.refresh(frame);
    }
    valueOf(row) {
      const field = row.querySelector(".textinput__field");
      if (field) return field.value;
      return row.querySelector(".spinbox")?.dataset.value ?? null;
    }
    // The reset arrow shows only while the value differs from the row default.
    syncReset(row) {
      const reset = row.querySelector("ue-reset-to-default");
      const value = this.valueOf(row);
      if (!reset || value === null || row.dataset.default === void 0) return;
      reset.toggleAttribute("differs", value !== row.dataset.default);
    }
    // Recomputes which cats, rows and the Advanced bar show, and the arrow states.
    refresh(frame) {
      const query = this.#query;
      const searching = query !== "";
      const section = this.#section;
      const onlyModified = this.#onlyModified;
      const children = [];
      for (const child2 of Array.from(frame.children)) {
        if (child2.localName.startsWith("ue-")) children.push(...Array.from(child2.children));
        else children.push(child2);
      }
      const items = [];
      for (const el of children) {
        if (el.classList.contains("DetailsCategory-cat")) items.push({ el, kind: "cat", level: 0, matchesText: true, isModified: true });
        else if (el.classList.contains("DetailsCategory-adv")) items.push({ el, kind: "adv", level: 0, matchesText: true, isModified: true });
        else if (isRow(el)) {
          const label = (el.dataset.label ?? el.querySelector(".DetailsCategory-label")?.textContent ?? "").toLowerCase();
          items.push({
            el,
            kind: "row",
            level: el.querySelectorAll(":scope > .DetailsCategory-indent").length,
            matchesText: !searching || label.includes(query),
            isModified: !onlyModified || el.querySelector("ue-reset-to-default[differs]") !== null
          });
        }
      }
      const keep = items.map((item, i) => {
        if (item.kind !== "row") return true;
        let textOk = item.matchesText;
        let modOk = item.isModified;
        let want = item.level;
        for (let j = i - 1; j >= 0 && items[j].kind !== "cat" && want > 0; j--) {
          if (items[j].kind === "row" && items[j].level < want) {
            textOk = textOk || items[j].matchesText;
            want = items[j].level;
          }
        }
        for (let j = i + 1; j < items.length && items[j].kind === "row" && items[j].level > item.level; j++) {
          textOk = textOk || items[j].matchesText;
          modOk = modOk || items[j].isModified;
        }
        return textOk && modOk;
      });
      let anyCatShown = false;
      let cat = null;
      let catHidden = false;
      let catFolded = false;
      let catHasRows = false;
      let advOpen = true;
      let inAdv = false;
      const closed = [];
      const finishCat = () => {
        if (!cat) return;
        const empty = !catHasRows && (searching || onlyModified);
        cat.classList.toggle("is-hidden", catHidden || empty);
        if (!catHidden && !empty) anyCatShown = true;
      };
      items.forEach((item, i) => {
        const { el } = item;
        if (item.kind === "cat") {
          finishCat();
          cat = el;
          const own = el.dataset.section;
          catHidden = section !== "" && own !== void 0 && own !== section;
          catFolded = el.classList.contains("is-collapsed") && !searching;
          catHasRows = false;
          inAdv = false;
          closed.length = 0;
          el.querySelector(".DetailsCategory-catRow")?.setAttribute("aria-expanded", String(!catFolded));
        } else if (item.kind === "adv") {
          inAdv = true;
          advOpen = el.classList.contains("is-open") || searching;
          el.classList.toggle("is-hidden", catHidden || catFolded || searching);
          el.querySelector(".DetailsCategory-advRow")?.setAttribute("aria-expanded", String(advOpen));
        } else {
          closed.length = item.level;
          const parentClosed = !searching && closed.some(Boolean);
          const hidden = catHidden || catFolded || parentClosed || inAdv && !advOpen || !keep[i];
          el.classList.toggle("is-hidden", hidden);
          const toggle = el.querySelector(".DetailsCategory-rowArrow.has-children");
          const folded = toggle !== null && el.classList.contains("is-collapsed") && !searching;
          closed[item.level] = folded;
          toggle?.setAttribute("aria-expanded", String(!folded));
          if (!hidden) catHasRows = true;
        }
      });
      finishCat();
      frame.querySelector(".DetailsCategory-empty")?.classList.toggle("is-shown", !anyCatShown && (searching || section !== "" || onlyModified));
    }
  };
  define("ue-details-category", UeDetailsCategory);

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
      return Array.from(well?.children ?? []).filter((child2) => child2 instanceof HTMLElement && child2.classList.contains(this.names.tab));
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

  // design-system/src/DockTab/DockTab.ts
  var DockTabElement = class extends TabStackElement {
    names = {
      stack: "dockTab-stack",
      well: "dockTab-well",
      tab: "dockTab",
      label: "dockTab-label",
      close: "dockTab-close",
      reset: "dockTab-reset",
      foreground: "dockTab--foreground",
      active: "dockTab--active"
    };
  };
  define("ue-dock-tab", DockTabElement);

  // design-system/src/EventStatus/EventStatus.ts
  var UeEventStatusElement = class extends UeElement {
    setup() {
      const host = this.parentElement;
      const type = this.getAttribute("event");
      if (!host || !type) throw new Error("ue-event-status needs a parent element and an event attribute");
      const template = this.getAttribute("template") ?? "{value}";
      this.on(host, type, (event) => {
        const detail = event.detail ?? {};
        this.textContent = template.replace(/\{(\w+)\}/g, (_match, key) => String(detail[key] ?? ""));
      });
    }
  };
  define("ue-event-status", UeEventStatusElement);

  // design-system/src/ExpandableArea/ExpandableArea.ts
  var INTERACTIVE = 'button, a[href], input, select, textarea, label, [tabindex], [role="button"], [role="checkbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="menuitem"]';
  function isNestedControl(target, header) {
    for (let node = target; node && node !== header; node = node.parentElement) {
      if (node.localName.startsWith("ue-") || node.matches(INTERACTIVE)) return true;
    }
    return false;
  }
  var UeExpandableAreaElement = class extends UeElement {
    setup() {
      const header = this.one('.expandablearea__header[role="button"]');
      if (!header) throw new Error('ue-expandable-area needs a .expandablearea__header[role="button"]');
      this.#apply(header, header.getAttribute("aria-expanded") === "true", false);
      this.on(header, "click", (event) => {
        if (ownedBy(this, event.target) && !isNestedControl(event.target, header)) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
      });
      this.on(header, "keydown", (event) => {
        if (header !== event.target || event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!event.repeat) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
      });
    }
    #apply(header, expanded, announce) {
      header.setAttribute("aria-expanded", String(expanded));
      const body = header.parentElement?.querySelector(":scope > .expandablearea__body");
      if (body) body.hidden = !expanded;
      if (announce) this.emit("ue-expand-toggle", { expanded });
    }
  };
  define("ue-expandable-area", UeExpandableAreaElement);

  // design-system/src/HeaderRow/HeaderRow.ts
  var CELL = ".hr-cell";
  var SORTABLE = ".hr-cell[aria-sort]";
  var GRIP = ".hr-grip";
  var ARROW = ".hr-sort";
  var GLYPH = {
    up: "M2 8l4-5 4 5z",
    down: "M2 4l4 5 4-5z",
    up2: "M2 6.2l4-4 4 4zM2 10.5l4-4 4 4z",
    down2: "M2 1.5l4 4 4-4zM2 5.8l4 4 4-4z"
  };
  var SVG_NS = "http://www.w3.org/2000/svg";
  var MIN_WIDTH = 20;
  var KEY_STEP = 8;
  function modeOf(cell) {
    const value = cell.getAttribute("aria-sort");
    return value === "ascending" || value === "descending" ? value : "none";
  }
  function priorityOf(cell) {
    return cell.dataset.priority === "secondary" ? "secondary" : "primary";
  }
  function paint(cell, mode, priority) {
    cell.setAttribute("aria-sort", mode);
    cell.dataset.priority = priority;
    let arrow = cell.querySelector(ARROW);
    if (!arrow) {
      arrow = document.createElementNS(SVG_NS, "svg");
      arrow.setAttribute("class", "hr-sort");
      arrow.setAttribute("viewBox", "0 0 12 12");
      arrow.setAttribute("aria-hidden", "true");
      const grip = cell.querySelector(GRIP);
      if (grip) cell.insertBefore(arrow, grip);
      else cell.append(arrow);
    }
    let path = arrow.querySelector("path");
    if (!path) {
      path = document.createElementNS(SVG_NS, "path");
      arrow.append(path);
    }
    arrow.toggleAttribute("hidden", mode === "none");
    path.setAttribute("d", GLYPH[(mode === "descending" ? "down" : "up") + (priority === "secondary" ? "2" : "")]);
  }
  var HeaderRow = class extends UeElement {
    setup() {
      const sortable = () => this.all(SORTABLE).filter((cell) => this.owns(cell));
      for (const cell of sortable()) paint(cell, modeOf(cell), priorityOf(cell));
      const activate = (cell, shift) => {
        let mode = modeOf(cell);
        let priority = priorityOf(cell);
        if (mode === "none") {
          priority = shift ? "secondary" : "primary";
          mode = "ascending";
        } else {
          if (!shift && priority === "secondary") priority = "primary";
          mode = mode === "descending" ? "ascending" : "descending";
        }
        for (const other of sortable()) {
          if (other !== cell && modeOf(other) !== "none" && priorityOf(other) === priority) paint(other, "none", priority);
        }
        paint(cell, mode, priority);
        this.emit("ue-sort", { column: cell.dataset.column ?? "", mode, direction: mode, priority });
      };
      this.on(this, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target.closest(GRIP) || !this.owns(target)) return;
        const cell = target.closest(SORTABLE);
        if (cell && this.contains(cell)) activate(cell, event.shiftKey);
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.matches(SORTABLE) || !this.owns(target)) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate(target, event.shiftKey);
      });
      const grips = this.all(GRIP).filter((grip) => this.owns(grip));
      const resizable = this.getAttribute("grips") !== "off";
      for (const grip of grips) {
        grip.hidden = !resizable;
        if (resizable) this.#bindGrip(grip);
      }
    }
    #bindGrip(grip) {
      const left = grip.closest(CELL);
      const right = left?.nextElementSibling;
      const cells = left?.parentElement;
      if (!left || !(right instanceof HTMLElement) || !right.matches(CELL) || !cells) return;
      let startLeft = 0;
      let total = 0;
      const apply = (width) => {
        const clamped = Math.min(total - MIN_WIDTH, Math.max(MIN_WIDTH, width));
        left.style.flex = clamped + " 1 " + clamped + "px";
        right.style.flex = total - clamped + " 1 " + (total - clamped) + "px";
        grip.setAttribute("aria-valuenow", String(Math.round(clamped)));
        this.emit("ue-column-resize", { column: left.dataset.column ?? "", width: clamped, nextColumn: right.dataset.column ?? "", nextWidth: total - clamped });
      };
      const measure = () => {
        const flexible = Array.from(cells.children).filter((cell) => cell instanceof HTMLElement && cell.matches(CELL) && getComputedStyle(cell).flexGrow !== "0");
        const widths = flexible.map((cell) => cell.getBoundingClientRect().width);
        flexible.forEach((cell, i) => {
          cell.style.flex = widths[i] + " 1 " + widths[i] + "px";
        });
        startLeft = left.getBoundingClientRect().width;
        total = startLeft + right.getBoundingClientRect().width;
      };
      this.onDispose(drag(grip, {
        start: measure,
        move: (_event, dx) => apply(startLeft + dx)
      }));
      this.on(grip, "keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        measure();
        apply(startLeft + (event.key === "ArrowLeft" ? -KEY_STEP : KEY_STEP));
      });
      this.on(grip, "click", (event) => event.stopPropagation());
    }
  };
  define("ue-header-row", HeaderRow);

  // design-system/src/MenuBar/MenuBar.ts
  var ITEM = ".menuBar-item";
  var ROW2 = ".menuBar-row";
  var MENU = ".menuBar-menu";
  var MenuBar = class extends UeElement {
    setup() {
      const items = () => this.all(ITEM);
      const openItem = () => this.one(ITEM + ".is-open");
      const menuOf2 = (item) => {
        const menu = item.nextElementSibling;
        return menu instanceof HTMLElement && menu.matches(MENU) ? menu : null;
      };
      const itemOf = (menu) => {
        const item = menu.previousElementSibling;
        return item instanceof HTMLElement && item.matches(ITEM) ? item : null;
      };
      const setCurrent = (item) => {
        for (const other of items()) other.tabIndex = other === item ? 0 : -1;
      };
      const close = (restoreFocus) => {
        const item = openItem();
        if (!item) return;
        item.classList.remove("is-open");
        item.setAttribute("aria-expanded", "false");
        if (restoreFocus) item.focus();
      };
      const open = (item, rows) => {
        const menu = menuOf2(item);
        if (!menu) return;
        for (const other of items()) {
          if (other === item) continue;
          other.classList.remove("is-open");
          other.setAttribute("aria-expanded", "false");
        }
        item.classList.add("is-open");
        item.setAttribute("aria-expanded", "true");
        setCurrent(item);
        if (rows === "none") return;
        const list = enabledRows(menu, ROW2);
        if (list.length > 0) (rows === "first" ? list[0] : list[list.length - 1]).focus();
      };
      const step = (item, delta) => {
        const list = items();
        return list[(list.indexOf(item) + delta + list.length) % list.length];
      };
      this.on(this, "pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof Element) || event.button !== 0) return;
        const item = target.closest(ITEM);
        if (!item || !this.contains(item)) return;
        if (item.classList.contains("is-open")) close(false);
        else open(item, "none");
      });
      this.on(this, "pointerover", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const row = target.closest(ROW2);
        if (row) {
          if (row.getAttribute("aria-disabled") !== "true") row.focus({ preventScroll: true });
          return;
        }
        const item = target.closest(ITEM);
        if (item && openItem() && !item.classList.contains("is-open")) open(item, "none");
      });
      this.on(this, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const row = target.closest(ROW2);
        if (!row || row.getAttribute("aria-disabled") === "true") return;
        this.emit("ue-menu-select", { label: rowLabel(row, ".menuBar-label") });
        close(true);
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const key = event.key;
        const row = target.closest(ROW2);
        const item = row ? itemOf(row.closest(MENU) ?? row) : target.closest(ITEM);
        if (!item) return;
        if (key === "Escape") {
          if (!openItem()) return;
          event.preventDefault();
          close(true);
          return;
        }
        if (key === "Tab") {
          close(false);
          return;
        }
        if (key === "ArrowRight" || key === "ArrowLeft") {
          event.preventDefault();
          const next = step(item, key === "ArrowRight" ? 1 : -1);
          if (row) open(next, "first");
          else {
            next.focus();
            setCurrent(next);
            if (openItem()) open(next, "none");
          }
          return;
        }
        if (row) {
          if (moveRowFocus(enabledRows(row.closest(MENU) ?? row, ROW2), row, key)) event.preventDefault();
          else if (key === "Enter" || key === " ") {
            event.preventDefault();
            row.click();
          }
          return;
        }
        if (key === "ArrowDown" || key === "Enter" || key === " ") {
          event.preventDefault();
          open(item, "first");
        } else if (key === "ArrowUp") {
          event.preventDefault();
          open(item, "last");
        }
      });
      this.on(document, "pointerdown", (event) => {
        if (event.target instanceof Node && !this.contains(event.target)) close(false);
      });
    }
  };
  define("ue-menu-bar", MenuBar);

  // design-system/src/Notification/Notification.ts
  var UeNotificationElement = class extends UeElement {
    #shown = 0;
    setup() {
      this.on(this, "click", (event) => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest(".notification__btn");
        if (!button) return;
        switch (button.dataset.action) {
          case "dismiss":
            this.#dismiss(button.closest(".notification-slot"));
            break;
          case "retry":
            this.#retry(button);
            break;
          case "show":
            this.#show();
            break;
          default:
            break;
        }
      });
    }
    #dismiss(slot) {
      if (!slot || slot.classList.contains("notification-slot--closing")) return;
      slot.classList.add("notification-slot--closing");
      void Promise.all(slot.getAnimations().map((animation) => animation.finished.catch(() => void 0))).then(() => {
        slot.remove();
        this.emit("ue-notification-dismiss", {});
      });
    }
    #retry(button) {
      const sub = button.closest(".notification")?.querySelector(".notification__sub");
      if (!sub) return;
      const tries = Number(sub.getAttribute("data-tries") ?? "0") + 1;
      sub.setAttribute("data-tries", String(tries));
      sub.textContent = "Chair.fbx could not be read. Retried " + tries + (tries === 1 ? " time." : " times.");
    }
    #show() {
      const template = this.one(".notification-template");
      const stack = this.one(".notification-stack");
      if (!template || !stack) return;
      const slot = template.content.cloneNode(true);
      this.#shown++;
      if (slot instanceof DocumentFragment) {
        const title = slot.querySelector(".notification__title");
        if (title) title.textContent = "Saved " + this.#shown + (this.#shown === 1 ? " asset" : " assets");
      }
      stack.prepend(slot);
    }
  };
  define("ue-notification", UeNotificationElement);

  // design-system/src/PlaceActorsPanel/PlaceActorsPanel.ts
  var CAT = ".placeActors-cat";
  var GROUP = ".placeActors-group";
  var ROW3 = ".placeActors-row";
  var PlaceActorsPanel = class extends UeElement {
    setup() {
      const field = this.one(".placeActors-field");
      const header = this.one(".placeActors-header");
      const empty = this.one(".placeActors-empty");
      const cats = () => this.all(CAT);
      const applyFilter = () => {
        const query = (field?.value ?? "").trim().toLowerCase();
        const group = this.one(GROUP + ":not([hidden])");
        let visible = 0;
        if (group) {
          for (const row of Array.from(group.querySelectorAll(ROW3))) {
            const name = row.querySelector(".placeActors-name")?.textContent?.toLowerCase() ?? "";
            row.hidden = query !== "" && !name.includes(query);
            if (!row.hidden) visible++;
          }
        }
        if (empty instanceof HTMLElement) empty.hidden = !(query !== "" && visible === 0);
      };
      const select = (cat, focus) => {
        const name = cat.dataset.category ?? "";
        for (const other of cats()) {
          const active2 = other === cat;
          other.classList.toggle("is-active", active2);
          other.setAttribute("aria-checked", String(active2));
          other.tabIndex = active2 ? 0 : -1;
        }
        if (header) header.textContent = name;
        for (const group of this.all(GROUP)) group.hidden = group.dataset.category !== name;
        applyFilter();
        if (focus) cat.focus();
        this.emit("ue-category-change", { category: name });
      };
      const clear = () => {
        if (!field) return;
        field.value = "";
        applyFilter();
        field.focus();
      };
      this.on(this, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const cat = target.closest(CAT);
        if (cat && this.contains(cat)) {
          select(cat, false);
          return;
        }
        if (target.closest(".placeActors-clear")) clear();
      });
      this.on(this, "input", () => applyFilter());
      this.on(this, "dblclick", (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target.closest(".placeActors-info")) return;
        const row = target.closest(ROW3);
        if (row) this.emit("ue-place", { name: row.querySelector(".placeActors-name")?.textContent ?? "" });
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const key = event.key;
        if (target === field) {
          if (key === "Escape" && field.value !== "") {
            event.preventDefault();
            clear();
          }
          return;
        }
        if (target.matches(".placeActors-clear") && (key === "Enter" || key === " ")) {
          event.preventDefault();
          clear();
          return;
        }
        if (target.matches(ROW3) && key === "Enter") {
          event.preventDefault();
          this.emit("ue-place", { name: target.querySelector(".placeActors-name")?.textContent ?? "" });
          return;
        }
        if (!target.matches(CAT)) return;
        const list = cats();
        const index = list.indexOf(target);
        let next = -1;
        if (key === "ArrowRight" || key === "ArrowDown") next = (index + 1) % list.length;
        else if (key === "ArrowLeft" || key === "ArrowUp") next = (index - 1 + list.length) % list.length;
        else if (key === "Home") next = 0;
        else if (key === "End") next = list.length - 1;
        else if (key === "Enter" || key === " ") {
          event.preventDefault();
          select(target, false);
          return;
        }
        if (next < 0) return;
        event.preventDefault();
        select(list[next], true);
      });
      const active = cats().find((cat) => cat.classList.contains("is-active"));
      if (active) select(active, false);
    }
  };
  define("ue-place-actors-panel", PlaceActorsPanel);

  // design-system/src/_shared/tree-controller.ts
  var TreeController = class {
    root;
    parts;
    hooks;
    #anchor = null;
    constructor(root, parts, hooks = {}) {
      this.root = root;
      this.parts = parts;
      this.hooks = hooks;
    }
    rows() {
      return Array.from(this.root.querySelectorAll(this.parts.row));
    }
    shown() {
      return this.rows().filter((row) => !row.hidden);
    }
    selected() {
      return this.rows().filter((row) => this.isSelected(row));
    }
    level(row) {
      return parseInt(row.getAttribute("aria-level") ?? "1", 10) || 1;
    }
    isSelected(row) {
      return row.classList.contains("is-selected");
    }
    isOpen(row) {
      return row.getAttribute("aria-expanded") === "true";
    }
    hasChildren(row) {
      if (this.hooks.lazy?.(row)) return true;
      const next = row.nextElementSibling;
      return next instanceof HTMLElement && next.matches(this.parts.row) && this.level(next) > this.level(row);
    }
    // Redraws every derived state from facts per row: aria-level, aria-expanded and the is-selected class.
    refresh() {
      const rows = this.rows();
      const parents = /* @__PURE__ */ new Set();
      rows.forEach((row, index) => {
        if (!this.isSelected(row)) return;
        let want = this.level(row);
        for (let j = index - 1; j >= 0 && want > 1; j--) {
          if (this.level(rows[j]) < want) {
            parents.add(rows[j]);
            want = this.level(rows[j]);
          }
        }
      });
      const shown = [];
      let hideBelow = Infinity;
      rows.forEach((row, index) => {
        const level = this.level(row);
        if (level > hideBelow) {
          row.hidden = true;
          return;
        }
        hideBelow = Infinity;
        const kids = index + 1 < rows.length && this.level(rows[index + 1]) > level || (this.hooks.lazy?.(row) ?? false);
        const stored = kids && this.isOpen(row);
        const open = stored || kids && (this.hooks.forceOpen?.(row) ?? false);
        const arrow = row.querySelector(this.parts.arrow);
        arrow?.classList.toggle("is-leaf", !kids);
        if (kids) {
          row.setAttribute("aria-expanded", stored ? "true" : "false");
          this.#swap(arrow, open ? this.parts.caretOpen : this.parts.caretClosed);
          if (!open) hideBelow = level;
        } else {
          row.removeAttribute("aria-expanded");
        }
        if (this.parts.openClass) row.classList.toggle(this.parts.openClass, open);
        this.#swap(row.querySelector(this.parts.folder), open ? this.parts.folderOpen : this.parts.folderClosed);
        row.setAttribute("aria-selected", this.isSelected(row) ? "true" : "false");
        if (this.hooks.excluded?.(row)) {
          row.hidden = true;
          return;
        }
        row.hidden = false;
        row.classList.toggle("is-odd", shown.length % 2 === 1);
        row.classList.toggle("is-parent", parents.has(row) && !this.isSelected(row));
        shown.push(row);
      });
      const current = shown.find((row) => row.tabIndex === 0) ?? shown.find((row) => this.isSelected(row)) ?? shown[0];
      for (const row of rows) row.tabIndex = row === current ? 0 : -1;
      this.hooks.changed?.();
    }
    setSelection(list, anchor) {
      const set = new Set(list);
      for (const row of this.rows()) row.classList.toggle("is-selected", set.has(row));
      if (anchor) this.#anchor = anchor;
      this.refresh();
      this.hooks.selected?.(this.selected());
    }
    setOpen(row, open) {
      const was = this.isOpen(row);
      row.setAttribute("aria-expanded", open ? "true" : "false");
      this.refresh();
      if (was !== open) this.hooks.toggled?.(row, open);
    }
    focusRow(row, reveal) {
      for (const other of this.rows()) other.tabIndex = other === row ? 0 : -1;
      row.focus({ preventScroll: true });
      if (reveal) row.scrollIntoView({ block: "nearest" });
    }
    // Plain: replace the selection. Shift: range from the anchor. Ctrl or cmd: toggle the row.
    pick(row, given, reveal) {
      const mods = this.hooks.multi === false ? { shiftKey: false, ctrlKey: false, metaKey: false } : given;
      const chosen = this.selected();
      const toggle = mods.ctrlKey || mods.metaKey;
      if (mods.shiftKey) {
        const list = this.shown();
        const from = list.indexOf(this.#anchor ?? row);
        const to = list.indexOf(row);
        const a = from < 0 ? to : from;
        const span = list.slice(Math.min(a, to), Math.max(a, to) + 1);
        this.setSelection(toggle ? chosen.concat(span) : span, null);
      } else if (toggle) {
        this.setSelection(this.isSelected(row) ? chosen.filter((r) => r !== row) : chosen.concat(row), row);
      } else {
        this.setSelection([row], row);
      }
      this.focusRow(row, reveal);
    }
    rowOf(target) {
      if (!(target instanceof Element)) return null;
      const row = target.closest(this.parts.row);
      return row && this.root.contains(row) ? row : null;
    }
    // Returns true when the click was on a row.
    click(event) {
      const row = this.rowOf(event.target);
      if (!row) return false;
      const arrow = event.target.closest(this.parts.arrow);
      if (arrow && !arrow.classList.contains("is-leaf")) {
        this.setOpen(row, !this.isOpen(row));
        this.focusRow(row, false);
        return true;
      }
      this.pick(row, event, false);
      return true;
    }
    doubleClick(event) {
      const row = this.rowOf(event.target);
      if (!row || event.target.closest(this.parts.arrow) || !this.hasChildren(row)) return;
      this.setOpen(row, !this.isOpen(row));
    }
    // Returns true when the key was handled.
    keyDown(event) {
      const row = this.rowOf(event.target);
      if (!row || event.altKey) return false;
      const list = this.shown();
      const i = list.indexOf(row);
      const kids = this.hasChildren(row);
      let target = null;
      switch (event.key) {
        case "ArrowDown":
          target = list[Math.min(i + 1, list.length - 1)];
          break;
        case "ArrowUp":
          target = list[Math.max(i - 1, 0)];
          break;
        case "Home":
          target = list[0];
          break;
        case "End":
          target = list[list.length - 1];
          break;
        case "ArrowLeft":
          if (kids && this.isOpen(row)) {
            this.setOpen(row, false);
          } else {
            for (let j = i - 1; j >= 0; j--) {
              if (this.level(list[j]) < this.level(row)) {
                target = list[j];
                break;
              }
            }
          }
          break;
        case "ArrowRight":
          if (kids && !this.isOpen(row)) this.setOpen(row, true);
          else if (kids) target = list[i + 1];
          break;
        case " ":
        case "Enter":
          this.pick(row, event, true);
          break;
        default:
          return false;
      }
      event.preventDefault();
      if (target) this.pick(target, { shiftKey: event.shiftKey, ctrlKey: false, metaKey: false }, true);
      return true;
    }
    #swap(svg, symbol) {
      const use = svg?.querySelector("use");
      if (use) use.setAttribute("href", "#" + symbol);
    }
  };

  // design-system/src/_shared/scroll-thumb.ts
  var MIN_THUMB = 35;
  var BAR_PADDING = 2;
  function thumbLayout(slot, viewport, content, offset) {
    const track = slot - 2 * BAR_PADDING;
    const biased = track - MIN_THUMB;
    const needed = content > viewport + 0.5 && biased > 0;
    if (!needed) return { needed: false, start: BAR_PADDING, size: 0 };
    return {
      needed,
      start: BAR_PADDING + biased * (offset / content),
      size: MIN_THUMB + biased * (viewport / content)
    };
  }
  function offsetForPointer(pointer, grab, slot, content) {
    const biased = slot - 2 * BAR_PADDING - MIN_THUMB;
    const fraction = Math.min(1, Math.max(0, (pointer - BAR_PADDING - grab) / biased));
    return fraction * content;
  }
  function bindBar(view, bar, thumb, vertical, onFits) {
    const slotLength = () => vertical ? bar.clientHeight : bar.clientWidth;
    const viewport = () => vertical ? view.clientHeight : view.clientWidth;
    const content = () => vertical ? view.scrollHeight : view.scrollWidth;
    const offset = () => vertical ? view.scrollTop : view.scrollLeft;
    const scrollTo = (value) => {
      const max = content() - viewport();
      const clamped = Math.min(max, Math.max(0, value));
      if (vertical) view.scrollTop = clamped;
      else view.scrollLeft = clamped;
    };
    const pointerIn = (event) => {
      const box = bar.getBoundingClientRect();
      return vertical ? event.clientY - box.top : event.clientX - box.left;
    };
    const update = () => {
      const fits = !(content() > viewport() + 0.5);
      if (bar.hidden !== fits) {
        bar.hidden = fits;
        onFits?.(fits);
      }
      if (fits) return;
      const layout = thumbLayout(slotLength(), viewport(), content(), offset());
      thumb.style.display = layout.needed ? "" : "none";
      if (!layout.needed) return;
      if (vertical) {
        thumb.style.top = layout.start + "px";
        thumb.style.height = layout.size + "px";
      } else {
        thumb.style.left = layout.start + "px";
        thumb.style.width = layout.size + "px";
      }
    };
    let grab = 0;
    const stopDrag = drag(bar, {
      start: (event) => {
        const box = thumb.getBoundingClientRect();
        const thumbStart = vertical ? box.top : box.left;
        const pointer = vertical ? event.clientY : event.clientX;
        const onThumb = thumb.style.display !== "none" && pointer >= thumbStart && pointer <= thumbStart + (vertical ? box.height : box.width);
        bar.classList.add("is-drag");
        if (thumb.style.display === "none") return;
        grab = onThumb ? pointer - thumbStart : (vertical ? box.height : box.width) / 2;
        if (!onThumb) scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content()));
      },
      move: (event) => scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content())),
      end: () => bar.classList.remove("is-drag")
    });
    const onScroll = () => update();
    const onWheel = (event) => {
      event.preventDefault();
      view.scrollBy(vertical ? { top: event.deltaY } : { left: event.deltaX || event.deltaY });
    };
    view.addEventListener("scroll", onScroll);
    bar.addEventListener("wheel", onWheel, { passive: false });
    const observer = new ResizeObserver(update);
    observer.observe(view);
    observer.observe(bar);
    for (const child2 of Array.from(view.children)) observer.observe(child2);
    const mutations = new MutationObserver((records) => {
      for (const record of records) for (const added of Array.from(record.addedNodes)) if (added instanceof Element) observer.observe(added);
      update();
    });
    mutations.observe(view, { childList: true });
    update();
    return {
      update,
      dispose: () => {
        stopDrag();
        view.removeEventListener("scroll", onScroll);
        bar.removeEventListener("wheel", onWheel);
        observer.disconnect();
        mutations.disconnect();
      }
    };
  }

  // design-system/src/SceneOutliner/SceneOutliner.ts
  var ROW4 = ".so-row";
  var SORTABLE2 = ".so-hcell[aria-sort]";
  var collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
  var SceneOutliner = class extends UeElement {
    setup() {
      const rowsEl = this.one(".so-rows");
      const input = this.one(".so-input");
      const clear = this.one(".so-clear");
      const status = this.one(".so-status");
      const bar = this.one(".so-sb");
      const thumb = this.one(".so-thumb");
      const hcells = this.one(".so-hcells");
      const spacer = this.one(".so-hspacer");
      if (!rowsEl || !input || !clear || !status || !bar || !thumb) return;
      const text = (row, selector) => row.querySelector(selector)?.textContent?.trim() ?? "";
      const label = (row) => text(row, ".so-text");
      const kind = (row) => text(row, ".so-type");
      const isActor = (row) => kind(row) !== "Folder" && kind(row) !== "World";
      let keep = null;
      let saved = null;
      const updateStatus = () => {
        const actors = controller.rows().filter(isActor);
        const total = actors.length;
        const selected = actors.filter((row) => controller.isSelected(row)).length;
        const suffix = selected > 0 ? " (" + selected + " selected)" : "";
        status.classList.remove("is-match", "is-none");
        if (!keep) {
          status.textContent = total + " actors" + suffix;
          return;
        }
        const shown = actors.filter((row) => keep?.has(row)).length;
        status.classList.add(shown === 0 ? "is-none" : "is-match");
        if (shown === 0) status.textContent = "No matching actors (" + total + " total)";
        else if (shown === total) status.textContent = total + " actors" + suffix;
        else status.textContent = "Showing " + shown + " of " + total + " actors" + suffix;
      };
      const binding = bindBar(rowsEl, bar, thumb, true, (fits) => {
        if (spacer) spacer.hidden = fits;
        hcells?.classList.toggle("is-no-bar", fits);
      });
      this.onDispose(binding.dispose);
      const controller = new TreeController(rowsEl, {
        row: ROW4,
        arrow: ".so-arrow",
        folder: ".so-ico.is-folder",
        caretOpen: "so-caret-down",
        caretClosed: "so-caret-right",
        folderOpen: "so-folder-open",
        folderClosed: "so-folder"
      }, {
        excluded: (row) => keep !== null && !keep.has(row),
        changed: () => {
          updateStatus();
          binding.update();
        }
      });
      const applyFilter = () => {
        const needle = input.value.trim().toLowerCase();
        clear.hidden = input.value === "";
        if (needle === "") {
          if (saved) {
            for (const [row, value] of saved) {
              if (value === null) row.removeAttribute("aria-expanded");
              else row.setAttribute("aria-expanded", value);
            }
          }
          keep = null;
          saved = null;
          controller.refresh();
          return;
        }
        const rows = controller.rows();
        saved ??= new Map(rows.map((row) => [row, row.getAttribute("aria-expanded")]));
        const next = /* @__PURE__ */ new Set();
        rows.forEach((row, index) => {
          if (!label(row).toLowerCase().includes(needle)) return;
          next.add(row);
          let want = controller.level(row);
          for (let j = index - 1; j >= 0 && want > 1; j--) {
            if (controller.level(rows[j]) < want) {
              next.add(rows[j]);
              rows[j].setAttribute("aria-expanded", "true");
              want = controller.level(rows[j]);
            }
          }
        });
        keep = next;
        controller.refresh();
      };
      const sortRows = (column, mode) => {
        const rows = controller.rows();
        const roots = [];
        const stack = [];
        for (const row of rows) {
          const node = { row, kids: [] };
          const level = controller.level(row);
          stack.length = level - 1;
          (stack[level - 2]?.kids ?? roots).push(node);
          stack[level - 1] = node;
        }
        const dir = mode === "descending" ? -1 : 1;
        const compare = (a, b) => {
          if (column === "type") return dir * collator.compare(kind(a.row), kind(b.row));
          const byKind = Number(isActor(a.row)) - Number(isActor(b.row));
          return dir * (byKind || collator.compare(label(a.row), label(b.row)));
        };
        const flat = [];
        const walk = (list) => {
          list.sort(compare);
          for (const node of list) {
            flat.push(node.row);
            walk(node.kids);
          }
        };
        walk(roots);
        rowsEl.append(...flat);
        controller.refresh();
      };
      const paintHeader = (cell, mode) => {
        cell.setAttribute("aria-sort", mode);
        const arrow = cell.querySelector(".so-sort");
        if (!arrow) return;
        arrow.toggleAttribute("hidden", mode === "none");
        arrow.querySelector("use")?.setAttribute("href", mode === "descending" ? "#so-down" : "#so-up");
      };
      const modeOf2 = (cell) => {
        const value = cell.getAttribute("aria-sort");
        return value === "ascending" || value === "descending" ? value : "none";
      };
      const cells = () => this.all(SORTABLE2);
      const activate = (cell) => {
        const mode = modeOf2(cell) === "ascending" ? "descending" : "ascending";
        for (const other of cells()) paintHeader(other, other === cell ? mode : "none");
        sortRows(cell.dataset.column ?? "label", mode);
      };
      this.on(this, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const cell = target.closest(SORTABLE2);
        if (cell && this.contains(cell)) {
          activate(cell);
          return;
        }
        if (target.closest(".so-clear")) {
          input.value = "";
          applyFilter();
          input.focus();
        }
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.matches(SORTABLE2)) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate(target);
      });
      this.on(input, "input", applyFilter);
      this.on(input, "keydown", (event) => {
        if (event.key === "Escape" && input.value !== "") {
          event.preventDefault();
          input.value = "";
          applyFilter();
        } else if (event.key === "ArrowDown") {
          const current = controller.shown().find((row) => row.tabIndex === 0) ?? controller.shown()[0];
          if (!current) return;
          event.preventDefault();
          controller.focusRow(current, true);
        }
      });
      const toggleEye = (row) => {
        const rows = controller.rows();
        const start = rows.indexOf(row);
        const hide = !row.querySelector(".so-eye")?.classList.contains("is-off");
        const level = controller.level(row);
        for (let i = start; i < rows.length && (i === start || controller.level(rows[i]) > level); i++) {
          const eye = rows[i].querySelector(".so-eye");
          if (!eye) continue;
          eye.classList.toggle("is-off", hide);
          eye.querySelector("use")?.setAttribute("href", hide ? "#so-eye-off" : "#so-eye");
        }
      };
      this.on(rowsEl, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const row = controller.rowOf(target);
        if (row && target.closest(".so-gutter")) {
          toggleEye(row);
          return;
        }
        controller.click(event);
      });
      this.on(rowsEl, "dblclick", (event) => controller.doubleClick(event));
      this.on(rowsEl, "keydown", (event) => {
        controller.keyDown(event);
      });
      const sorted = cells().find((cell) => modeOf2(cell) !== "none");
      for (const cell of cells()) paintHeader(cell, modeOf2(cell));
      if (sorted) sortRows(sorted.dataset.column ?? "label", modeOf2(sorted));
      else controller.refresh();
    }
  };
  define("ue-scene-outliner", SceneOutliner);

  // design-system/src/Scrollbar/Scrollbar.ts
  var Scrollbar = class extends UeElement {
    #visible = null;
    // True while the content overflows and the bar shows.
    get visible() {
      return this.#visible === true;
    }
    setup() {
      const box = this.all(".sb-scroll").find((candidate) => this.owns(candidate));
      const view = box?.querySelector(":scope > .sb-view");
      const bar = box?.querySelector(":scope > .sb");
      const thumb = bar?.querySelector(".sb-thumb");
      if (!view || !bar || !thumb) throw new Error("ue-scrollbar needs a .sb-scroll with a .sb-view and a .sb bar that holds a .sb-thumb");
      const vertical = !bar.classList.contains("sb-h");
      this.#visible = null;
      let started = false;
      const binding = bindBar(view, bar, thumb, vertical, (fits) => {
        if (started) this.#report(!fits);
      });
      this.onDispose(binding.dispose);
      const first = setTimeout(() => {
        started = true;
        this.#report(!bar.hidden);
      }, 0);
      this.onDispose(() => clearTimeout(first));
    }
    // Announces the first state and every change.
    #report(visible) {
      if (this.#visible === visible) return;
      this.#visible = visible;
      this.emit("ue-scrollbar-visibility", { visible });
    }
  };
  define("ue-scrollbar", Scrollbar);

  // design-system/src/SegmentedControl/SegmentedControl.ts
  var UeSegmentedControl = class extends UeElement {
    #group = null;
    setup() {
      const group = this.all(".SegmentedControl").find((candidate) => this.owns(candidate));
      if (!group) throw new Error("ue-segmented-control needs a .SegmentedControl radiogroup");
      this.#group = group;
      group.setAttribute("role", "radiogroup");
      this.on(group, "click", (event) => {
        if (!this.owns(event.target)) return;
        const seg = event.target.closest(".SegmentedControl-seg");
        if (seg && group.contains(seg)) this.#select(seg, false);
      });
      this.on(group, "keydown", (event) => {
        if (!this.owns(event.target)) return;
        const segs = this.#segs();
        const at = segs.indexOf(document.activeElement);
        if (at < 0) return;
        let next = -1;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(at + 1, segs.length - 1);
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(at - 1, 0);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = segs.length - 1;
        if (next < 0) return;
        event.preventDefault();
        this.#select(segs[next], true);
      });
    }
    #segs() {
      return Array.from(this.#group?.querySelectorAll(".SegmentedControl-seg") ?? []);
    }
    // A segment is named by data-value, else aria-label, else its text.
    #valueOf(seg) {
      return seg.dataset.value ?? seg.getAttribute("aria-label") ?? (seg.textContent ?? "").trim();
    }
    #labelOf(seg) {
      return seg.getAttribute("aria-label") ?? (seg.textContent ?? "").trim();
    }
    // The value of the checked segment.
    get value() {
      const checked = this.#segs().find((seg) => seg.classList.contains("is-checked"));
      return checked ? this.#valueOf(checked) : "";
    }
    // Checks the segment with this value. It fires ue-segment-change when that changes the checked segment.
    set value(value) {
      const seg = this.#segs().find((candidate) => this.#valueOf(candidate) === value);
      if (seg) this.#select(seg, false);
    }
    #select(seg, focus) {
      const changed = !seg.classList.contains("is-checked");
      for (const other of this.#segs()) {
        const on = other === seg;
        other.classList.toggle("is-checked", on);
        other.setAttribute("aria-checked", String(on));
        other.tabIndex = on ? 0 : -1;
      }
      if (focus) seg.focus();
      if (changed) this.emit("ue-segment-change", { value: this.#valueOf(seg), label: this.#labelOf(seg) });
    }
  };
  define("ue-segmented-control", UeSegmentedControl);

  // design-system/src/Slider/Slider.ts
  var HANDLE = 8;
  function attr(el, name, fallback) {
    const raw = el.dataset[name];
    const value = raw === void 0 ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }
  var UeSliderElement = class extends UeElement {
    #dragging = /* @__PURE__ */ new WeakSet();
    setup() {
      const slider = this.one('.slider[role="slider"]');
      if (!slider) throw new Error('ue-slider needs a .slider[role="slider"] element');
      this.#render(slider);
      this.on(slider, "pointerdown", (event) => {
        if (event.button !== 0 || slider.getAttribute("aria-disabled") === "true") return;
        slider.setPointerCapture(event.pointerId);
        this.#dragging.add(slider);
        slider.focus();
        this.#fromPointer(slider, event.clientX);
        event.preventDefault();
      });
      this.on(slider, "pointermove", (event) => {
        if (this.#dragging.has(slider)) this.#fromPointer(slider, event.clientX);
      });
      const release = (event) => {
        this.#dragging.delete(slider);
        if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
      };
      this.on(slider, "pointerup", release);
      this.on(slider, "pointercancel", release);
      this.on(slider, "keydown", (event) => {
        if (slider.getAttribute("aria-disabled") === "true") return;
        const min = attr(slider, "min", 0);
        const max = attr(slider, "max", 1);
        const step = attr(slider, "step", (max - min) / 100);
        const value = attr(slider, "value", min);
        let next;
        switch (event.key) {
          case "ArrowRight":
          case "ArrowUp":
            next = value + step;
            break;
          case "ArrowLeft":
          case "ArrowDown":
            next = value - step;
            break;
          case "PageUp":
            next = value + step * 10;
            break;
          case "PageDown":
            next = value - step * 10;
            break;
          case "Home":
            next = min;
            break;
          case "End":
            next = max;
            break;
          default:
            return;
        }
        event.preventDefault();
        this.#set(slider, next);
      });
    }
    // The thumb centre runs from HANDLE to width minus HANDLE, SSlider.cpp:84-91.
    #fromPointer(slider, clientX) {
      const rect = slider.getBoundingClientRect();
      const travel = rect.width - 2 * HANDLE;
      const fraction = travel <= 0 ? 0 : (clientX - rect.left - HANDLE) / travel;
      const min = attr(slider, "min", 0);
      const max = attr(slider, "max", 1);
      this.#set(slider, min + Math.min(1, Math.max(0, fraction)) * (max - min));
    }
    #set(slider, raw) {
      const min = attr(slider, "min", 0);
      const max = attr(slider, "max", 1);
      const step = attr(slider, "step", 0);
      let value = Math.min(max, Math.max(min, raw));
      if (step > 0) value = Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
      value = Math.round(value * 1e6) / 1e6;
      const changed = value !== attr(slider, "value", min);
      slider.dataset.value = String(value);
      this.#render(slider);
      if (changed) this.emit("ue-slider-change", { value, text: step > 0 && step < 1 ? value.toFixed(2) : String(value) });
    }
    #render(slider) {
      const min = attr(slider, "min", 0);
      const max = attr(slider, "max", 1);
      const value = attr(slider, "value", min);
      slider.setAttribute("aria-valuemin", String(min));
      slider.setAttribute("aria-valuemax", String(max));
      slider.setAttribute("aria-valuenow", String(value));
      slider.style.setProperty("--slider-value", String(max === min ? 0 : (value - min) / (max - min)));
    }
  };
  define("ue-slider", UeSliderElement);

  // design-system/src/SourcePanel/SourcePanel.ts
  var ROW5 = ".SourcePanel__row";
  var SELECTED2 = "SourcePanel__row--selected";
  var PARENT = "SourcePanel__row--parent";
  var INDENT_PX2 = 10;
  var SourcePanelElement = class extends UeElement {
    #root;
    setup() {
      const root = this.one(".SourcePanel");
      if (!root) throw new Error("ue-source-panel needs a .SourcePanel child");
      this.#root = root;
      root.setAttribute("role", "group");
      for (const title of this.all(".SourcePanel__title")) {
        const area = title.closest(".SourcePanel__area");
        const body = area?.querySelector(".SourcePanel__body");
        title.setAttribute("role", "button");
        title.tabIndex = 0;
        title.setAttribute("aria-expanded", String(body ? !body.hidden : false));
      }
      for (const control of this.all(".SourcePanel__tool, .SourcePanel__add")) {
        control.setAttribute("role", "button");
        control.tabIndex = 0;
        if (control.classList.contains("SourcePanel__tool")) control.setAttribute("aria-pressed", "false");
      }
      for (const tree of this.all(".SourcePanel__tree")) this.#initTree(tree);
      this.on(root, "click", (event) => this.#click(event));
      this.on(root, "dblclick", (event) => this.#doubleClick(event));
      this.on(root, "keydown", (event) => this.#keydown(event));
    }
    #rows(tree) {
      return Array.from(tree.querySelectorAll(ROW5));
    }
    #visible(tree) {
      return this.#rows(tree).filter((row) => !row.hidden);
    }
    #depth(row) {
      const indent = row.querySelector(".SourcePanel__indent");
      const px = indent ? parseFloat(indent.style.width) : 0;
      return Math.round((Number.isNaN(px) ? 0 : px) / INDENT_PX2);
    }
    #hasKids(row) {
      return row.querySelector(".SourcePanel__exp svg") !== null;
    }
    #isOpen(row) {
      return row.getAttribute("aria-expanded") === "true";
    }
    #treeOf(row) {
      return row.closest(".SourcePanel__tree");
    }
    #initTree(tree) {
      tree.setAttribute("role", "tree");
      for (const row of this.#rows(tree)) {
        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-level", String(this.#depth(row) + 1));
        row.setAttribute("aria-selected", String(row.classList.contains(SELECTED2)));
        if (this.#hasKids(row)) {
          const href = row.querySelector(".SourcePanel__exp use")?.getAttribute("href") ?? "";
          row.setAttribute("aria-expanded", String(/caret-d$/.test(href)));
        }
      }
      this.#rove(tree);
    }
    // Exactly one row per tree takes the Tab stop: the selected row, else the first visible row.
    #rove(tree) {
      const visible = this.#visible(tree);
      const stop = visible.find((row) => row.classList.contains(SELECTED2)) ?? visible[0];
      for (const row of this.#rows(tree)) row.tabIndex = row === stop ? 0 : -1;
    }
    #swap(element, from, to) {
      const use = element?.querySelector("use");
      const href = use?.getAttribute("href");
      if (use && href) use.setAttribute("href", href.replace(from, to));
    }
    #select(row, focus) {
      for (const other of this.all(ROW5)) {
        other.classList.remove(SELECTED2, PARENT);
        other.setAttribute("aria-selected", "false");
      }
      row.classList.add(SELECTED2);
      row.setAttribute("aria-selected", "true");
      const tree = this.#treeOf(row);
      if (tree) {
        const rows = this.#rows(tree);
        let level = this.#depth(row);
        for (let i = rows.indexOf(row) - 1; i >= 0 && level > 0; i--) {
          const depth = this.#depth(rows[i]);
          if (depth < level) {
            rows[i].classList.add(PARENT);
            level = depth;
          }
        }
      }
      for (const each of this.all(".SourcePanel__tree")) this.#rove(each);
      if (focus) row.focus();
      const name = row.querySelector(".SourcePanel__name")?.textContent ?? "";
      this.emit("sourcepanel:select", { name });
    }
    #setOpen(row, open) {
      const tree = this.#treeOf(row);
      if (!tree || !this.#hasKids(row) || this.#isOpen(row) === open) return;
      row.setAttribute("aria-expanded", String(open));
      this.#swap(row.querySelector(".SourcePanel__exp"), /caret-[rd]$/, open ? "caret-d" : "caret-r");
      this.#swap(row.querySelector(".SourcePanel__folder"), /-f[oc]$/, open ? "-fo" : "-fc");
      const rows = this.#rows(tree);
      const depth = this.#depth(row);
      let skipBelow = null;
      let selectedHidden = false;
      for (let i = rows.indexOf(row) + 1; i < rows.length; i++) {
        const child2 = rows[i];
        const childDepth = this.#depth(child2);
        if (childDepth <= depth) break;
        if (skipBelow !== null && childDepth > skipBelow) {
          child2.hidden = true;
          continue;
        }
        skipBelow = null;
        child2.hidden = !open;
        if (!open && child2.classList.contains(SELECTED2)) selectedHidden = true;
        if (open && this.#hasKids(child2) && !this.#isOpen(child2)) skipBelow = childDepth;
      }
      if (!open && !selectedHidden) selectedHidden = rows.some((each) => each.hidden && each.classList.contains(SELECTED2));
      if (selectedHidden) this.#select(row, true);
      else this.#rove(tree);
    }
    #setSection(area, open) {
      const body = area.querySelector(".SourcePanel__body");
      const title = area.querySelector(".SourcePanel__title");
      if (!body) return;
      body.hidden = !open;
      title?.setAttribute("aria-expanded", String(open));
      this.#swap(area.querySelector(".SourcePanel__header .SourcePanel__arrow"), /caret-[rd]$/, open ? "caret-d" : "caret-r");
    }
    #click(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const tool = target.closest(".SourcePanel__tool");
      if (tool) {
        tool.setAttribute("aria-pressed", String(tool.getAttribute("aria-pressed") !== "true"));
        return;
      }
      if (target.closest(".SourcePanel__add")) {
        this.#addCollection(target.closest(".SourcePanel__area"));
        return;
      }
      const header = target.closest(".SourcePanel__header");
      if (header) {
        const area = header.closest(".SourcePanel__area");
        const body = area?.querySelector(".SourcePanel__body");
        if (area && body) this.#setSection(area, body.hidden);
        return;
      }
      const row = target.closest(ROW5);
      if (!row) return;
      if (target.closest(".SourcePanel__exp")) {
        this.#setOpen(row, !this.#isOpen(row));
        return;
      }
      this.#select(row, true);
    }
    #doubleClick(event) {
      const row = event.target instanceof Element ? event.target.closest(ROW5) : null;
      if (row && !event.target.closest(".SourcePanel__exp")) this.#setOpen(row, !this.#isOpen(row));
    }
    #addCollection(area) {
      const tree = area?.querySelector(".SourcePanel__tree");
      if (!area || !tree) return;
      this.#setSection(area, true);
      const rows = this.#rows(tree);
      const row = document.createElement("div");
      row.className = "SourcePanel__row" + (rows.length === 0 ? " SourcePanel__row--root" : "");
      row.innerHTML = '<span class="SourcePanel__indent" style="width:0"></span><span class="SourcePanel__exp"></span><svg class="SourcePanel__folder"><use href="#sp-fc"/></svg><span class="SourcePanel__name"></span>';
      const name = row.querySelector(".SourcePanel__name");
      if (name) name.textContent = "NewCollection" + (rows.length + 1);
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-level", "1");
      row.setAttribute("aria-selected", "false");
      tree.append(row);
      this.#select(row, true);
    }
    #keydown(event) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const activate = event.key === "Enter" || event.key === " ";
      if (activate && target.matches(".SourcePanel__title, .SourcePanel__tool, .SourcePanel__add")) {
        event.preventDefault();
        target.click();
        return;
      }
      if (!target.matches(ROW5)) return;
      const tree = this.#treeOf(target);
      if (!tree) return;
      const visible = this.#visible(tree);
      const at = visible.indexOf(target);
      const depth = this.#depth(target);
      let go;
      switch (event.key) {
        case "ArrowDown":
          go = visible[at + 1];
          break;
        case "ArrowUp":
          go = visible[at - 1];
          break;
        case "Home":
          go = visible[0];
          break;
        case "End":
          go = visible[visible.length - 1];
          break;
        case "ArrowRight":
          if (this.#hasKids(target) && !this.#isOpen(target)) this.#setOpen(target, true);
          else if (this.#isOpen(target)) go = visible[at + 1];
          break;
        case "ArrowLeft":
          if (this.#isOpen(target)) this.#setOpen(target, false);
          else go = visible.slice(0, at).reverse().find((row) => this.#depth(row) < depth);
          break;
        case "Enter":
        case " ":
          go = target;
          break;
        default:
          return;
      }
      event.preventDefault();
      if (go) this.#select(go, true);
    }
  };
  define("ue-source-panel", SourcePanelElement);

  // design-system/src/Splitter/Splitter.ts
  var DEFAULT_MIN = 20;
  var DEFAULT_STEP = 5;
  var DEFAULT_STEP_LARGE = 20;
  var HIGHLIGHT = "splitter-handle--highlight";
  function panesOf(handle) {
    const before = handle.previousElementSibling;
    const after = handle.nextElementSibling;
    if (!(before instanceof HTMLElement) || !(after instanceof HTMLElement) || !handle.parentElement) return null;
    return { before, after, vertical: getComputedStyle(handle.parentElement).flexDirection === "column" };
  }
  var extent = (pane, vertical) => pane.getBoundingClientRect()[vertical ? "height" : "width"];
  var SplitterElement = class extends UeElement {
    setup() {
      const handle = this.all(".splitter-handle").find((candidate) => this.owns(candidate));
      if (!handle) throw new Error("ue-splitter needs a .splitter-handle between two panes");
      this.#wire(handle);
    }
    // A number attribute of this element, or the fallback when it is missing or not a number.
    #number(name, fallback) {
      const value = Number(this.getAttribute(name));
      return this.hasAttribute(name) && Number.isFinite(value) ? value : fallback;
    }
    #wire(handle) {
      let startSize = 0;
      let total = 0;
      const minStart = () => this.#number("data-min-start", DEFAULT_MIN);
      const minEnd = () => this.#number("data-min-end", DEFAULT_MIN);
      const resize = (size) => {
        const panes2 = panesOf(handle);
        if (!panes2) return;
        const clamped = Math.min(Math.max(size, minStart()), total - minEnd());
        panes2.before.style.flex = "0 0 " + clamped + "px";
        panes2.after.style.flex = "1 1 0";
        this.#publish(handle, panes2);
        this.emit("ue-splitter-resize", { size: clamped, total, orientation: panes2.vertical ? "vertical" : "horizontal" });
      };
      const measure = () => {
        const panes2 = panesOf(handle);
        if (!panes2) return null;
        startSize = extent(panes2.before, panes2.vertical);
        total = startSize + extent(panes2.after, panes2.vertical);
        return panes2;
      };
      const panes = panesOf(handle);
      if (panes) {
        handle.setAttribute("aria-orientation", panes.vertical ? "horizontal" : "vertical");
        this.#publish(handle, panes);
      }
      this.onDispose(drag(handle, {
        start: () => {
          measure();
          handle.classList.add(HIGHLIGHT);
        },
        move: (_event, dx, dy) => {
          const current = panesOf(handle);
          if (current) resize(startSize + (current.vertical ? dy : dx));
        },
        end: () => handle.classList.remove(HIGHLIGHT)
      }));
      this.on(handle, "keydown", (event) => {
        const current = measure();
        if (!current) return;
        const grow = current.vertical ? "ArrowDown" : "ArrowRight";
        const shrink = current.vertical ? "ArrowUp" : "ArrowLeft";
        const step = event.shiftKey ? this.#number("data-step-shift", DEFAULT_STEP_LARGE) : this.#number("data-step", DEFAULT_STEP);
        if (event.key === grow) resize(startSize + step);
        else if (event.key === shrink) resize(startSize - step);
        else if (event.key === "Home") resize(minStart());
        else if (event.key === "End") resize(total - minEnd());
        else return;
        event.preventDefault();
      });
    }
    // Publishes the position of the handle for assistive technology: the size of the pane before it.
    #publish(handle, panes) {
      const size = extent(panes.before, panes.vertical);
      const total = size + extent(panes.after, panes.vertical);
      handle.setAttribute("aria-valuemin", String(this.#number("data-min-start", DEFAULT_MIN)));
      handle.setAttribute("aria-valuemax", String(Math.round(total - this.#number("data-min-end", DEFAULT_MIN))));
      handle.setAttribute("aria-valuenow", String(Math.round(size)));
    }
  };
  define("ue-splitter", SplitterElement);

  // design-system/src/StatusBar/StatusBar.ts
  var DRAWER = ".statusBar-btn";
  var COMBO = ".statusBar-combo";
  var MENU2 = ".statusBar-menu";
  var ROW6 = ".statusBar-row";
  var MAX_LINES = 4;
  var StatusBar = class extends UeElement {
    setup() {
      const field = this.one(".statusBar-field");
      const history = this.one(".statusBar-history");
      const recalled = [];
      let recallIndex = 0;
      const openMenu2 = () => this.one(MENU2 + ".is-open");
      const comboOf = (menu) => menu.parentElement?.querySelector(COMBO) ?? null;
      const close = (restoreFocus) => {
        const menu = openMenu2();
        if (!menu) return;
        menu.classList.remove("is-open");
        const combo = comboOf(menu);
        if (!combo) return;
        combo.setAttribute("aria-expanded", "false");
        if (restoreFocus) combo.focus();
      };
      const open = (combo, focusFirst) => {
        const menu = combo.parentElement?.querySelector(MENU2);
        if (!menu) return;
        close(false);
        menu.classList.add("is-open");
        combo.setAttribute("aria-expanded", "true");
        if (!focusFirst) return;
        const rows = enabledRows(menu, ROW6);
        if (rows.length > 0) rows[0].focus();
      };
      const toggleDrawer = (button) => {
        const bar = button.closest(".statusBar");
        const opening = !button.classList.contains("is-open");
        if (bar) {
          for (const other of Array.from(bar.querySelectorAll(DRAWER))) {
            other.classList.remove("is-open");
            other.setAttribute("aria-expanded", "false");
          }
        }
        if (opening) {
          button.classList.add("is-open");
          button.setAttribute("aria-expanded", "true");
        }
        const label = button.querySelector(".statusBar-txt")?.textContent ?? "";
        this.emit("ue-drawer-change", { drawer: opening ? label : null });
      };
      const choose = (row) => {
        const label = row.textContent?.trim() ?? "";
        for (const other of Array.from(row.parentElement?.querySelectorAll(ROW6) ?? [])) {
          other.setAttribute("aria-checked", String(other === row));
        }
        const combo = comboOf(row.closest(MENU2) ?? row);
        const text = combo?.querySelector(".statusBar-txt");
        if (text) text.textContent = label;
        this.emit("ue-executor-change", { executor: label });
        close(true);
      };
      const run = (command) => {
        if (history) {
          const line = document.createElement("div");
          line.className = "statusBar-history-line";
          line.textContent = "> " + command;
          history.append(line);
          while (history.children.length > MAX_LINES) history.firstElementChild?.remove();
        }
        recalled.push(command);
        recallIndex = recalled.length;
        this.emit("ue-command", { command });
      };
      this.on(this, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const row = target.closest(ROW6);
        if (row) {
          choose(row);
          return;
        }
        const drawer = target.closest(DRAWER);
        if (drawer && this.contains(drawer)) {
          toggleDrawer(drawer);
          return;
        }
        const combo = target.closest(COMBO + ".statusBar-cmd");
        if (!combo) return;
        if (combo.getAttribute("aria-expanded") === "true") close(false);
        else open(combo, false);
      });
      this.on(this, "pointerover", (event) => {
        const row = event.target instanceof Element ? event.target.closest(ROW6) : null;
        if (row) row.focus({ preventScroll: true });
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const key = event.key;
        if (target === field && field) {
          if (key === "Enter") {
            const command = field.value.trim();
            event.preventDefault();
            if (command === "") return;
            run(command);
            field.value = "";
          } else if (key === "ArrowUp" || key === "ArrowDown") {
            event.preventDefault();
            recallIndex = Math.min(Math.max(recallIndex + (key === "ArrowUp" ? -1 : 1), 0), recalled.length);
            field.value = recalled[recallIndex] ?? "";
          }
          return;
        }
        const row = target.closest(ROW6);
        if (row) {
          if (key === "Escape") {
            event.preventDefault();
            close(true);
          } else if (key === "Tab") close(false);
          else if (moveRowFocus(enabledRows(row.closest(MENU2) ?? row, ROW6), row, key)) event.preventDefault();
          else if (key === "Enter" || key === " ") {
            event.preventDefault();
            row.click();
          }
          return;
        }
        if (key === "Escape" && openMenu2()) {
          event.preventDefault();
          close(true);
        } else if ((key === "Enter" || key === " ") && target.matches(DRAWER + ", " + COMBO)) {
          event.preventDefault();
          target.click();
        } else if ((key === "ArrowUp" || key === "ArrowDown") && target.matches(COMBO + ".statusBar-cmd")) {
          event.preventDefault();
          open(target, true);
        }
      });
      this.on(document, "pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const menu = openMenu2();
        if (!menu || menu.contains(target)) return;
        const combo = comboOf(menu);
        if (combo && combo.contains(target)) return;
        close(false);
      });
    }
  };
  define("ue-status-bar", StatusBar);

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

  // design-system/src/ToolBar/ToolBar.ts
  var CONTROL = ".toolBar-btn, .toolBar-modes, .toolBar-wrap, .toolBar-plate";
  var TOGGLE = ".toolBar-btn--toggle";
  var MENU3 = ".toolBar-menu";
  var ROW7 = ".toolBar-row";
  function isDisabled3(el) {
    return el.getAttribute("aria-disabled") === "true";
  }
  var ToolBar = class extends UeElement {
    setup() {
      const menuOf2 = (control) => {
        const slot = control.closest(".toolBar-slot");
        return slot ? slot.querySelector(":scope > " + MENU3) : null;
      };
      const controlOf = (menu) => {
        const slot = menu.closest(".toolBar-slot");
        return slot ? slot.querySelector(CONTROL) : null;
      };
      const openMenu2 = () => this.one(MENU3 + ".is-open");
      const close = (restoreFocus) => {
        const menu = openMenu2();
        if (!menu) return;
        menu.classList.remove("is-open");
        const control = controlOf(menu);
        if (!control) return;
        control.setAttribute("aria-expanded", "false");
        if (restoreFocus) control.focus();
      };
      const open = (control, rows) => {
        const menu = menuOf2(control);
        if (!menu) return;
        close(false);
        menu.classList.add("is-open");
        control.setAttribute("aria-expanded", "true");
        if (rows === "none") return;
        const list = enabledRows(menu, ROW7);
        if (list.length > 0) (rows === "first" ? list[0] : list[list.length - 1]).focus();
      };
      const setPlaying = (bar, playing) => {
        const play = bar.querySelector(".toolBar-plate--play");
        const stop = bar.querySelector(".toolBar-plate--stop");
        if (!play || !stop) return;
        play.classList.toggle("is-pressed", playing);
        play.setAttribute("aria-pressed", String(playing));
        stop.classList.toggle("is-disabled", !playing);
        stop.setAttribute("aria-disabled", String(!playing));
        stop.tabIndex = playing ? 0 : -1;
        if (bar instanceof HTMLElement) bar.dataset.playing = String(playing);
        this.emit("ue-play-change", { playing });
      };
      for (const stop of this.all(".toolBar-plate--stop")) {
        const bar = stop.closest(".toolBar");
        if (bar) setPlaying(bar, bar.getAttribute("data-playing") === "true");
      }
      this.on(this, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const row = target.closest(ROW7);
        if (row) {
          if (isDisabled3(row)) return;
          this.emit("ue-menu-select", { label: rowLabel(row, ".toolBar-label") });
          close(true);
          return;
        }
        const control = target.closest(CONTROL);
        if (!control || isDisabled3(control)) return;
        if (control.matches(TOGGLE)) {
          const checked = control.classList.toggle("is-checked");
          control.setAttribute("aria-pressed", String(checked));
        }
        if (menuOf2(control)) {
          if (control.getAttribute("aria-expanded") === "true") close(false);
          else open(control, "none");
          return;
        }
        const bar = control.closest(".toolBar");
        if (!bar) return;
        if (control.matches(".toolBar-plate--play") && bar.getAttribute("data-playing") !== "true") setPlaying(bar, true);
        else if (control.matches(".toolBar-plate--stop")) setPlaying(bar, false);
      });
      this.on(this, "pointerover", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const row = target.closest(ROW7);
        if (row && !isDisabled3(row)) row.focus({ preventScroll: true });
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const key = event.key;
        const row = target.closest(ROW7);
        if (row) {
          if (key === "Escape") {
            event.preventDefault();
            close(true);
          } else if (key === "Tab") close(false);
          else if (moveRowFocus(enabledRows(row.closest(MENU3) ?? row, ROW7), row, key)) event.preventDefault();
          else if (key === "Enter" || key === " ") {
            event.preventDefault();
            row.click();
          }
          return;
        }
        const control = target.closest(CONTROL);
        if (!control) return;
        if (key === "Escape") {
          if (!openMenu2()) return;
          event.preventDefault();
          close(true);
        } else if (key === "Enter" || key === " ") {
          event.preventDefault();
          control.click();
        } else if ((key === "ArrowDown" || key === "ArrowUp") && menuOf2(control)) {
          event.preventDefault();
          open(control, key === "ArrowDown" ? "first" : "last");
        } else if (key === "ArrowRight" || key === "ArrowLeft") {
          const bar = control.closest(".toolBar");
          if (!bar) return;
          const list = Array.from(bar.querySelectorAll(CONTROL)).filter((c) => !isDisabled3(c));
          const next = list[(list.indexOf(control) + (key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
          event.preventDefault();
          close(false);
          next.focus();
        }
      });
      this.on(document, "pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const menu = openMenu2();
        if (!menu || menu.contains(target)) return;
        const control = controlOf(menu);
        if (control && control.contains(target)) return;
        close(false);
      });
    }
  };
  define("ue-tool-bar", ToolBar);

  // design-system/src/Tooltip/Tooltip.ts
  var SUMMON_DELAY = 150;
  var INTRO = 100;
  var OFFSET_X = 12;
  var OFFSET_Y = 8;
  var EDGE = 4;
  var UeTooltipElement = class extends UeElement {
    #active = null;
    #suppressed = false;
    #frame = 0;
    #popup = null;
    setup() {
      const popup = this.all(".tooltip-popup").find((candidate) => ownedBy(this, candidate));
      if (!popup) throw new Error("ue-tooltip needs a .tooltip-popup element");
      this.#popup = popup;
      const inTarget = (node) => ownedBy(this, node) && !popup.contains(node);
      this.on(this, "pointerover", (event) => {
        if (!inTarget(event.target) || this.#suppressed || this.#active) return;
        this.#summon(event.clientX, event.clientY);
      });
      this.on(this, "pointermove", (event) => {
        if (inTarget(event.target) && this.#active && this.#active.start >= 0) {
          this.#active.x = event.clientX;
          this.#active.y = event.clientY;
        }
      });
      this.on(this, "pointerout", (event) => {
        if (!inTarget(event.target)) return;
        if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
        this.#suppressed = false;
        this.#dismiss();
      });
      this.on(this, "pointerdown", (event) => {
        if (!inTarget(event.target)) return;
        this.#suppressed = true;
        this.#dismiss();
      });
      this.on(this, "focusin", (event) => {
        const target = event.target;
        if (!inTarget(target) || !target.matches(":focus-visible") || this.#active) return;
        const rect = target.getBoundingClientRect();
        this.#summon(rect.left, rect.bottom - OFFSET_Y);
      });
      this.on(this, "focusout", (event) => {
        if (inTarget(event.target)) this.#dismiss();
      });
      this.on(document, "keydown", (event) => {
        if (event.key === "Escape") this.#dismiss();
      });
      this.onDispose(() => this.#dismiss());
    }
    #summon(x, y) {
      this.#dismiss();
      const popup = this.#popup;
      if (!popup) return;
      this.#active = { popup, start: performance.now(), x, y };
      this.#frame = requestAnimationFrame(this.#tick);
    }
    #dismiss() {
      cancelAnimationFrame(this.#frame);
      if (this.#active) {
        this.#active.popup.hidden = true;
        this.#active.popup.style.opacity = "0";
        this.#active = null;
      }
    }
    #tick = (now) => {
      const active = this.#active;
      if (!active) return;
      const elapsed = now - active.start - SUMMON_DELAY;
      if (elapsed >= 0) {
        const popup = active.popup;
        popup.hidden = false;
        popup.style.opacity = String(Math.min(1, elapsed / INTRO));
        const width = popup.offsetWidth;
        const height = popup.offsetHeight;
        const left = Math.max(EDGE, Math.min(active.x + OFFSET_X, window.innerWidth - width - EDGE));
        const top = Math.max(EDGE, Math.min(active.y + OFFSET_Y, window.innerHeight - height - EDGE));
        popup.style.left = left + "px";
        popup.style.top = top + "px";
      }
      this.#frame = requestAnimationFrame(this.#tick);
    };
  };
  define("ue-tooltip", UeTooltipElement);

  // design-system/src/TreeRow/TreeRow.ts
  var ARROW2 = '<svg class="tr-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4.5 4L6 12z"/></svg>';
  var FOLDER2 = '<svg class="tr-icon is-folder" viewBox="0 0 16 16" aria-hidden="true"><path class="tr-folder-closed" d="M1.5 4.5V12a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.8 3.5H2.5a1 1 0 0 0-1 1z"/><path class="tr-folder-open" d="M1.5 4.5V12a1 1 0 0 0 1 1h10.6l1.9-5.2a.8.8 0 0 0-.75-1.1H5.2L3.8 11V4.5a1 1 0 0 1 1-1h2L8 5h5.5"/></svg>';
  var OBJECT = '<svg class="tr-icon is-object" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l5.5 3.1v6.2L8 14.2 2.5 11.1V4.9zM2.5 4.9L8 8l5.5-3.1M8 8v6.2"/></svg>';
  var TreeRow = class extends UeElement {
    #tree = null;
    #controller = null;
    #filter = null;
    #kept = /* @__PURE__ */ new Set();
    #parentsOfKept = /* @__PURE__ */ new Set();
    #lastIds = "";
    setup() {
      const tree = this.#ownTree() ?? this.#createTree();
      this.#tree = tree;
      tree.setAttribute("role", "tree");
      tree.setAttribute("aria-multiselectable", String(!this.#single()));
      const controller = new TreeController(
        tree,
        {
          row: ".tr-row",
          arrow: ".tr-arrow",
          folder: ".tr-icon.is-folder",
          caretOpen: "",
          caretClosed: "",
          folderOpen: "",
          folderClosed: "",
          openClass: "is-open"
        },
        {
          multi: !this.#single(),
          excluded: (row) => this.#filter !== null && !this.#kept.has(row),
          forceOpen: (row) => this.#filter !== null && this.#parentsOfKept.has(row),
          lazy: (row) => row.dataset.expandable === "true",
          toggled: (row, open) => this.emit("ue-tree-toggle", { id: this.#idOf(row), expanded: open }),
          selected: () => this.#announceSelection()
        }
      );
      this.#controller = controller;
      this.on(tree, "click", (event) => {
        if (this.owns(event.target)) controller.click(event);
      });
      this.on(tree, "dblclick", (event) => {
        if (this.owns(event.target)) controller.doubleClick(event);
      });
      this.on(tree, "keydown", (event) => {
        if (this.owns(event.target)) controller.keyDown(event);
      });
      this.#lastIds = this.getSelectedIds().join("\n");
      controller.refresh();
    }
    #single() {
      return this.getAttribute("select") === "single";
    }
    // The first tree below this element that no nested instance owns.
    #ownTree() {
      return this.all(".tr-tree").find((tree) => tree.closest(this.localName) === this) ?? null;
    }
    #createTree() {
      const tree = document.createElement("div");
      tree.className = "tr-tree";
      this.append(tree);
      return tree;
    }
    #rows() {
      return this.#controller?.rows() ?? [];
    }
    #idOf(row) {
      return row.dataset.id ?? (row.querySelector(".tr-text")?.textContent ?? "").trim();
    }
    #rowOf(id) {
      return this.#rows().find((row) => this.#idOf(row) === id);
    }
    #info(row) {
      return { id: this.#idOf(row), label: (row.querySelector(".tr-text")?.textContent ?? "").trim(), depth: (this.#controller?.level(row) ?? 1) - 1 };
    }
    #announceSelection() {
      const ids = this.getSelectedIds();
      const key = ids.join("\n");
      if (key === this.#lastIds) return;
      this.#lastIds = key;
      this.emit("ue-tree-select", { ids });
    }
    // Ids of the selected rows in tree order.
    getSelectedIds() {
      return this.#rows().filter((row) => row.classList.contains("is-selected")).map((row) => this.#idOf(row));
    }
    // Selects exactly these rows. Ids that name no row are ignored.
    select(ids) {
      const controller = this.#controller;
      if (!controller) return;
      const wanted = new Set(this.#single() ? ids.slice(0, 1) : ids);
      const rows = this.#rows().filter((row) => wanted.has(this.#idOf(row)));
      controller.setSelection(rows, rows[rows.length - 1] ?? null);
    }
    // Opens or closes one row.
    setExpanded(id, expanded) {
      const row = this.#rowOf(id);
      if (row && this.#controller?.hasChildren(row)) this.#controller.setOpen(row, expanded);
    }
    // Replaces every row with rows drawn from data.
    setRows(rows) {
      const tree = this.#tree;
      const controller = this.#controller;
      if (!tree || !controller) return;
      tree.replaceChildren(...rows.map((data) => this.#draw(data)));
      this.#lastIds = this.getSelectedIds().join("\n");
      this.#refilter();
      controller.refresh();
    }
    #draw(data) {
      const depth = data.depth ?? 0;
      const row = document.createElement("div");
      row.className = "tr-row" + (data.selected ? " is-selected" : "") + (data.dim ? " is-dim" : "");
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-level", String(depth + 1));
      row.setAttribute("aria-expanded", data.expanded ? "true" : "false");
      row.dataset.id = data.id;
      if (data.expandable) row.dataset.expandable = "true";
      const icon = data.icon ?? "object";
      const cells = (data.cells ?? []).map(() => '<span class="tr-cell"></span>').join("");
      row.innerHTML = '<span class="tr-indent" style="--depth:' + depth + '"></span>' + ARROW2 + (icon === "folder" ? FOLDER2 : icon === "object" ? OBJECT : "") + '<span class="tr-text"></span>' + cells;
      const text = row.querySelector(".tr-text");
      if (text) text.textContent = data.label;
      const cellEls = row.querySelectorAll(".tr-cell");
      (data.cells ?? []).forEach((value, i) => {
        cellEls[i].textContent = value;
      });
      return row;
    }
    // Shows only the rows the filter accepts and their ancestors. Ancestors open while the filter is set. Null clears it.
    setFilter(filter) {
      if (typeof filter === "string") {
        const needle = filter.trim().toLowerCase();
        this.#filter = needle === "" ? null : (row) => row.label.toLowerCase().includes(needle);
      } else {
        this.#filter = filter;
      }
      this.#refilter();
      this.#controller?.refresh();
    }
    #refilter() {
      this.#kept = /* @__PURE__ */ new Set();
      this.#parentsOfKept = /* @__PURE__ */ new Set();
      const filter = this.#filter;
      const controller = this.#controller;
      if (!filter || !controller) return;
      const rows = this.#rows();
      rows.forEach((row, index) => {
        if (!filter(this.#info(row))) return;
        this.#kept.add(row);
        let want = controller.level(row);
        for (let j = index - 1; j >= 0 && want > 1; j--) {
          const level = controller.level(rows[j]);
          if (level < want) {
            this.#kept.add(rows[j]);
            this.#parentsOfKept.add(rows[j]);
            want = level;
          }
        }
      });
    }
  };
  define("ue-tree-row", TreeRow);

  // design-system/src/WindowChrome/WindowChrome.ts
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

  // design-system/bundle/main.ts
  window.UEStarship = {
    elements: Array.from(new Set(Array.from(document.querySelectorAll("*")).map((el) => el.localName).filter((tag) => tag.startsWith("ue-"))))
  };
})();
