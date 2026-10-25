The main menu strip of the editor window: transparent text items that fill Hover on mouse over and Primary while their menu is open.

## What the consumer provides

- One `.menuBar-item` per top-level menu, in order: File, Edit, Window, Tools, Build, Select, Actor, Help.
- The open state (`.is-open`) on the item whose pop-up menu shows. Hover can be `:hover`.
- The pop-up menus themselves are not part of this component.

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

`<ue-menu-bar>` (`src/MenuBar/MenuBar.ts`, built to `MenuBar.js`) wraps a `.menuBar` and makes it work. It adds no look: it toggles `.is-open` on the item and `aria-expanded`, and the CSS shows the menu that follows the item inside its `.menuBar-slot`.

- A press on an item opens its `.menuBar-menu`. A press on the open item closes it (the source opens on mouse down, `SMenuEntryBlock.cpp:276`).
- While one menu is open, moving over another item opens that one instead.
- Escape, Tab or a press outside closes. Left and Right move between items, Down, Up, Home and End move in the menu, Enter and Space pick, Escape returns focus to the item.
- A picked row fires `ue-menu-select` with `{ label }`.
- The menu look (Dropdown ground, Primary hovered row, disabled alpha .45) is copied from the PopupMenu component. The menu entries in the preview are illustrative. They are not the full 5.5.3 menus.
- A strip with `data-pinned` (the forced hover and open specimens) is outside the element and stays plain HTML.

## Not found in source

- The title bar around the menu strip (logo, tab, window buttons) belongs to the window chrome and was not read.
