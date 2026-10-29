The main menu strip of the editor window: transparent text items that fill Hover on mouse over and Primary while their menu is open.

## Composed from

| Primitive | Count | Role |
|---|---|---|
| `ue-combo-button` with `combobutton--menubar` | 8 | One per top-level menu: File, Edit, Window, Tools, Build, Select, Actor, Help. Action mode, the label never changes |
| `ue-popup-menu` | 8 | The panel of each combo. Rows, key bindings, separators and disabled rows follow the PopupMenu README |

The composite adds only layout: the strip (`.menuBar`) and the slot (`.menuBar-slot`) that is also the combo anchor. It draws no item, no menu and no row.

## What the consumer provides

- One `ue-combo-button` per top-level menu, in order, with a `combobutton--menubar` trigger and a `ue-popup-menu` panel.
- The menu rows. The preview entries are illustrative.
- Forced hover and open specimens use `combobutton--hover` and `combobutton--open` on a plain trigger.

## Metrics

Citations: `SC` is `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`. The style set name is `WindowMenuBar` (`MultiBoxBuilder.h:477`).

| Part | Value | Source |
|---|---|---|
| Strip background | none (transparent) | `SC:2443` |
| Item padding | 12 horizontal, 4 vertical | `SC:2448` |
| Item height | 24 (text line 16 + 8; the line height is an approximation of Roboto metrics) | derived |
| Label font | Normal, Roboto Regular 10pt = 13.333px | `SC:2444`, `SC:36` |
| Normal | no fill, Foreground | `SC:2419`, `SC:2439` |
| Hover | Hover fill, ForegroundHover | `SC:2436-2437` |
| Menu open | Primary fill, ForegroundHover | `SC:2420`, `SC:2438`; chosen in `SMenuEntryBlock.cpp:1614-1616` |
| Corner radius | 0 (colour brushes) | `SC:2420`, `SC:2436` |
| Click behavior | opens on mouse down | `SMenuEntryBlock.cpp:276` |

The fill sits on a border outside the button and the button uses the NoBorder style with zero padding. The fill covers the whole 12/4 padded item and nothing shifts on press (`SMenuEntryBlock.cpp:267-281`).

## Do

- Fill the whole item rectangle, edge to edge, with no gaps between items.
- Switch the label to ForegroundHover in both hover and open states.

## Don't

- Do not round the corners or add a border.
- Do not dim the open item. Primary is the open state.

## Live behaviour

`<ue-menu-bar>` (`src/MenuBar/MenuBar.ts`, built to `MenuBar.js`) wraps a `.menuBar` and moves between its combos. It opens and closes nothing itself. It calls `open()` and `close()` of the nested `ue-combo-button` elements.

- A click on an item opens its menu. A click on the open item closes it. The combo button owns Escape, Tab, an outside press, the row keys and the focus return.
- While one menu is open, moving over another item opens that one instead.
- Left and Right move between the items. In an open menu they close it and open the next menu on its first row. A row with a submenu keeps the arrow keys.
- A picked row fires `ue-menu-select` with `{ label }`. The event repeats `ue-combo-pick` of the nested combo.
- The menu entries in the preview are illustrative. They are not the full 5.5.3 menus.
- A strip in `<ue-menu-bar data-pinned>` (the forced hover and open specimens) runs no setup and ignores the pointer.

## Not found in source

- The title bar around the menu strip (logo, tab, window buttons) belongs to the window chrome and was not read.
