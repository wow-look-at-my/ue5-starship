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

// src/_shared/drag.ts
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

// src/VectorInput/VectorInput.ts
var round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
function format(value, unit) {
  let text = String(round(value, 4));
  if (!text.includes(".")) text += ".0";
  return unit === "" ? text : text + " " + unit;
}
var UeVectorInput = class extends UeElement {
  setup() {
    for (const row of this.all(".VectorInput-row")) this.wireRow(row);
  }
  wireRow(row) {
    const fields = Array.from(row.querySelectorAll(".VectorInput-field"));
    if (fields.length === 0) return;
    const reset = row.querySelector(".VectorInput-reset");
    const lock = row.querySelector(".VectorInput-lock");
    const unit = row.dataset.unit ?? "";
    const step = Number(row.dataset.step ?? "1");
    const defaults = (row.dataset.default ?? "").split(",").map(Number);
    const read = () => fields.map((field) => Number(field.dataset.value));
    const isLocked = () => lock?.classList.contains("is-locked") ?? false;
    const isEditing = (field) => field.classList.contains("is-editing");
    const write = (values, notify) => {
      fields.forEach((field, i) => {
        field.dataset.value = String(values[i]);
        field.setAttribute("aria-valuenow", String(values[i]));
        const text = field.querySelector(".VectorInput-value-text");
        if (text && !isEditing(field)) text.textContent = format(values[i], unit);
      });
      const differs = values.some((value, i) => Math.abs(value - defaults[i]) > 1e-9);
      reset?.classList.toggle("is-placeholder", !differs);
      if (reset) reset.tabIndex = differs ? 0 : -1;
      if (notify) this.emit("ue-vector-change", { values });
    };
    const change = (values, index, next, basis) => {
      const out = values.slice();
      out[index] = next;
      if (!isLocked()) return out;
      for (let j = 0; j < out.length; j++) {
        if (j !== index) out[j] = basis[index] === 0 ? next : basis[j] * next / basis[index];
      }
      return out;
    };
    fields.forEach((field, index) => this.wireField(field, index, { read, write, change, isEditing, step, unit }));
    if (reset) this.on(reset, "click", () => write(defaults, true));
    if (lock) {
      this.on(lock, "click", () => {
        const on = !isLocked();
        lock.classList.toggle("is-locked", on);
        lock.setAttribute("aria-pressed", String(on));
        lock.title = on ? "Scale uniformly (locked)" : "Scale uniformly (unlocked)";
        lock.querySelector("use")?.setAttribute("href", on ? "#VectorInput-locked" : "#VectorInput-unlock");
      });
    }
    const combo = row.querySelector(".VectorInput-combo");
    const menu = row.querySelector(".VectorInput-menu");
    if (combo && menu) {
      const handle = wireMenu({
        trigger: combo,
        menu,
        itemSelector: ".VectorInput-menuItem",
        onPick: (item) => {
          for (const other of menu.querySelectorAll(".VectorInput-menuItem")) other.setAttribute("aria-checked", String(other === item));
          this.emit("ue-vector-space", { space: (item.textContent ?? "").trim() });
        }
      });
      this.onDispose(handle.dispose);
    }
    write(read(), false);
  }
  wireField(field, index, row) {
    const text = field.querySelector(".VectorInput-value-text");
    if (!text) return;
    let startValues = [];
    let live = 0;
    let lastX = 0;
    let dragging = false;
    let cancelled = false;
    const leaveEdit = () => {
      field.classList.remove("is-editing", "is-active");
      text.contentEditable = "false";
    };
    const enterEdit = () => {
      field.classList.add("is-editing", "is-active");
      text.contentEditable = "plaintext-only";
      text.textContent = String(round(row.read()[index], 4));
      text.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(text);
      selection?.addRange(range);
    };
    const commit = (refocus) => {
      const raw = (text.textContent ?? "").replace(/[^0-9eE+.-]/g, "");
      const next = Number(raw);
      leaveEdit();
      const values = row.read();
      row.write(raw === "" || Number.isNaN(next) ? values : row.change(values, index, next, values), true);
      if (refocus) field.focus();
    };
    const cancelEdit = () => {
      leaveEdit();
      row.write(row.read(), false);
      field.focus();
    };
    this.onDispose(
      drag(field, {
        start: (event) => {
          if (row.isEditing(field)) return;
          startValues = row.read();
          live = startValues[index];
          lastX = event.clientX;
          dragging = false;
          cancelled = false;
        },
        move: (event) => {
          if (row.isEditing(field) || cancelled) return;
          if (!dragging) {
            dragging = true;
            lastX = event.clientX;
            field.classList.add("is-active");
            return;
          }
          const dx = event.clientX - lastX;
          lastX = event.clientX;
          const width = Math.max(field.getBoundingClientRect().width, 100);
          live += Math.sign(dx) * (Math.abs(dx) / width) * Math.max(Math.abs(live), 1);
          row.write(row.change(row.read(), index, live, startValues), false);
        },
        end: () => {
          if (row.isEditing(field)) return;
          if (!dragging) {
            enterEdit();
            return;
          }
          dragging = false;
          field.classList.remove("is-active");
          if (cancelled) return;
          const snapped = round(Math.round(live / row.step) * row.step, 6);
          row.write(row.change(row.read(), index, snapped, startValues), true);
        }
      })
    );
    this.on(document, "keydown", (event) => {
      if (event.key !== "Escape" || !dragging || cancelled) return;
      cancelled = true;
      field.classList.remove("is-active");
      row.write(startValues, true);
    });
    this.on(field, "keydown", (event) => {
      if (row.isEditing(field)) return;
      let sign = 0;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") sign = 1;
      else if (event.key === "ArrowDown" || event.key === "ArrowLeft") sign = -1;
      else if (event.key === "Enter") {
        event.preventDefault();
        enterEdit();
        return;
      }
      if (sign === 0) return;
      event.preventDefault();
      const values = row.read();
      row.write(row.change(values, index, round(values[index] + sign * row.step, 6), values), true);
    });
    this.on(text, "keydown", (event) => {
      if (event.key === "Enter") commit(true);
      else if (event.key === "Escape") cancelEdit();
      else {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    });
    this.on(text, "blur", () => {
      if (row.isEditing(field)) commit(false);
    });
  }
};
define("ue-vector-input", UeVectorInput);
