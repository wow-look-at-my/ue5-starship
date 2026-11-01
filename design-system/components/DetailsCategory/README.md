# DetailsCategory

The collapsible category header of the Details panel, expanded and collapsed, plus the property row grid beneath it: name column, value column, reset column. This also covers 26px rows with a 1px line between them.

## What the consumer provides

- The category title and its expanded state. A click anywhere on the header row toggles it.
- Per row: the name text, the value widget, and optionally a reset-to-default action. A row with child rows shows its caret and indents the children by 16px per level.
- The details style. These values are the Classic layout, the default (`DetailsPanel.Style.EnableCardLayout` is false, `SDetailsView.cpp:35-39`). The Card layout adds 8px above each top-level category, rounds the header and pads the table (8 left, 8 right, 8 bottom).

Icons in `preview.html` are filled-triangle approximations of the Starship caret SVGs, which are not in the source tree. The text box, checkbox and combo in the preview rows are the generic Starship styles, shown to give the grid something to hold.

## Composed from

`src/DetailsCategory/DetailsCategory.css` holds only the layout of the tree: the category rows, the row grid, the indent and the fold states. The live panel nests other composites and primitives instead of copying them.

| Part | Nested element |
|---|---|
| Name area | `ue-details-header` |
| Search row | `ue-details-search-row` |
| Section pills | `ue-filter-pills`, tablist variant |
| Transform row | `ue-vector-input` ([VectorInput README](../VectorInput/README.md)) |
| Checkbox value | `ue-checkbox`, box only |
| Text value | `ue-text-input`, `textinput--small` |
| Number value | `ue-spin-box`, `spinbox--small` |
| List value | `ue-combo-button`, value mode, `combobutton--small`, with a `popupmenu--small popupmenu--combo` list |
| Reset arrow | `ue-reset-to-default` |

`ue-details-category` listens to the nested elements: `ue-search`, `ue-filter-change` and `ue-view-option` set the filter. `ue-reset`, `ue-text-input` and `ue-spin-change` keep the `differs` state of a row, which the modified view reads. A nested row names itself with `data-label` and takes part in the search and the folds. An `ue-asset-picker` row works the same way.

Enter ends a text edit and Escape restores the text from before it. That commit rule belongs to the row, because `ue-text-input` has none.

Parts are not primitives. The category header and the Advanced row keep their own markup, because they are not an `ExpandableArea`. The Slate widget is a table row (`SDetailCategoryTableRow`) with a `--header` fill, a 26px minimum height, a `--foreground-header` title and Left and Right keys. `ExpandableArea` has a `--panel` surface, a white title and no fill. The category also forces its rows open while a search runs, which a fold state held in the primitive cannot do. The row caret keeps its own markup for the same reason: `SDetailExpanderArrow` hides it on rows without children and indents the children.

## Metrics

| Part | Value | Source |
|---|---|---|
| Table background | `--recessed`; rows show it as a 1px line under each row | `StarshipStyle.cpp:3251`, `SDetailsView.cpp:430-436` |
| Category row | min height 26, fill `--header`; same when collapsed and when hovered | `SDetailCategoryTableRow.cpp:149-158`, `StarshipStyle.cpp:3188`, `DetailsViewStyle.cpp:272-294` |
| Category border | 1px bottom line; top padding 0 (Classic), 8 (Card) | `SDetailCategoryTableRow.cpp:139-144`, `DetailsViewStyle.cpp:241-246,302-308` |
| Caret | 16px, left margin 2; collapsed points right, expanded points down | `SDetailCategoryTableRow.cpp:68-84`, `StarshipCoreStyle.cpp:2072-2075` |
| Caret colour | `--foreground` at 60% opacity; hovered `--foreground-hover` at 60% | `SDetailExpanderArrow.cpp:30`, `WidgetStyle.cpp:11`, `StarshipCoreStyle.cpp:2072-2075` |
| Title | Small bold 8pt = 10.667px, `--foreground-header`, left margin 4 | `StarshipStyle.cpp:3265-3269`, `SDetailCategoryTableRow.cpp:88-97` |
| Property row | min height 26 plus 1px `--recessed` line | `SDetailSingleItemRow.cpp:732-738`, `PropertyEditorConstants.h:28` |
| Row fill | `--panel`; hovered `--header`; highlighted `--hover` with a 1px `--accent-blue` outline | `PropertyEditorConstants.cpp:25-57`, `SDetailSingleItemRow.cpp:850-870`, `StarshipStyle.cpp:3240` |
| No alternating rows | every level-0 row uses the same fill | `SDetailSingleItemRow.cpp:857,871` |
| Nested rows | indent 16 per level; row fill steps up by 4, 6, 10, 6, 4 sRGB units per level | `SDetailRowIndent.cpp:66`, `PropertyEditorConstants.cpp:27-54` |
| Columns | name 40%, value 60%; right column min 22; 1px `--recessed` splitters | `DetailsViewArgs.h:134-135`, `SDetailsView.cpp:81-82`, `SDetailSingleItemRow.cpp:426-431` |
| Name offset | indent, then caret slot (2 + 16, hidden when no children), then name slot (2): text starts at 20 | `SDetailSingleItemRow.cpp:447-531`, `SDetailExpanderArrow.cpp:16,36-44` |
| Name text | Small 8pt = 10.667px, `--foreground` | `StarshipStyle.cpp:3122`, `DetailLayoutBuilder.h:46` |
| Value padding | 12 left, 2 right | `SDetailSingleItemRow.cpp:39,553` |
| Extension slot | 5px left gap after the value | `SDetailSingleItemRow.cpp:561` |
| Reset column | right aligned, centred, same fill as the row; arrow 20x20 | `SDetailSingleItemRow.cpp:674-688`, `StarshipStyle.cpp:3277-3283` |
| Advanced row | `--panel` row, 26px, regular-weight Small label in `--foreground-header`, caret as above | `DetailAdvancedDropdownNode.cpp:74-111` |
| Text box value | `--input`, radius 4, 1px `--input-outline`, padding 8,3,8,4, Small font | `StarshipCoreStyle.cpp:1282-1294`, `SPropertyEditorText.h:27` |
| Checkbox value | 18px, `--input`, radius 3, 1px `--secondary`, 16px check in `--primary` | `StarshipCoreStyle.cpp:1574,1591,1597-1599` |

Nested fill colours at 8-bit sRGB: level 1 `#282828`, level 2 `#2a2a2a`, level 3 `#2e2e2e`. Hovered rows start from `#2f2f2f` and add the same offsets: `#333333`, `#353535`, `#393939`.

## Do

- Hover colours the whole row, name, value and reset cells together.
- Keep the 1px line under every row, including the last row of a category.
- Reserve the 16px caret slot on rows without children so names line up at x = 20.

## Don't

- Do not tint the category header on hover. The top-level header keeps `--header`.
- Do not stripe rows. The `TableView.AlternatingRow` style is not used by the Details rows.
- Do not draw a border around property rows. The only lines are the 1px `--recessed` gaps and splitters.
- Do not use `--foreground-hover` for the resting caret. The reference screenshot sampled `#868686` for it, which matches `--foreground` at 60%.
