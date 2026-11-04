# SourcePanel

The left-hand "sources" column of the Content Browser: stacked collapsible sections (Favorites, the project tree, Collections), each with a caret, a bold title and trailing icon buttons. That column is over a recessed folder tree with selection and parent highlighting.

## Composed from

| Part | Built from |
|---|---|
| Each section | `ue-expandable-area` (`expandablearea--source`) |
| The folder tree of a section | `ue-tree-row` (`tr-tree is-compact`, `collapse-selects`) |
| Search toggles | `ue-button` (`button--toggle button--icon`) |
| Add collection | `ue-button` (`button--simple button--icon`) |

The composite owns only the layout (`src/SourcePanel/SourcePanel.css`): the 4px padding, the 2px gap between the sections and the scroll box of a section body. It also keeps one selection across all the trees.

## What the consumer provides

- Section titles and which trailing buttons each section shows (Favorites: search. Project: search, Collections: plus-circle then search).
- The tree rows as `ue-tree-row` markup (see the TreeRow README): depth, expanded state and folder name. Give each `ue-tree-row` a `data-tree` name to fill it later with `setRows`.
- A `SourcePanel--fill` class on the panel when a parent gives it a height. The section with `SourcePanel__area--fill` takes the free height and scrolls. A collapsed one gives it back.

## API

```ts
el.setRows(tree: string, rows: TreeRowData[]): void; // the rows of the ue-tree-row with this data-tree
el.select(id: string): void;                         // selects the row with this id, clears the other trees
el.setExpanded(id: string, expanded: boolean): void;
```

| Event | `detail` | When |
|---|---|---|
| `sourcepanel:select` | `{ id, name }` | The user or `select` chose a row. A selection in one tree clears the others |

The events of the parts bubble as they are (`ue-tree-toggle`, `ue-expand-toggle`, `ue-button-click`).

## Structure and metrics owned by the panel

`4px padding` -> multiple sections separated by a 2px gap painted `--background` -> each section is a `--header` block with 2px top padding holding a 24px. Header row and, when expanded, a `--recessed` body.

| Part | Value | Source |
|---|---|---|
| Outer padding | 4px | `SContentBrowser.cpp:880` |
| Splitter handle between sections | 2px, `--background` | `SContentBrowser.cpp:897`, `StarshipCoreStyle.cpp:633-635` |
| Search toggle margin | 4px each side | `SContentBrowser.cpp:1493` |
| Add-collection button | 4px left margin | `SContentBrowser.cpp:1644-1655` |

The section look (`expandablearea--source`), the 16px tree rows with the 19px root, the 10px indent, the folder tint. The selection colours follow the ExpandableArea and TreeRow READMEs. The toggle look follows the Button README.

## Do

- Reserve the 16px expander column on leaf rows so names align. The tree does this.
- Keep the splitter gap between sections at 2px.

## Don't

- Do not tint folders per state, only an explicit per-folder colour overrides `--accent-folder`.
- Do not add row separators or alternating row colours. The tree uses a flat `--recessed` body.

## Icons

Starship SVGs are not available. The carets, search, plus-circle and open / closed folder icons in `preview.html` are approximations on the 16px grid.
