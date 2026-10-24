# SourcePanel

The left-hand "sources" column of the Content Browser: stacked collapsible sections (Favorites, the project tree, Collections), each with a caret, a bold title and trailing icon buttons. That column is over a recessed folder tree with selection and parent highlighting.

## What the consumer provides

- Section titles and which trailing buttons each section shows (Favorites: search. Project: search, Collections: plus-circle then search).
- The tree rows: depth, expanded / has-children state, folder name and an optional folder colour (default `--accent-folder`).
- Row state: selected, parent-of-selection, hovered.

## Structure

`4px padding` -> multiple sections separated by a 2px splitter handle painted `--background` -> each section is a `--header` block with 2px top padding holding a 24px. Header row and, when expanded, a `--recessed` body.

## Metrics

| Part | Value | Source |
|---|---|---|
| Outer padding | 4px | `SContentBrowser.cpp:880` |
| Splitter handle | 2px, `--background` | `SContentBrowser.cpp:897`, `StarshipCoreStyle.cpp:633-635` |
| Section block | `--header`, padding (0,2,0,0) | `SContentBrowser.cpp:907-909` |
| Section minimum height | 26px (24 header + 2 padding) | `SContentBrowser.cpp:900` |
| Header padding | 4px left/right, 0 vertical | `SContentBrowser.cpp:1473` |
| Caret | 16px caret-right / caret-down, 3px gap to title | `StarshipCoreStyle.cpp:564-565`, `SExpandableArea.h:40` |
| Title | Normal 10pt **Bold**, `--foreground` | `SContentBrowser.cpp:1484-1487`, `StarshipCoreStyle.cpp:38` |
| Search toggle | 24 x 24 (Padding 4 + 16 icon), hover `--dropdown` radius 4, margin 4px each side | `SSearchToggleButton.cpp:32-33`, `StarshipCoreStyle.cpp:1625-1641`, `SContentBrowser.cpp:1493` |
| Add-collection button | `SimpleButton` padding 1px 3px + 16 icon, 4px left margin | `SContentBrowser.cpp:1644-1655` |
| Body fill | `--recessed` | `SContentBrowser.cpp:1554` |
| Tree row height | 16px (icon and arrow are 16) | `StarshipCoreStyle.cpp:2072`, `SourcesViewWidgets.cpp:140-150` |
| Root row | +3px top padding (19px) | `SourcesViewWidgets.cpp:138` |
| Indent per level | 10px; the 16px expander column is always reserved (leaf arrows are hidden, not removed) | `SExpanderArrow.cpp:73,182` |
| Folder icon | 16px, 2px right margin, colour `DefaultFolderColor` = `--accent-folder` | `StarshipStyle.cpp:6336-6337,6348`, `SourcesViewWidgets.cpp:144` |
| Tree text | Normal 10pt Regular | `StarshipStyle.cpp:6331-6332` |
| Selected row | `--select`; text `--foreground-hover` | `StarshipCoreStyle.cpp:2009,2019` |
| Selected, window unfocused | `--select-inactive` (reference screenshot state) | `StarshipCoreStyle.cpp:2012` |
| Parent of selection | `--select-parent` | `StarshipCoreStyle.cpp:2015`, `SPathView.cpp:1193-1194` |
| Hovered row | `--select-hover` | `StarshipCoreStyle.cpp:2002` |

## Do

- Reserve the 16px expander column on leaf rows so names align.
- Highlight every ancestor of the selection with `--select-parent`.
- Keep the splitter handle between sections at 2px.

## Don't

- Do not tint folders per state, only an explicit per-folder colour overrides `--accent-folder`.
- Do not add row separators or alternating row colours. The tree uses a flat `--recessed` body.

## Icons

Starship SVGs are not available. The carets, search, plus-circle and open / closed folder icons in `preview.html` are approximations on the 16px grid.
