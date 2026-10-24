# AssetPicker

A Details property value for an asset reference. A 48px thumbnail on the left. A combo button with the asset name on top of it, and a row of use-selected and browse icon buttons below.

## What the consumer provides

- The asset thumbnail image, drawn at 48x48, and the asset-type colour for the 2px strip along its bottom edge.
- The asset name (the combo shows it, ellipsized) and the menu behind the combo.
- Handlers for use-selected and browse. Both buttons are optional. Extra buttons from the asset definition are appended after them at the same 22px size.
- Whether the value differs from default (reset arrow in the right column).

The thumbnail in `preview.html` is a placeholder. The drop shadow is a raster brush in source, so the preview approximates it with a CSS shadow. Icons are 16x16 stroke approximations of the Starship SVGs, which are not in the source tree.

## Metrics

| Part | Value | Source |
|---|---|---|
| Row height | min 26 plus 1px line; a thumbnail row measures 3 + 54 + 1 = 58 | `SDetailSingleItemRow.cpp:732-738`, `SPropertyEditorAsset.cpp:613-648` |
| Thumbnail image | 48 x 48 | `SPropertyEditorAsset.h:62`, `SPropertyEditorAsset.cpp:632-636` |
| Thumbnail frame | 1px inset around the image, outline brush over it: 50 x 50 | `SPropertyEditorAsset.cpp:623-646` |
| Frame outline | transparent fill, radius 4, 1px `--input-outline`; hovered `--hover-2` | `StarshipStyle.cpp:3021-3022` |
| Drop shadow | box brush with margin 4/64, padding right 4 and bottom 4 | `StarshipStyle.cpp:3023`, `SPropertyEditorAsset.cpp:620-621` |
| Thumbnail slot gap | top 3, right 5 | `SPropertyEditorAsset.cpp:614` |
| Colour strip | 2px along the bottom edge, asset-type colour | `AssetThumbnail.cpp:1050-1054,349-356` |
| Combo | ComboButton style: `--input` fill, radius 4, 1px `--input-outline`, hovered `--hover`; button padding 8,1,8,1; arrow 16 + padding 2; height 22 | `StarshipCoreStyle.cpp:1470-1494`, `CoreStyle.h:114`, `SlateTypes.cpp:165` |
| Combo label | Small 8pt = 10.667px, left aligned, fills the free width | `SPropertyEditorAsset.cpp:547-573`, `StarshipStyle.cpp:3122` |
| Combo and buttons | stacked, vertically centred next to the thumbnail | `SPropertyEditorAsset.cpp:651-677` |
| Button strip | wrapper padding 0,2,4,2 | `SPropertyEditorAsset.cpp:670-673` |
| Icon button | 22 x 22 box with slot padding 2,0; the SimpleButton inside is 20 x 18 | `SPropertyEditorAsset.cpp:721-748`, `PropertyCustomizationHelpers.cpp:74-91` |
| Icon button style | SimpleButton, content padding 0 + (2,1); icon 16px `UseForeground`; hover `--dropdown` radius 4 | `StarshipCoreStyle.cpp:1389-1407` |
| Icons | `Icons.Use` (use selected), `Icons.BrowseContent` (browse) | `StarshipStyle.cpp:423-424`, `PropertyCustomizationHelpers.cpp:172,526` |
| Reset arrow | 20 x 20 extension button in the right column, 16px icon | `StarshipStyle.cpp:3120,3277-3283` |

## Do

- Put the combo first and the icon buttons under it, left aligned with the combo.
- Draw the outline over the thumbnail, not around the 48px image, so it hugs the image with a 1px gap.
- Keep the type-colour strip even when the thumbnail is a placeholder.

## Don't

- Do not use this layout without a thumbnail. Actors and assets with the thumbnail turned off put the buttons on the same line as the combo, with a 4px side gap.
- Do not tint the icons. They follow the button foreground.
- Do not hard-code the strip colour. It comes from the asset class. The preview uses `#29f1f2` sampled from the reference screenshot because the class colour is not in this source tree.
