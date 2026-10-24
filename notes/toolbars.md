# Toolbars, menu bar, Place Actors panel, status bar: constants

All paths are under `/home/user/UE553/Engine/Source` (UE 5.5.3 fork). No value comes from the 5.8.1 checkout. It was used only to confirm that `SPlacementModeTools.cpp` has the same layout there.

Abbreviations: `SC` Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp, `SS` Editor/EditorStyle/Private/StarshipStyle.cpp, `CS` Runtime/SlateCore/Public/Styling/CoreStyle.h. This also covers. `PM` Editor/PlacementMode/Private/SPlacementModeTools.cpp, `SB` Editor/StatusBar/Private/SStatusBar.cpp, `WD` Developer/ToolWidgets/Private/SWidgetDrawer.cpp, `SU` Editor/StatusBar/Private/StatusBarSubsystem.cpp. `MB` Runtime/Slate/Private/Framework/MultiBox/MultiBox.cpp, `WR` Developer/WidgetRegistration/Private.

## Shared

| Constant | Value | File:line |
|---|---|---|
| Normal font | Roboto Regular 10pt = 13.333px | SC:36 |
| Small font | Regular 8pt = 10.667px | SC:40 |
| Icon sizes | 16, 20, 40 | CS:94, 96, 102 |
| ButtonMargins / PressedButtonMargins | (12,1.5) / (12,2.5,12,0.5) | CS:110-112 |
| ComboButtonMargin | (8,1,8,1) | CS:114 |
| InputFocusRadius / InputFocusThickness | 4 / 1 | CS:117-118 |
| FComboButtonStyle default DownArrowPadding | 2 | Runtime/SlateCore/Private/Styling/SlateTypes.cpp:165 |
| FToolBarStyle default separator thickness | 2 | Runtime/SlateCore/Private/Styling/ToolBarStyle.cpp:25 |
| SimpleButton hover/press | Dropdown, radius 4 | SC:1391-1392 |
| SimpleButtonLabelAndIcon padding | (4,1,4,1), pressed (4,2,4,0) | SC:1401-1403 |
| SimpleButton (icon only) padding | (2,1,2,1), pressed (2,2,2,0) | SC:1405-1407 |
| ComboButton button look | Input fill, InputOutline, radius 4, 1px; padding ComboButtonMargin | SC:1470-1480 |
| ComboButton / SimpleComboButton arrow | 16x16 wide chevron | SC:1491, 1517 |
| ToggleButtonCheckbox fills | checked Primary, hover PrimaryHover, pressed Dropdown, unchecked hover Dropdown, radius 4 | SC:1625-1639 |
| NoBorder button | no fill, fg ForegroundHover, padding 0 | SC:233-241 |
| NormalEditableTextBox | Input / InputOutline / Hover / Primary, radius 4, padding (8,3,8,4), fg Foreground | SC:1282-1294 |
| Hint text alpha | 0.35 | Runtime/Slate/Private/Widgets/Text/SlateEditableTextLayout.cpp:3563 |
| Pill brush rounding | HalfHeightRadius when no radius is given | Runtime/SlateCore/Public/Styling/SlateBrush.h:161-167 |
| Theme colours | Panel `#242424`, Dropdown `#383838`, Recessed `#1a1a1a`, Hover `#575757`, Primary `#0070e0`, PrimaryHover `#0e86ff`, AccentGreen `#8bc24a`, AccentRed `#ff4040` | Runtime/SlateCore/Private/Styling/StyleColors.cpp:80-129 |

## MenuBar

| Constant | Value | File:line |
|---|---|---|
| Style name | WindowMenuBar | Runtime/Slate/Public/Framework/MultiBox/MultiBoxBuilder.h:477 |
| Background | none | SC:2443 |
| Label style | NormalText with Normal font | SC:2444 |
| Item padding | (12,4) | SC:2448 |
| Normal / hover / pressed foreground | Foreground / ForegroundHover / ForegroundHover | SC:2437-2439 |
| Hover fill | Hover colour brush | SC:2436 |
| Menu open fill | Primary colour brush (Pressed, via MenuButton) | SC:2420, SC:2447; state choice SMenuEntryBlock.cpp:1614-1616 |
| Button opens on | mouse down | Runtime/Slate/Private/Framework/MultiBox/SMenuEntryBlock.cpp:276 |

## ToolBar (SlimToolBar, AssetEditorToolbar, CalloutToolbar)

| Constant | Value | File:line |
|---|---|---|
| Background / padding | Panel / (4,6) | SC:2200-2205; applied at MB:1349-1350 |
| Icon size | 20x20 | SC:2240 |
| Button padding (outer) | (4,0) | SC:2208 |
| Button padding (inner) / pressed | (8,4,8,4) / (8,5,8,3) | SC:2193-2194 |
| Foregrounds | normal Foreground, hover/press ForegroundHover | SC:2189-2192 |
| Check box padding (outer) / toggle inner padding | (8,0) / (8,4,8,4) | SC:2209, 2217-2218 |
| Combo padding (outer) | (0,0) | SC:2207 |
| Combo arrow padding | (1,0,2,0) | SC:2198 |
| Separator | Recessed, thickness 2, padding (4,-5) | SC:2210-2211 |
| Label padding | (4,0,0,0) | SC:2214 |
| AssetEditorToolbar | labels hidden | SC:2265-2267 |
| CalloutToolbar | labels shown | SC:2280-2282 |
| Button block layout (icon, label) | icon padding IconPadding (0), label padding LabelPadding | Runtime/Slate/Private/Framework/MultiBox/SToolBarButtonBlock.cpp:287-307 |
| Block padding applied | ButtonPadding on the button block | SToolBarButtonBlock.cpp:470 |
| Mode combo | plain SComboButton, 16px icon, 6px gap | Editor/LevelEditor/Private/LevelEditorToolBar.cpp:1404-1424 |
| Settings block | 7px right padding, Callout style | LevelEditorToolBar.cpp:1528, 1639 |
| Play plate (left) | Dropdown, corners (4,0,0,4), padding (8,2,6,2), ButtonPadding (10,0,0,0), separator padding (0,0,8,0) | SS:5519-5530 |
| Play foreground | normal AccentGreen; hover/press from HSV (S*0.5, V*0.5) | SS:5535-5544 |
| Computed Play hover / press | `#a9c296` / `#658e34` | dev/hsv.js (linear-space HSV, as FLinearColor does) |
| Center plate | Dropdown, square, padding (2,2,6,2), ButtonPadding 0 | SS:5553-5564 |
| Stop foreground | normal AccentRed; computed hover `#ffc0c0`, press `#bc2c2c` | SS:5568-5582 |
| Right plate | Dropdown, corners (0,4,4,0), padding (2,2,8,2) | SS:5587-5599 |
| Right combo (overflow dots) | padding (7,2,6,2), arrow 6x24 ellipsis, arrow padding (-19,0,2,0), combo padding (1,0,8,0) | SS:5604-5620 |
| Play button entries | RepeatLastPlay (Left Play), Resume/Pause (Left), SingleFrameAdvance (Center), Stop (CenterStop), LateJoin / PlaySimulate / PossessEject (Center), PIE combo (RightCombo) | Editor/UnrealEd/Private/Kismet2/DebuggerCommands.cpp:640-754 |
| Overflow (wrap) button | SComboButton, slim button style, ContentPadding (4,0), expand brush 16x16 | Runtime/Slate/Private/Framework/MultiBox/SClippingHorizontalBox.cpp:116-131; SC:2206 |
| Slot alignment | blocks are AutoWidth, vertically Fill | MB:826-830 |

## PlaceActorsPanel

| Constant | Value | File:line |
|---|---|---|
| Search block | ToolPanel.GroupBorder = Panel colour, padding 8 | SC:437, PM:693 |
| Search hint | "Search Classes" | PM:696 |
| SearchBox style | pill, Input fill, outline Secondary / Hover / Primary, glass 14, image padding (4,0,0,0), glass left aligned | SC:1301-1319 |
| Panel background | Brushes.Panel colour | PM:705 (FSlateBrushTemplates::Panel, WR/Styles/SlateBrushTemplates.cpp:25-29) |
| Category toolbar style | CategoryDrivenContentBuilderToolbarWithoutLabels | SS:1768-1787 |
| Category: icon padding 8, content max width 36, button padding (0,2,0,2), background padding 4 | | SS:1772, 1780, 1784, 1786 |
| Category toggle | checked Primary / PrimaryHover / PrimaryPress with 0.5px outline (0,0,0,0.8), padding 0, fg Foreground / ForegroundHover | SS:1749-1759 |
| Category rail width | 44 | WR/Layout/CategoryDrivenContentBuilderBase.cpp:18 |
| Rail position | vertical, left of the content | CategoryDrivenContentBuilderBase.cpp:139-147 |
| Category icons | Recent, Basic, Lights, Cinematics, VisualEffects, BSP, Volumes, All, 20x20 | SS:4717-4725 |
| Section header | Dropdown bar, Foreground, margin 4, title padding (2,4,0,4) | WR/Layout/Containers/HeaderAndBodyContainer.cpp:63-71, SimpleTitleContainer.cpp:17 |
| Body | Recessed | HeaderAndBodyContainer.cpp:65 |
| Grid | Panel, padding 8, slot padding (4,2,4,2), cell height 32 | ColumnWrappingContainer.cpp:58-63, ColumnWrappingContainerTemplates.cpp:10 |
| Row background | ThumbnailBackground Dropdown, radius 6 | SS:4626, PM:220 |
| Row outline | normal Dropdown / hover Hover / pressed Primary, 1px, radius 6 | SS:4617-4619 |
| Tile | 20 wide box, padding (4,4,0,4) | PM:221, 226 |
| Name | Regular 10pt, white alpha 0.9, padding (4,0,8,1), ellipsis | SS:4648-4650, PM:222, 286 |
| Drag handle | 6x15, padding right 8 | SC:466, PM:211, 223-225 |
| Info button (doc anchor) | SSimpleButton Icons.Help 16, SimpleButton padding (2,1) + content padding (2,1) | Editor/Documentation/Private/SDocumentationAnchor.cpp:63; Developer/ToolWidgets/Private/ToolWidgetsStyle.cpp:19, ToolWidgetsStylePrivate.h:24-25 |
| Tooltip name font | Bold 9 | SS:4612 |

## StatusBar

| Constant | Value | File:line |
|---|---|---|
| Height | 32 | SC:1883, SB:584 |
| Segment fill / gap | Panel / 1px | SB:580, 597, 610, 622; WD:589 |
| StatusBarButton | NoBorder-derived, Foreground, padding (2,2,2,2), pressed (2,3,2,1) | SC:1867-1870 |
| Drawer button | border padding (2,0); icon and label slots padding 2 | WD:443, 456, 467 |
| Drawer labels / icons | "Content Drawer" with ContentBrowser.TabIcon 16; "Output Log" with Log.TabIcon 16 | SU:487-489, 544-546; SS:6325; SC:863 |
| Message segment | padding (6,0) | SB:602 |
| Console custom widget | slot padding (2,0,0,0), border padding (2,0), inner Panel border padding (6,0) | WD:506-509; SU:524-527 |
| Cmd combo | SimpleComboButton, ContentPadding 0, slot padding (0,0,4,0), icon DebugConsole.Icon 16 | Developer/OutputLog/Private/SOutputLog.cpp:186-213; OutputLogStyle.cpp:73 |
| Console box | width 300 to 600, NormalEditableTextBox, font Log.Normal = Mono 9pt | SOutputLog.cpp:220-224; OutputLogStyle.cpp:54; OutputLogSettings.h:40 |
| StatusBarToolBar | no background, label padding (5,5,0,5), icon 16, background padding (4,4) | SC:1892-1899 |
| Derived Data combo | SimpleComboButton, ContentPadding (6,0), icon slot padding (0,0,3,0), label padding (0,0,10,0) | Editor/DerivedDataEditor/Private/SDerivedDataStatusBar.cpp:166-224 |
| Source Control combo | SimpleComboButton, ContentPadding (6,0), label padding (5,0,0,0), unsaved-assets widget and a 2px separator with padding (4,-5) before it | Editor/StatusBar/Private/SourceControlMenuHelpers.cpp:413-455 |

## Could not find or deliberately not decided

- Colour of the 1px gaps in the status bar. `SStatusBar` draws no brush behind the segments. The preview uses Background.
- Opacity of disabled toolbar buttons and the Stop button while not in a play session. Not in the files read.
- The Starship SVG icon files (play, stop, category icons, Content Drawer, Output Log, Console, DDC, revision control, help). Not in the tree. The previews draw approximations.
- Line height of Roboto at 10pt in Slate. Font metrics are not in source. The previews use 16px.
- Class thumbnails in the Place Actors list. They are `ClassThumbnail.*` brushes, not read. The previews draw a 20px glyph.
- Screenshot differences. The reference screenshot shows taller item rows with larger tiles. An info button and a capital "BASIC" label, and the category buttons as a horizontal strip. The 5.5.3 and 5.8.1 sources show 32px cells, a drag handle, a plain label and a vertical rail. Both arrangements are in the Place Actors preview. The info button uses `SDocumentationAnchor` values.
- The screenshot toolbar renders 50px tall, which equals 40px at a 1.25 DPI scale. The 40px value is the source one.
- The tab header of the Place Actors panel and the title bar around the menu bar belong to the docking and window components.
