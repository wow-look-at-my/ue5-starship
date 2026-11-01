The body of the Place Actors panel: a pill search field, a strip of category icon buttons with one active, a section label. A list of draggable item rows.

## Composed from

| Primitive | Count | Role |
|---|---|---|
| `ue-text-input` with `textinput--search` | 1 | The pill search field. It owns the glass, the clear button, Escape and the hint |
| `ue-segmented-control` with `SegmentedControl--rail` | 1 | The category strip. Add `SegmentedControl--row` for the wrapping arrangement of the screenshot |

The composite adds the section label, the list body and the item rows (`.placeActors-row`). It listens to `ue-text-input` for the filter and to `ue-segment-change` for the category. It draws no search box and no category button.

## What the consumer provides

- The panel width and height. The list scrolls inside the Recessed body.
- Category segments (`.SegmentedControl-seg` with `data-value`, one has `.is-checked`), the section label text (the active category name) and one `.placeActors-row` per item with an icon, a name and an end widget.
- Icons as inline SVG: 20x20 for categories and tiles, 16x16 for the info button. The Starship SVG files are not in the source tree, so `preview.html` draws simple stroke icons that only approximate them. Real item tiles show a class thumbnail brush, which the preview replaces with a 20px glyph.
- Which end widget to use: `.placeActors-info` (the "?" documentation anchor, as in the reference screenshot) or `.placeActors-handle` (the drag handle that `SPlacementAssetEntry` builds in 5.5.3 and 5.8.1).

## Two arrangements

The 5.5.3 source (`SPlacementModeTools.cpp:684-711`, `CategoryDrivenContentBuilderBase.cpp:139-147`) puts a vertical category rail (44px wide) left of the title and list. The reference screenshot shows the same buttons as a wrapping horizontal strip above the label. The button look is same in both, so `preview.html` shows both arrangements: `SegmentedControl--rail` (source) and `SegmentedControl--rail SegmentedControl--row` (screenshot).

## Metrics

Citations: `SC` is `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`, `SS` is `Editor/EditorStyle/Private/StarshipStyle.cpp`, `PM` is `Editor/PlacementMode/Private/SPlacementModeTools.cpp`, `WR` is `Developer/WidgetRegistration/Private`.

| Part | Value | Source |
|---|---|---|
| Search block | Panel fill, padding 8 | `SC:437`, `PM:693` |
| Search field | pill (half-height radius), Input fill, outline Secondary 1px, hover Hover, focus Primary | `SC:1303-1305`, `Runtime/SlateCore/Public/Styling/SlateBrush.h:161-167` |
| Search field padding | 8, 3, 8, 4 | `SC:1289` |
| Search glass | 14x14, 4px left padding, left aligned | `SC:1315-1318` |
| Search hint | "Search Classes", foreground at alpha 0.35 | `PM:696`, `SlateEditableTextLayout.cpp:3563` |
| Category rail fill / padding | Panel / 4 | `SC:2200`, `SS:1772` |
| Category rail width | 44 | `CategoryDrivenContentBuilderBase.cpp:18` |
| Category button | 36x36, icon 20x20, icon padding 8, vertical spacing 2 + 2 | `SS:1784-1786`, `SS:1780`, `SS:4717-4725` |
| Category foreground normal / hover | Foreground / ForegroundHover | `SS:1753-1756` |
| Category hover fill | Dropdown, radius 4 | `SC:1631` |
| Category active | Primary fill, radius 4, 0.5px outline rgba(0,0,0,0.8), ForegroundHover; hover PrimaryHover | `SS:1750-1751`, `SS:1756` |
| Section label | Dropdown bar, Foreground text, Normal font, text starts 6px from the left, 4px above and below | `WR/Layout/Containers/HeaderAndBodyContainer.cpp:63-71`, `SimpleTitleContainer.cpp:17` |
| List body | Recessed behind a Panel grid with padding 8 | `HeaderAndBodyContainer.cpp:65`, `ColumnWrappingContainer.cpp:58-59` |
| Row cell | height 32, margin 4 horizontal, 2 vertical | `ColumnWrappingContainerTemplates.cpp:10`, `ColumnWrappingContainer.cpp:63` |
| Row fill / radius | Dropdown / 6 | `SS:4626` |
| Row outline normal / hover / pressed | Dropdown / Hover / Primary, 1px, radius 6 | `SS:4617-4619` |
| Tile | 20px wide box, margin 4, 4, 0, 4 | `PM:221`, `PM:226` |
| Name | Regular 10pt = 13.333px, white at alpha 0.9, padding 4, 0, 8, 1, ellipsis | `SS:4649-4650`, `PM:222`, `PM:286` |
| Info button | 24x20 (16px icon, padding 2, 1 from the button style plus 2, 1 content padding), hover Dropdown radius 4 | `SDocumentationAnchor.cpp:63`, `SC:1405-1407`, `ToolWidgetsStyle.cpp:19`, `ToolWidgetsStylePrivate.h:24-25` |
| Drag handle | 6x15, 8px right margin | `SC:466`, `PM:211` |

## Do

- Mark exactly one category active. The label shows its name.
- Keep the row hover change to the outline. The fill stays Dropdown.

## Don't

- Do not tint the active category with the orange selection colour. It is Primary.
- Do not show the info button and the drag handle in the same row. They are alternatives.

## Live behaviour

`<ue-place-actors-panel>` (`src/PlaceActorsPanel/PlaceActorsPanel.ts`, built to `PlaceActorsPanel.js`) wraps a `.placeActors`. Each `.SegmentedControl-seg` carries `data-value` with the category name, and each `.placeActors-group` holds the rows of the same category.

- A category change (`ue-segment-change`, by click or by Left, Right, Home and End on the strip) shows its group and writes the name into the section label. `ue-category-change` repeats it with `{ category }`.
- The search field is the real input of the `ue-text-input`. Typing (`ue-text-input`) hides the rows of the shown group whose name does not contain the text. The clear X and Escape belong to the text input. A message shows when no row matches.
- Rows show the hover and pressed outlines through `:hover` and `:active`. The info button fills Hover on hover.
- Double click or Enter on a row fires `ue-place` with `{ name }`.
- The live panel lists the built-in categories of `PlacementModeModule.cpp:130-290`. The Basic, Lights, Shapes and Visual Effects items are factories registered there (`PlacementModeModule.cpp:150-260`). The Recent, Volumes and All items are illustrative, because the engine fills them at run time. The clapperboard category of the reference screenshot is not in this module and is left out of the live panel.
- Search filters only the shown category. The engine search spans every category. This is a simplification.
- A panel in `<ue-place-actors-panel data-pinned>` (the forced-state specimens) runs no setup and ignores the pointer.

## Not found in source

- The screenshot shows the label as "BASIC" in capitals and bold. The 5.5.3 and 5.8.1 source draws plain Normal text from `FSimpleTitleContainer` (`SimpleTitleContainer.cpp:17`). That is what the preview uses.
- The screenshot rows are about twice as tall as the 32px cell in source and the tile is larger. The source cell height is used here.
- The header of the tab of the Place Actors dock belongs to the docking components.
- The Starship category and class icons are SVG files not in the tree.
