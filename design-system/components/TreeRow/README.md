# TreeRow

A 20px tree row with a caret expander, a 16px icon and a label, plus the whole tree behaviour. Selection, expansion, keyboard and the parent tint (UE 5.5.3 Starship, `TableView.AlternatingRow` as the Scene Outliner uses it). One `<ue-tree-row>` wraps exactly one tree. Compose bigger components by putting one inside them.

## Markup contract

```html
<ue-tree-row select="multi">  <!-- select="single" turns Shift and Ctrl off -->
	<div class="tr-tree" role="tree">   <!-- add class is-compact for the source-tree look -->
		<div class="tr-row" role="treeitem" aria-level="1" aria-expanded="true" data-id="lights" tabindex="0">
			<span class="tr-indent" style="--depth:0"></span>
			<svg class="tr-arrow" viewBox="0 0 16 16"><path d="M6 4l4.5 4L6 12z"/></svg>
			<svg class="tr-icon is-folder" viewBox="0 0 16 16"><path class="tr-folder-closed" d="..."/><path class="tr-folder-open" d="..."/></svg>
			<span class="tr-text">Lights</span>
		</div>
		<div class="tr-row" role="treeitem" aria-level="2" data-id="sun" tabindex="-1">
			<span class="tr-indent" style="--depth:1"></span>
			<svg class="tr-arrow is-leaf" viewBox="0 0 16 16"><path d="M6 4l4.5 4L6 12z"/></svg>
			<svg class="tr-icon is-object" viewBox="0 0 16 16"><path d="..."/></svg>
			<span class="tr-text">Sun</span>
		</div>
	</div>
</ue-tree-row>
```

The rows are a flat list. The depth of a row is its `aria-level` (1 is the root) and the `--depth` of its `.tr-indent` (0 is the root). A row has children when the next row is deeper. The element sets `aria-expanded`, `aria-selected`, `tabindex`, `is-leaf` on the arrow, `is-odd` (stripe by visible position), `is-parent` (tint of a parent of the selection) and `is-open` (the row shows its children) on its own. An author writes only the initial `aria-expanded`, `is-selected` and `data-id`. `data-id` is the id in events.

Without it the label text is the id.

- The arrow is one right-pointing caret. A row with `is-open` turns it a quarter turn (`TreeArrow_Expanded`). The folder icon holds a closed path and an open path, and the row shows one. No `<symbol>` is needed.
- `.tr-cell` is a free column cell: a fixed-width box (`--tr-cell-width`, 80px by default, or an inline `width`). Put cells before `.tr-indent` for a gutter (the eye of the Scene Outliner) or after `.tr-text` for a trailing column (its Type).
- Colours follow focus with no script: `--select` while the tree focus (`:focus-within`), `--select-inactive` otherwise. A pinned specimen outside a tree uses the classes `is-hover`, `is-selected`, `is-inactive`, `is-parent` and `is-dim`.

## Variants

| Variant | Markup | Effect |
|---|---|---|
| Default | `.tr-tree` | 20px rows, indent 6 + 12 per level, subdued arrow, folder tint at 75% |
| Source tree | `.tr-tree.is-compact` | 16px rows, 19px root rows (3px top padding), indent 0 + 10 per level, full-strength arrow and folder. Values from the Content Browser source tree (`SourcesViewWidgets.cpp:138-150`, `SExpanderArrow.cpp:73,182`) |
| Custom indent | `style="--tree-indent-base:0px; --tree-indent-step:10px"` on `.tr-tree` or on an ancestor | The indent of a row is `base + depth x step`. Defaults 6px and 12px. `is-compact` defaults to 0px and 10px |
| Single select | `<ue-tree-row select="single">` | Every click and key selects one row. Shift and Ctrl add nothing. `aria-multiselectable` is `false` |
| Multi select | default | Click replaces, Ctrl or Cmd toggles, Shift selects the range from the anchor |

## Events

Both events bubble and are composed.

| Event | `detail` | When |
|---|---|---|
| `ue-tree-select` | `{ ids: string[] }` | The set of selected rows changed, in tree order. Fires for a click, a key or `select()` |
| `ue-tree-toggle` | `{ id: string, expanded: boolean }` | A row opened or closed, by the arrow, a double-click, Left or Right, or `setExpanded()`. A filter that opens ancestors does not fire it |

A handler on the element ignores an event whose target belongs to another `ue-tree-row`, so trees can nest in a composite.

## Data API

```ts
interface TreeRowData {
	id: string;
	label: string;
	depth?: number;                       // from 0
	icon?: 'folder' | 'object' | 'none';  // default 'object'
	expandable?: boolean;                 // show the arrow although no child row follows
	expanded?: boolean;                   // initial state
	selected?: boolean;
	dim?: boolean;                        // non-interactive grey label
	cells?: string[];                     // text of trailing .tr-cell columns
}
el.setRows(rows: TreeRowData[]);          // replaces every row; an element with no .tr-tree creates one
el.getSelectedIds(): string[];
el.select(ids: string[]);                 // fires ue-tree-select
el.setExpanded(id: string, expanded: boolean);
el.setFilter(filter: string | ((row: { id: string; label: string; depth: number }) => boolean) | null);
el.appendRow(row: TreeRowData);           // adds one row after the last row; the selection stays
```

`<ue-tree-row collapse-selects>`: closing a row that hides the selected row selects the closing row, as a file tree does. `ue-tree-toggle` fires first, then `ue-tree-select`. Without the attribute the hidden row stays selected.

`setFilter` keeps the rows that match and their ancestors, hides the rest, and shows each ancestor open while the filter is set. The stored `aria-expanded` of an ancestor does not change, so `setFilter(null)` restores the earlier tree. A string filter is a case-insensitive substring of the label.

`expandable: true` keeps the arrow on a row with no children yet. Opening it fires `ue-tree-toggle`. The consumer answers with a new `setRows`.

## What the consumer provides

- The row index. Even rows use `--recessed`, odd rows use `--background`.
- The state: hovered, selected, whether the tree keyboard focus (selected rows only), whether the row is a parent of a selected row.
- The indent depth, whether the item has children, whether it is expanded.
- The icon and the label text.

The component does not draw a selector focus border, drop indicators or tree wires. See "Not drawn".

## Metrics

| Property | Value | Source |
| --- | --- | --- |
| Row height | min 20px | `Editor/SceneOutliner/Public/SceneOutlinerPublicTypes.h:222` (`RowHeight()`), applied at `SOutlinerTreeView.cpp:298` |
| Row padding | 0 | `Runtime/Slate/Public/Widgets/Views/STableRow.h:94` (`_Padding( FMargin(0) )`) |
| Label slot left padding | 6px | `SOutlinerTreeView.cpp:304` |
| Indent per level | 12px | `SOutlinerTreeView.cpp:306` (`IndentAmount(12)`); padding formula `Runtime/Slate/Private/Widgets/Views/SExpanderArrow.cpp:179-184` |
| Arrow size | 16x16, button content padding 0 | `StarshipCoreStyle.cpp:2072-2075` (`Icon16x16`), `SExpanderArrow.cpp:41` |
| Arrow slot on a leaf | kept, arrow hidden | `SExpanderArrow.cpp:175` (`EVisibility::Hidden`) |
| Icon box | 16x16, margin 0 6 0 1 -> `1px 6px 1px 0` (top right bottom left) | `SceneOutlinerPublicTypes.h:223-224`; used at `ActorTreeItem.cpp:77-88`, `ActorFolderTreeItem.cpp:62-71` |
| Font | Roboto Regular 10pt = 13.333px | `StarshipCoreStyle.cpp:36`, `:1170-1172` |
| Even row fill | `--recessed` #1A1A1A | `StarshipCoreStyle.cpp:2068` |
| Odd row fill | `--background` #151515 | `StarshipCoreStyle.cpp:2069` |
| Hovered fill (any parity) | `--select-hover` #242424 | `StarshipCoreStyle.cpp:2002,2005` (via `STableRow.h:1029-1038`) |
| Selected, tree focused | `--select` #0070E0, stays on hover | `StarshipCoreStyle.cpp:2009-2010`; choice at `STableRow.h:988-995` |
| Selected, tree not focused | `--select-inactive` #40576F, stays on hover | `StarshipCoreStyle.cpp:2012-2013`; `STableRow.h:996-1001` |
| Parent of a selected row | `--select-parent` #2C323A; hover falls back to the hovered even/odd fill | `StarshipCoreStyle.cpp:2015-2016`; `STableRow.h:1003-1017`; set by `STreeView.h:512-539` |
| Text, normal | `--foreground` #C0C0C0 | `StarshipCoreStyle.cpp:2018` |
| Text, selected | `--foreground-hover` #FFFFFF | `StarshipCoreStyle.cpp:2019`; `STableRow.h:1185-1206` |
| Text, non-interactive item | linear 0.15 grey = about #6C6C6C | `SceneOutlinerStandaloneTypes.cpp:18` (`DarkColor`), used at `:40-43` |
| Arrow tint | brush `--foreground` x subdued foreground (row foreground at alpha 0.6) | `StarshipCoreStyle.cpp:2072`, `SExpanderArrow.cpp:47`, `Runtime/SlateCore/Private/Types/WidgetStyle.cpp:11` |
| Hovered arrow tint | brush `--foreground-hover` x the same subdued foreground | `StarshipCoreStyle.cpp:2073,2075`, `SExpanderArrow.cpp:194-209` |
| Folder icon tint | `--accent-folder` x row foreground | `Editor/EditorStyle/Private/StarshipStyle.cpp:1140`, `ActorFolderTreeItem.cpp:70` |

## Arrow colour in CSS

The engine multiplies the brush tint by the subdued foreground in linear space. In sRGB that is close to 75% of the foreground, at 60% opacity. The CSS uses `color-mix(in srgb, var(--foreground) 75%, #000)` and `opacity: .6`. A pixel sample of the reference screenshot supports it (arrow about #646464 on #1A1A1A). The 75% factor and the same factor on the folder tint are derived, not read from source.

## Not drawn

- Selector focus border: `Common/Selector` border, 4/16 margin, tinted `SelectorColor` (user colour, default linear 0.701, 0.225, 0.003). Drawn only for keyboard-selector focus: `STableRow.h:331-340`, `StarshipCoreStyle.cpp:2007`, `:62`.
- Drop indicators: boxes with 10/16 and 4/16 margins tinted `SelectionColor` (default #18A0FB): `StarshipCoreStyle.cpp:2021-2023`, `:63`.
- Tree wires: 2px, off by default (`SExpanderArrow.cpp:56`, `STableRow.h:204`).

## Do

- Alternate `--recessed` and `--background` by row index. The reference screenshot of the real editor shows both parities at #1A1A1A, the 5.5.3 and 5.8.1 source set odd rows to `--background`. The source wins here.
- Tint a parent of the selection with `--select-parent` and nothing else. It is not drawn when the parent is itself selected.
- Keep the arrow slot on leaf rows so labels line up.
- Use the same row for the hover state on odd and even rows. Only the idle fill alternates.

## Don't

- Do not add a hover fill to a selected row. Selected rows keep `--select` or `--select-inactive` on hover.
- Do not use `--select` for a tree that does not have keyboard focus.
- Do not put padding on the row. Indentation and icon margins carry all the spacing.
- Do not draw an ellipsis. Slate clips overflowing labels.

## Icons

The Starship SVG files are not available. The preview draws approximate 16x16 caret, folder and cube icons.
