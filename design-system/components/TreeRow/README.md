# TreeRow

This is a 20px-tall table or tree row with a caret expander, a 16px icon and a label. By hover, the 20px-tall table is tinted, selection and parent-of-selection state (UE 5.5.3 Starship, `TableView.AlternatingRow` as the Scene Outliner uses it).

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
