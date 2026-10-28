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

// design-system/src/SourcePanel/SourcePanel.ts
var ROW = ".SourcePanel__row";
var SELECTED = "SourcePanel__row--selected";
var PARENT = "SourcePanel__row--parent";
var INDENT_PX = 10;
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
    return Array.from(tree.querySelectorAll(ROW));
  }
  #visible(tree) {
    return this.#rows(tree).filter((row) => !row.hidden);
  }
  #depth(row) {
    const indent = row.querySelector(".SourcePanel__indent");
    const px = indent ? parseFloat(indent.style.width) : 0;
    return Math.round((Number.isNaN(px) ? 0 : px) / INDENT_PX);
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
      row.setAttribute("aria-selected", String(row.classList.contains(SELECTED)));
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
    const stop = visible.find((row) => row.classList.contains(SELECTED)) ?? visible[0];
    for (const row of this.#rows(tree)) row.tabIndex = row === stop ? 0 : -1;
  }
  #swap(element, from, to) {
    const use = element?.querySelector("use");
    const href = use?.getAttribute("href");
    if (use && href) use.setAttribute("href", href.replace(from, to));
  }
  #select(row, focus) {
    for (const other of this.all(ROW)) {
      other.classList.remove(SELECTED, PARENT);
      other.setAttribute("aria-selected", "false");
    }
    row.classList.add(SELECTED);
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
      const child = rows[i];
      const childDepth = this.#depth(child);
      if (childDepth <= depth) break;
      if (skipBelow !== null && childDepth > skipBelow) {
        child.hidden = true;
        continue;
      }
      skipBelow = null;
      child.hidden = !open;
      if (!open && child.classList.contains(SELECTED)) selectedHidden = true;
      if (open && this.#hasKids(child) && !this.#isOpen(child)) skipBelow = childDepth;
    }
    if (!open && !selectedHidden) selectedHidden = rows.some((each) => each.hidden && each.classList.contains(SELECTED));
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
    const row = target.closest(ROW);
    if (!row) return;
    if (target.closest(".SourcePanel__exp")) {
      this.#setOpen(row, !this.#isOpen(row));
      return;
    }
    this.#select(row, true);
  }
  #doubleClick(event) {
    const row = event.target instanceof Element ? event.target.closest(ROW) : null;
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
    if (!target.matches(ROW)) return;
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
