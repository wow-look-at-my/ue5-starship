# Core controls: constants used

All values read from `/home/user/UE553/Engine/Source` (UE 5.5.3 fork). Nothing is taken from the 5.8.1 checkout. Slate unit = 1px. Font px = pt x 96/72.

Abbreviations: `SCS` = `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`. This also covers `CS.h` = `Runtime/SlateCore/Public/Styling/CoreStyle.h`. This also covers `SME` = `Runtime/Slate/Private/Framework/MultiBox/SMenuEntryBlock.cpp`. This also covers `SNL` = `Runtime/Slate/Private/Widgets/Notifications/SNotificationList.cpp`.

## Shared

| Name | Value | File:line |
|---|---|---|
| InputFocusRadius | 4 | `CS.h:117` |
| InputFocusThickness | 1 | `CS.h:118` |
| ButtonMargins | (12, 1.5, 12, 1.5) | `CS.h:110` |
| PressedButtonMargins | (12, 2.5, 12, 0.5) | `CS.h:112` |
| ToggleButtonMargins | (16, 2) | `CS.h:113` |
| ComboButtonMargin | (8, 1, 8, 1) | `CS.h:114` |
| PressedComboButtonMargin | (8, 2, 8, 0) | `CS.h:115` |
| SButton default ContentPadding | (4, 2) | `Runtime/Slate/Public/Widgets/Input/SButton.h:42` |
| Button padding sum | content + style padding | `Runtime/Slate/Private/Widgets/Input/SButton.cpp:159-164` |
| Font Normal / Small / Large | 10pt / 8pt / 14pt Regular | `SCS:36, 40, 42` |
| Font NormalBold / SmallBold | 10pt / 8pt Bold | `SCS:38, 41` |
| Disabled look | alpha x 0.45 (legacy path off) | `Engine/Shaders/Private/SlateElementPixelShader.usf:535` |
| ShowEffectWhenDisabled default | true | `Runtime/Slate/Private/Widgets/Layout/SBorder.cpp:21` |
| Default widget foreground | white | `Runtime/SlateCore/Public/Styling/WidgetStyle.h:21` |
| Subdue amount | 0.6 (alpha) | `Runtime/SlateCore/Private/Types/WidgetStyle.cpp:11` |
| Focus ring (FocusRectangle) | transparent fill, 1px Primary, radius 4 | `SCS:218`; used `Runtime/SlateCore/Private/Widgets/SWidget.cpp:989-991` |
| Outline-only rounded brush rounding | HalfHeightRadius | `Runtime/SlateCore/Public/Styling/SlateBrush.h:161-166` |
| Size-only rounded brush rounding | half height (circle) | `Runtime/SlateCore/Public/Brushes/SlateRoundedBoxBrush.h` (size-only constructor), `SlateBrush.h:137-143` |

## Button

| Name | Value | File:line |
|---|---|---|
| Button normal / hover / pressed | Secondary / Hover / Header, radius 4, outline Input 1 | `SCS:1373-1375` |
| Button disabled brush | Dropdown, outline Recessed | `SCS:1376` |
| Button foregrounds | ForegroundHover x3, disabled Foreground | `SCS:1377-1380` |
| PrimaryButton normal / hover / pressed | Primary / PrimaryHover / PrimaryPress | `SCS:1357-1359` |
| PrimaryButtonLabelAndIcon padding | (4, 1.5) / pressed (4, 2.5, 4, 0.5) | `SCS:1368-1370` |
| SimpleButton brushes | none / Dropdown r4 / Dropdown r4 | `SCS:1390-1392` |
| SimpleButton foregrounds | Foreground / ForegroundHover x2 | `SCS:1394-1397` |
| SimpleButtonLabelAndIcon padding | (4, 1) / pressed (4, 2, 4, 0) | `SCS:1402-1403` |
| SimpleButtonIconOnly padding | (2, 1) / pressed (2, 2, 2, 0) | `SCS:1406-1407` |
| HoverOnlyButton padding | (2, 0) | `SCS:1453-1454` |
| ThinHoverOnlyButton padding | 0 | `SCS:1459-1460` |
| PrimaryButtonText | NormalBold | `SCS:1421` |
| SecondaryButton | same object as Button | `SCS:1426` |
| Legacy FlatButton.Danger linear colour | (0.70117, 0.08464, 0.07593), x0.8 / x1.0 / x0.6 | `Editor/EditorStyle/Private/StarshipStyle.cpp:575, 559-567` |

## ComboButton

| Name | Value | File:line |
|---|---|---|
| Button fill / outline | Input; InputOutline, Hover on hover and press | `SCS:1471-1473` |
| Disabled brush | Dropdown, outline DropdownOutline | `SCS:1474` |
| Foregrounds | Foreground normal; ForegroundHover hovered, pressed, disabled | `SCS:1475-1478` |
| ContentPadding | 0 | `SCS:1490` |
| Caret | 16x16 wide-chevron-down | `SCS:1491` |
| Caret padding / align | 2 / centre | `Runtime/SlateCore/Private/Styling/SlateTypes.cpp:165-166` |
| Menu border brush | Dropdown, radius 0, outline DropdownOutline 1 | `SCS:1492` |
| ComboBox MenuRowPadding | (8, 3) | `SCS:1503` |
| SimpleComboBox MenuRowPadding | (8, 2) | `SCS:1528` |
| ComboBox.Row hover brush | Primary, whole row | `SCS:1534-1547` |
| ComboBox.Row focus ring | transparent, Select 1px, radius 4 | `SCS:1539` |
| ComboBox.Row text colour | White | `SCS:1549-1550` |
| Click method | MouseDown | `Runtime/Slate/Private/Widgets/Input/SComboButton.cpp:35` |

## Checkbox

| Name | Value | File:line |
|---|---|---|
| Corner radius / outline | 3 / 1 | `SCS:1574-1575` |
| Box brush | Input fill; outline Secondary, Hover, Hover; 18x18 | `SCS:1597-1599` |
| Glyph | 16x16; Primary, PrimaryHover, PrimaryPress | `SCS:1591-1596` |
| Label foregrounds | ForegroundHover, all states | `SCS:1580-1586` |
| Default label padding | (2, 0, 0, 0) | `SlateTypes.cpp:24` |
| ToggleButtonCheckbox | checked Primary / PrimaryHover / Dropdown, r4; unchecked none / Dropdown / Dropdown; padding ToggleButtonMargins | `SCS:1625-1641` |
| ToggleButtonCheckboxAlt | Input / Hover brushes r4; checked foreground White | `SCS:1644-1657` |
| RadioButton | 16x16 SVG; Dropdown, Hover, Primary, PrimaryHover; padding 4 | `SCS:1730-1750` |

## TextInput

| Name | Value | File:line |
|---|---|---|
| EditableTextBox brushes | Input fill; outline InputOutline / Hover / Primary; read-only Header fill | `SCS:1284-1287` |
| Padding | (8, 3, 8, 4) | `SCS:1289` |
| Foregrounds | Foreground; focused White; read-only UseForeground | `SCS:1290-1293` |
| Hint alpha | 0.35 | `Runtime/Slate/Private/Widgets/Text/SlateEditableTextLayout.cpp:3563` |
| Caret width | clamp(0.08 x line height, 1, 2) | `Runtime/Slate/Private/Framework/Text/TextEditHelper.h:18`, `.cpp:17` |
| Caret brush / selection brush | White / Highlight | `SCS:1272, 1264` |
| SearchBox brushes | Input fill; outline Secondary / Hover / Primary; read-only Header; pill | `SCS:1303-1306` |
| SearchBox glass | 16x16 SVG shown 14x14; padding (4, 0, 0, 0); left aligned | `SCS:1313-1318` |
| SearchBox end spacer | 7 | `Runtime/Slate/Private/Widgets/Input/SSearchBox.cpp:172-177` |

## SpinBox

| Name | Value | File:line |
|---|---|---|
| Background brushes | Input fill r4; outline InputOutline / Hover / Primary (active) | `SCS:598-600` |
| Fill brushes | active Primary, hovered Hover, inactive Dropdown; r4 | `SCS:601-603` |
| Foreground / TextPadding / InsetPadding | ForegroundHover / (7, 2.5) / 1 | `SCS:605-607` |
| SSpinBox ContentPadding | (2, 1) | `Runtime/Slate/Public/Widgets/Input/SSpinBox.h:92` |
| Fill rectangle | width x fraction minus inset; offset inset | `SSpinBox.h:394-401` |
| NumericEntrySpinBox_Dark | active fill Hover, inactive Secondary, text padding 0 | `SCS:614-622` |
| Menu.SpinBox | outline Secondary; text padding (10, 3.5, 10, 4) | `SCS:2290-2299` |
| NarrowDecorator | 2x16 SVG | `SCS:626` |
| Axis colours (linear) | X (0.594, 0.0197, 0); Y (0.1349, 0.3959, 0); Z (0.0251, 0.207, 0.85) | `Runtime/Slate/Public/Widgets/Input/SNumericEntryBox.h:813-819` |
| Axis strip padding | LabelPadding 3 | `Runtime/Slate/Public/Widgets/Input/SVectorInputBox.h:454` |

## Slider

| Name | Value | File:line |
|---|---|---|
| Bar | Input fill, r2, outline Input 1; disabled outline Recessed | `SCS:574-576` |
| Thumb | 8x8 circle; Foreground, ForegroundHover, Foreground | `SCS:577-579` |
| BarThickness | 4 | `SCS:580` |
| Widget min size / height rule | 16x16; max(bar, thumb) | `Runtime/Slate/Private/Widgets/Input/SSlider.cpp:144-159` |
| Handle geometry | indent = handle width; bar from half handle | `SSlider.cpp:80-94`; `SSlider.h:29` |

## Tooltip

| Name | Value | File:line |
|---|---|---|
| ToolTip.Font | Regular 9pt | `SCS:493` |
| ToolTip.Background | Dropdown, r0, outline DropdownOutline 1 | `SCS:494` |
| ToolTip.LargerFont | Normal | `SCS:496` |
| ToolTip.BrightBackground | texture `Old/ToolTip_BrightBackground`, margin 8/64 | `SCS:497` |
| TextMargin default | 8 | `Runtime/Slate/Public/Widgets/SToolTip.h:30` |
| Text-only padding / colour | 11 / Black | `Runtime/Slate/Private/Widgets/SToolTip.cpp:76, 67` |
| Wrap width | 1000 | `SToolTip.cpp:9-12` |
| Command tooltip layout | description, 4px gap, subdued key binding | `Runtime/Slate/Private/Framework/Commands/UICommandInfo.cpp:177-189` |

## PopupMenu

| Name | Value | File:line |
|---|---|---|
| Menu.Background / Menu.Outline | Dropdown / transparent r0 outline DropdownOutline 1 | `SCS:2302-2303` |
| Menu box padding | (0, 8, 0, 8) | `Runtime/Slate/Private/Framework/MultiBox/MultiBox.cpp:1344` |
| Menu.Block.Padding | (12, 1, 5, 1) | `SCS:2314-2316` |
| Menu.Button | normal none; hover and pressed Primary; padding (0, 2) / (0, 3, 0, 1) | `SCS:2417-2426` |
| Menu.MenuIconSize | 14 | `SCS:2312` |
| Menu.Separator / padding | White25 / (12, 6, 12, 6); thickness 1 | `SCS:2318-2319`; `SMenuSeparatorBlock.cpp:51-56` |
| Menu.Heading / padding | 7pt Bold, LetterSpacing 250, White25 / (12, 6, 12, 6) | `SCS:2327-2334` |
| Letter spacing unit | spacing x size / 1000 | `Runtime/SlateCore/Private/Fonts/SlateTextShaper.cpp:412` |
| Menu.Keybinding | Small font | `SCS:2324` |
| Menu.SubMenuIndicator | 16x16 chevron-right | `SCS:2306` |
| Menu.Check | 16x16 check | `SCS:2342-2357` |
| Menu.RadioButton | 8x8 circles: Input, Hover2 pressed, White checked | `SCS:2390-2400` |
| Row cell paddings | check (2,0,8,0), content 2, icon (2,0,6,0), label (2,0,6,0), keys 25 + (16,0,4,0), arrow 7 | `SME:583-652, 934` |
| Check column width | shared across rows (linked box) | `Runtime/Slate/Public/Widgets/Layout/SLinkedBox.cpp:109-112` |
| WindowMenuBar | hover Hover; open Primary; padding (12, 4) | `SCS:2443-2448` |

## Notification

| Name | Value | File:line |
|---|---|---|
| ItemBackground_Border | Notifications fill, r5, outline Black 1 | `SCS:686` |
| FontBold / FontLight | Bold / Light 12pt | `SCS:682-683` |
| Throbber | 40x40 texture | `SCS:689` |
| Watermark | 128x128 SVG; drawn clamp(h x 2.5, 130, 220) at (4,4), clipped 2px | `SCS:691`; `SNotificationBackground.cpp:34-50` |
| Watermark tint | Notifications x 1.15 (linear) | `SNotificationBackground.cpp:13` |
| Padding | (16, 8) | `SNL:429` |
| Text slots | title; sub text (0,10,0,2); buttons (0,5,0,0), per button right 4 | `SNL:456-533` |
| Icon / gap / throbber pad | 32x32 / 10 / -6 | `SNL:566, 570, 267` |
| Defaults | width 320; fade in 0.5, fade out 2, expire 1 | `Runtime/Slate/Public/Widgets/Notifications/SNotificationList.h:140-146` |

## ExpandableArea

| Name | Value | File:line |
|---|---|---|
| Border | Panel, radius 4 | `SCS:568` |
| Caret images | 16x16 caret-right / caret-down, DefaultForeground | `SCS:564-565` |
| TitleFont | SmallBold | `SCS:567` |
| HeaderPadding / AreaTitlePadding / Padding | (4, 2) / (0, 0, 3, 0) / 1 | `Runtime/Slate/Public/Widgets/Layout/SExpandableArea.h:40-42` |
| Rollout | 0.1s cubic ease out | `SlateTypes.cpp:402` |

## Not found, not available, or derived

- Starship SVG icons (check, indeterminate, chevrons, search, close, caret, status icons, watermark): files are not in the checkout. Every icon in the previews is a hand-drawn approximation.
- Textures: `Old/ToolTip_BrightBackground`, `Starship/Notifications/Throbber`, `Common/FlatButton`. The bright tooltip surface colour is unknown. The preview uses `--foreground` as a stand-in and labels it.
- Roboto font files are not in the checkout (`Engine/Content/Slate` is absent). Line boxes (16px for 13.33px text, 14px for 12px, 19px for 16px bold, 13px for 10.67px bold) are derived from Roboto metrics (about 1.17 em), not read from source. Derived heights: button 23, combo 22, text input 23, spin box 23, menu row 22, expandable header 20.
- No `DangerButton` exists in the Starship styles. Only the legacy texture `FlatButton.Danger` exists. It is documented but not drawn.
- Text colours that the source leaves as "use the inherited foreground" (read-only text, notification text, expandable-area title, tooltip text) are drawn white or `--foreground` following the widget-style default. The parent that sets the real value was not traced.
- The transparent outline on spin box fill brushes (`SCS:601-603`) is not modelled. The engine may blend the 1px edge.
- ComboButton has no separate open-state brush. The preview shows the pressed look.
