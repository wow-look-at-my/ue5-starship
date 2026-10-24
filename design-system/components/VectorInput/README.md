# VectorInput

A Details property row for Location, Rotation or Scale: a type dropdown on the left. Three spin boxes with a coloured X / Y / Z edge, a reset arrow on the right, and a uniform-scale lock on the Scale row.

## What the consumer provides

- The row label for the dropdown and the menu behind it (Relative / World).
- numbers (or "multiple values") and change / commit handlers. Spinning is enabled only for a single selected object.
- Whether the value differs from default. When it does, the reset arrow shows. When it does not, the slot stays empty but keeps its width.
- For Scale: the lock state. Checked means locked and shows the closed padlock.

Rotation uses the same layout with Roll, Pitch, Yaw in red, green, blue. Its values carry a degree sign when unit display is on.

Icons in `preview.html` are 16x16 stroke approximations. The Starship SVG files are not in the source tree.

## Metrics

| Part | Value | Source |
|---|---|---|
| Row height | min 26 plus a 1px `--recessed` line below | `SDetailSingleItemRow.cpp:732-738`, `PropertyEditorConstants.h:28` |
| Columns | name 40%, value 60%, right column min 22, 1px `--recessed` splitters | `DetailsViewArgs.h:134-135`, `SDetailSingleItemRow.cpp:426-431,674-678` |
| Row fill | `--panel`, hovered row `--header` | `PropertyEditorConstants.cpp:25-57` |
| Name offset | 20: arrow slot 2 + 16, name slot 2 | `SDetailSingleItemRow.cpp:503-531` |
| Value cell padding | 12 left, 2 right | `SDetailSingleItemRow.cpp:39,553` |
| Value width limits | min and max 375 (3 x 125); fields shrink in a narrower panel | `ComponentTransformDetails.cpp:475-476` |
| Dropdown | ComboButton style: `--input` fill, radius 4, 1px `--input-outline`, hovered `--hover` | `StarshipCoreStyle.cpp:1470-1473,1494` |
| Dropdown padding | button padding 8,1,8,1, content padding 0 | `StarshipCoreStyle.cpp:1479`, `CoreStyle.h:114`, `ComponentTransformDetails.cpp:213` |
| Dropdown label | box min width 50, right padding 2, Small 8pt = 10.667px | `ComponentTransformDetails.cpp:221-229`, `StarshipStyle.cpp:3122` |
| Dropdown arrow | 16px wide chevron, padding 2 on each side; control height 22 | `StarshipCoreStyle.cpp:1491`, `SlateTypes.cpp:165` |
| Dropdown colour | `--foreground`, hovered `--foreground-hover` | `StarshipCoreStyle.cpp:1475-1476` |
| Scale lock | TransparentCheckBox, left slot gap 4, style padding 2 left, 16px icon | `ComponentTransformDetails.cpp:232-251`, `StarshipCoreStyle.cpp:1604-1622`, `SlateTypes.cpp:24` |
| Lock colour | `--foreground`; hovered and checked `--foreground-hover` | `StarshipCoreStyle.cpp:1615-1620` |
| Field layout | three equal slots, no gap | `SVectorInputBox.h:425-464` |
| Field box | `--input` fill, radius 4, 1px outline: `--input-outline`, hovered `--hover`, dragging or editing `--primary` | `StarshipCoreStyle.cpp:598-600,609-612`, `CoreStyle.h:117-118` |
| Field text | Small 8pt, `--foreground-hover`, padding 7,2.5,7,2.5, left aligned | `ComponentTransformDetails.cpp:422,491`, `StarshipCoreStyle.cpp:605-606`, `SSpinBox.h:294-305` |
| Field height | text line + 5; the 26px row centres it | `SSpinBox.h:294-305` |
| Edge bar | 2px wide, inset 3 from left, top and bottom; radius 1 is an approximation | `SVectorInputBox.h:454-455`, `SNumericEntryBox.h:332-338,448-457`, `StarshipCoreStyle.cpp:626` |
| Edge colours | X `#cb2600`, Y `#67a900`, Z `#2c7eed` (linear 0.594/0.0197/0, 0.1349/0.3959/0, 0.0251/0.207/0.85) | `SNumericEntryBox.h:813-819`, `SRotatorInputBox.h:171,207,243` |
| Reset arrow | extension toolbar button, padding 2, 16px icon = 20x20; `--foreground`, hovered `--foreground-hover` | `SDetailSingleItemRow.cpp:627-672`, `StarshipStyle.cpp:3120,3277-3283,3302` |

The edge colours are literal linear colours in source, not FStyleColors entries. Source colours were converted to sRGB with the exact piecewise transform.

## Do

- Keep the fields flush. The rounded corners and 1px outlines make the visual gap.
- Show the edge bar for each axis even on a disabled box.
- Reserve the reset slot on every row so the fields line up.

## Don't

- Do not fill the whole label area with colour. The coloured part is the thin 2px bar, not a labelled cell.
- Do not use theme tokens for the edge colours. They are fixed per axis.
- Do not let the dropdown stretch to the full name column. The reference screenshot shows it at its desired width, about 86px. Source gives the slot FillWidth, so check this in-engine before relying on either.
