# AssetPicker

A Details property value for an asset reference. A 48px thumbnail on the left. A combo button with the asset name on top of it, and a row of use-selected and browse icon buttons below.

## What the consumer provides

- The asset thumbnail image, drawn at 48x48, and the asset-type colour for the 2px strip along its bottom edge.
- The asset name (the combo shows it, ellipsized) and the assets the menu lists, as `ue-asset-list` rows with `data-id` and `data-path`.
- Handlers for use-selected and browse. Both buttons are optional. Extra buttons from the asset definition are appended after them at the same 22px size.
- Whether the value differs from default (reset arrow in the right column).

The thumbnail in `preview.html` is a placeholder. The drop shadow is a raster brush in source, so the preview approximates it with a CSS shadow. Icons are 16x16 stroke approximations of the Starship SVGs, which are not in the source tree.

## Composed from

`src/AssetPicker/AssetPicker.css` holds only the row layout and the thumbnail. The thumbnail has no primitive: it is a 48px image with a colour strip and a drop shadow. Every control is a primitive.

| Part | Primitive | Count |
|---|---|---|
| Asset combo | `ue-combo-button mode="action"`, `combobutton--small`, `combobutton-anchor--fill`, with the menu below in its `ue-popup-menu` | 1 |
| Menu entries and headings | `popupmenu__heading`, `popupmenu__row` with `popupmenu__icon` | 4 rows, 2 headings |
| Browse section | a `popupmenu__widget` that holds `.AssetPicker-browse` | 1 |
| Search box | `ue-text-input`, `textinput--search`, `data-autofocus` on the input | 1 |
| Other-developers filter | `ue-checkbox`, `checkbox-toggle checkbox-toggle--icon` | 1 |
| View options | `ue-combo-button`, `combobutton--simple` with one `combobutton__icon` and no arrow, `combobutton-menu--end`, a `ue-popup-menu` of radio, check and submenu rows | 1 |
| Asset list | `ue-asset-list` with its `ue-header-row` and `ue-scrollbar` | 1 |
| Use selected, Browse | `ue-button`, `button--simple button--icon` | 2 |
| Reset arrow | `ue-reset-to-default`. The component sets `differs` while the value is not the row `data-default` | 1 |

`ue-asset-picker` listens to the primitives. It keeps `data-value` of the row, the combo label, the thumbnail tooltip, the list selection and the reset arrow in step. It announces `ue-asset-change` with `{ asset }`, `ue-asset-browse` with `{ asset }` and `ue-asset-edit` with `{ asset }`. Use selected picks the row `data-selection`. Reset and Clear pick `data-default` and None.

## The menu (SPropertyMenuAssetPicker)

The combo opens the menu that `SPropertyEditorAsset::OnGetMenuContent` builds with `PropertyCustomizationHelpers::MakeAssetPickerWithMenu` (`SPropertyEditorAsset.cpp:915-944`, `PropertyCustomizationHelpers.cpp:609-612`). `SPropertyMenuAssetPicker::Construct` fills an `FMenuBuilder` on the core style (`SPropertyMenuAssetPicker.cpp:24-181`):

| Section | Entries | Source |
|---|---|---|
| Create New Asset | one entry per new-asset factory. A Static Mesh property has none, so the preview leaves it out | `:47-64` |
| Current Asset | Edit (`Icons.Edit`, only while a value is set), Copy (`GenericCommands.Copy`), Paste (`GenericCommands.Paste`, disabled until the clipboard holds an asset), Clear (`GenericCommands.Delete`) | `:66-109`, `:297-337` |
| Browse | one widget with no label: an `SBox` of `ContentBrowserWindowSize` 300 x 300 around the content browser asset picker | `:111-175`, `PropertyEditorAssetConstants.h:8` |

Edit, Copy, Paste, Clear and a pick each close the menu (`:216-358`). The clipboard is one per page, as `FPropertyEditorClipboard` is one per editor.

The asset picker in the Browse section (`SAssetPicker.cpp:71-401`) with the config of `SPropertyMenuAssetPicker.cpp:115-161`:

- A search row with slot padding 8,0,8,8: the search box (hint `Search Assets`) fills the row, the other-developers toggle follows with slot padding left 4 and content padding 4. Then the view-options combo (`SimpleComboButton`, `Icons.Settings`, no arrow). `bAddFilterUI` is false by default, so there is no filter button (`IContentBrowserSingleton.h:338`, `SAssetPicker.cpp:146-235, 371-382`).
- The search box takes the focus when the menu opens (`bFocusSearchBoxWhenOpened`, `SAssetPicker.cpp:98-101`). Typing filters the list by name. Up and Down move the list selection with wrap. Enter picks the selection, else the first row (`SAssetPicker.cpp:419-447, 504-518`). Escape clears a filled search box first and closes the menu after.
- The asset view in list mode (`InitialAssetViewType = EAssetViewType::List`) with its bottom toolbar: the item count. See `components/AssetList/README.md`.
- The view options are the `ContentBrowser.AssetViewOptions` menu: View Type, View, Content, Search and Thumbnails (`SAssetView.cpp:3838-4135`, `ContentBrowserMenuUtils.cpp:203-277`). Show Folders and Show Empty Folders are disabled because a property picker cannot show folders (`bCanShowFolders` false, `SAssetView.cpp:4189-4192`). Show Engine Content adds the `/Engine/` rows. The other options only change their own check.
- Each open rebuilds the menu in Slate (`SPropertyEditorAsset::OnMenuOpenChanged`). The search starts empty and the list selects the current value.

Menu metrics come from the primitives: heading and row padding from `PopupMenu`, the 1px padding of a widget block with no label (`SWidgetBlock.cpp:121-131`) from `popupmenu__widget`. The menu is 302 wide: 300 plus 1 on each side.

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
