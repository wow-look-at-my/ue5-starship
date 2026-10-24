# Details panel: constants and gaps

Source tree: `/home/user/UE553/Engine/Source` (5.5.3 fork). No value below comes from the 5.8.1 reference checkout. Paths are relative to that root. Font px = pt x 96/72.

## Fonts

| Name | Value | File:line |
|---|---|---|
| Normal | Regular 10pt = 13.333px | `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp:36` |
| Small | Regular 8pt = 10.667px | `StarshipCoreStyle.cpp:40` |
| SmallBold | Bold 8pt | `StarshipCoreStyle.cpp:41` |
| PropertyWindow.NormalFont | Small (row names, value widgets) | `Editor/EditorStyle/Private/StarshipStyle.cpp:3122` |
| DetailsView.CategoryFontStyle | SmallBold | `StarshipStyle.cpp:3265` |
| DetailsView name font | Regular 11pt = 14.667px, White | `StarshipStyle.cpp:3148-3153` |
| MobilityFont | Small, LetterSpacing 100 (= 100 x size / 1000, 0.1em) | `StarshipStyle.cpp:3127-3128`, `Runtime/SlateCore/Private/Fonts/SlateTextShaper.cpp:412` |
| SmallButtonText | NormalText (Normal 10pt, UseForeground) | `StarshipCoreStyle.cpp:1433` |
| Hint text alpha | 0.35 of the text colour | `Runtime/Slate/Private/Widgets/Text/SlateEditableTextLayout.cpp:3562-3563` |
| SubduedForeground factor | 0.6 | `Runtime/SlateCore/Private/Types/WidgetStyle.cpp:11` |

## Layout constants

| Name | Value | File:line |
|---|---|---|
| PropertyRowHeight | 26 | `Editor/PropertyEditor/Private/UserInterface/PropertyEditor/PropertyEditorConstants.h:28` |
| Row bottom line | 1px GridLine (Recessed) via padding (0,0,0,1) | `Editor/PropertyEditor/Private/SDetailSingleItemRow.cpp:733-734` |
| Category row padding | Classic (0,0,0,1); Card top 8 | `Editor/PropertyEditor/Private/DetailsViewStyle.cpp:241-246,302-308` |
| Card table padding | (8,0,20,8) with scrollbar, (8,0,8,8) without | `DetailsViewStyle.cpp:303-304` |
| Default value column | 0.6; right column min 22 | `Editor/PropertyEditor/Public/DetailsViewArgs.h:134-135` |
| RightRowPadding | (12,0,2,0) | `SDetailSingleItemRow.cpp:39` |
| Extension slot gap | 5 left | `SDetailSingleItemRow.cpp:561` |
| Splitter handle | 1 physical, 5 hit | `SDetailSingleItemRow.cpp:428-429` |
| Name slot offsets | arrow slot padding 2, name slot padding 2 | `SDetailSingleItemRow.cpp:506,528` |
| Expander arrow | MinWidth 12, 16px icon, padding 0 | `Editor/PropertyEditor/Private/SDetailExpanderArrow.cpp:16-32` |
| Indent per level | 16 | `Editor/PropertyEditor/Private/SDetailRowIndent.cpp:66` |
| Row fill offsets | 0, 4, 6, 10, 16 added to Panel / Header sRGB bytes | `PropertyEditorConstants.cpp:40-54` |
| Category header content | indent, caret (left 2), title (left 4) | `Editor/PropertyEditor/Private/SDetailCategoryTableRow.cpp:60-98` |
| Category min height | 26 | `SDetailCategoryTableRow.cpp:155` |
| Search slot padding | 6 | `Editor/PropertyEditor/Private/SDetailsView.cpp:279` |
| Section strip padding | (8,2,8,7); wrap inner padding (4,4) | `SDetailsView.cpp:374,379` |
| Name area inset | (10,4,0,0) | `Editor/LevelEditor/Private/SActorDetails.cpp:336` |
| Name text slot | (8,0,3,0) | `Editor/PropertyEditor/Private/SDetailNameArea.cpp:138` |
| Lock slot | padding (4,0,4,0), ContentPadding (4,2) | `SDetailNameArea.cpp:164,170` |
| Components box | padding (2,0,2,0) | `SActorDetails.cpp:269` |
| Instance frame padding | 4 | `Editor/SubobjectEditor/Private/SSubobjectInstanceEditor.cpp:164` |
| Instance row padding | (0,4,0,4) | `Editor/SubobjectEditor/Private/SSubobjectEditor.cpp:721` |
| Instance row content | icon left 4, name left 6, context text left 4 | `SSubobjectEditor.cpp:777,789,797` |
| Add / Blueprint / help gaps | 4 / 0 / 4 | `SSubobjectInstanceEditor.cpp:74,141` |
| Button heights | action button 22 (design standard), icon 16, icon-label gap 3, horizontal 2 | `Developer/ToolWidgets/Private/ToolWidgetsStylePrivate.h:21-25` |
| ModifyContentPadding | top and bottom of content padding = button NormalPadding.Top | `Developer/ToolWidgets/Private/ToolWidgetsStyle.cpp:16-21` |
| ThumbnailSize | 48 x 48 | `Editor/PropertyEditor/Private/UserInterface/PropertyEditor/SPropertyEditorAsset.h:62` |
| Thumbnail slot | padding (0,3,5,0); shadow border padding (0,0,4,4); overlay padding 1 | `SPropertyEditorAsset.cpp:614,620,625` |
| Asset button strip | wrapper padding (0,2,4,2); buttons 22x22, slot padding (2,0) | `SPropertyEditorAsset.cpp:671,726,737`, `Editor/PropertyEditor/Private/PropertyCustomizationHelpers.cpp:77-78` |
| Color strip thickness | 2 | `Editor/UnrealEd/Private/AssetThumbnail.cpp:1050-1054` |
| Segment padding | (8,3); track right padding 1; slot padding (1,1,0,1) | `StarshipCoreStyle.cpp:1662,1685`, `Runtime/Slate/Public/Widgets/Input/SSegmentedControl.h:219-220,304-309` |
| Numeric entry | label padding 3; narrow decorator 2x16 SVG, border left padding 2; text padding (7,2.5,7,2.5); inset padding 1 | `Runtime/Slate/Public/Widgets/Input/SVectorInputBox.h:454`, `SNumericEntryBox.h:448-457`, `StarshipCoreStyle.cpp:606-607,626` |
| Vector value width | 125 x 3 min and max | `Editor/DetailCustomizations/Private/ComponentTransformDetails.cpp:475-476` |

## Core style constants

| Name | Value | File:line |
|---|---|---|
| InputFocusRadius / Thickness | 4 / 1 | `Runtime/SlateCore/Public/Styling/CoreStyle.h:117-118` |
| ButtonMargins | (12,1.5,12,1.5) | `CoreStyle.h:110` |
| ComboButtonMargin | (8,1,8,1) | `CoreStyle.h:114` |
| FComboButtonStyle defaults | ContentPadding 5, DownArrowPadding 2 | `Runtime/SlateCore/Private/Styling/SlateTypes.cpp:164-165` |
| FCheckBoxStyle default padding | (2,0,0,0) | `SlateTypes.cpp:24` |
| SButton default ContentPadding | (4,2) | `Runtime/Slate/Public/Widgets/Input/SButton.h:42` |
| Search outline radius | HalfHeightRadius (pill) | `Runtime/SlateCore/Public/Styling/SlateBrush.h:161-167` |

## Colours (theme tokens)

| Use | Token | File:line |
|---|---|---|
| Details row | Panel; hovered Header; highlighted Hover | `PropertyEditorConstants.cpp:45-47`, `SDetailSingleItemRow.cpp:850-870` |
| Grid line, splitter | Recessed | `StarshipStyle.cpp:3246-3251` |
| Category row | Header | `StarshipStyle.cpp:3188` |
| Category title | ForegroundHeader | `StarshipStyle.cpp:3268` |
| Caret | Foreground tint x subdued (0.6) | `StarshipCoreStyle.cpp:2072-2075`, `SDetailExpanderArrow.cpp:30` |
| Search box | Input fill; outline Secondary / Hover / Primary | `StarshipCoreStyle.cpp:1303-1305` |
| Text box | Input; outline InputOutline / Hover / Primary; read-only Header | `StarshipCoreStyle.cpp:1284-1287` |
| Button | Secondary / Hover / Header, outline Input | `StarshipCoreStyle.cpp:1373-1375` |
| SimpleButton | none / Dropdown hover | `StarshipCoreStyle.cpp:1390-1391` |
| Pill unchecked / checked | Header, Hover / Primary, PrimaryHover; outline Input | `StarshipCoreStyle.cpp:923-928` |
| Combo | Input; outline InputOutline / Hover | `StarshipCoreStyle.cpp:1471-1473` |
| Spin box | Input; outline InputOutline / Hover / Primary | `StarshipCoreStyle.cpp:598-600` |
| Segment | track Input; checked Dropdown; hover Hover; pressed Header | `StarshipCoreStyle.cpp:1666-1671,1684` |
| Instance row | SelectInactive; Select when active | `StarshipCoreStyle.cpp:2009,2012` |
| Instance frame | Recessed | `StarshipStyle.cpp:4237` |
| Thumbnail outline | InputOutline; hovered Hover2 | `StarshipStyle.cpp:3021-3022` |
| Add icon | AccentGreen | `ToolWidgetsStyle.cpp:76` |
| Star | Foreground off, AccentBlue on | `SDetailsView.cpp:1177-1183` |

## Literal colours (the source uses literals)

| Use | Value | File:line |
|---|---|---|
| X edge | linear (0.594, 0.0197, 0.0) = sRGB `#cb2600` | `Runtime/Slate/Public/Widgets/Input/SNumericEntryBox.h:813` |
| Y edge | linear (0.1349, 0.3959, 0.0) = sRGB `#67a900` | `SNumericEntryBox.h:816` |
| Z edge | linear (0.0251, 0.207, 0.85) = sRGB `#2c7eed` | `SNumericEntryBox.h:819` |
| Rotator edges | the same Red, Green, Blue | `Runtime/Slate/Public/Widgets/Input/SRotatorInputBox.h:171,207,243` |
| Instance-row nested fills | `#282828`, `#2a2a2a`, `#2e2e2e` (Panel + offsets) | derived from `PropertyEditorConstants.cpp:40-54` |

## Checks against the reference screenshot

Sampled with a canvas read of `images/1.webp` (UI at about 1.25x DPI scale):

| Sample | Result | Matches |
|---|---|---|
| Category header | `#2f2f2f` | Header |
| Search box fill | `#0f0f0f` | Input |
| Filter pill | `#2f2f2f` | Header |
| Instance row | `#40576f` | SelectInactive |
| Mobility checked segment | `#383838` | Dropdown |
| Mobility track | `#0f0f0f` | Input |
| Add and Blueprint buttons | `#383838` | Secondary |
| Add icon | `#8bc24f` | AccentGreen `#8bc24a` |
| Caret | `#868686` | Foreground x 0.6 over Header |
| Property row | `#242424` | Panel |

## Could not find or could not verify

- **Starship SVG icons** (plus, blueprint, help, lock, search, star, gear, caret, chevron, reset, use, browse): the files are not in the tree. The previews draw 16x16 stroke approximations.
- **Narrow decorator shape**: `NumericEntrySpinBox.NarrowDecorator` is a 2x16 SVG (`StarshipCoreStyle.cpp:626`). The previews draw a 2px bar with radius 1. The radius is a guess.
- **Drop shadow brush**: `Starship/ContentBrowser/drop-shadow` is a raster 64px box brush with margin 4/64 (`StarshipStyle.cpp:3023`). The preview uses a CSS shadow.
- **Asset class colour**: the Static Mesh strip colour comes from the asset definition, which the fork strips. The preview uses `#29f1f2`, sampled from the screenshot.
- **Roboto line height**: the font files are not in source. Previews use `line-height: 1.172`, which is the Roboto ascent plus descent over the em from the font tables. Text-box and button heights follow from it, for example the spin box is text line + 5.
- **Combo width in the transform rows**: source gives the dropdown slot FillWidth (`ComponentTransformDetails.cpp:209-211`), but the screenshot shows it at its desired width (about 86px). The preview uses desired width. Verify in-engine.
- **Card layout**: `SDetailsView::GetPrimaryDetailsViewStyleKey` returns Card only when the `DetailsPanel.Style.EnableCardLayout` console variable is on. Its default is false, so Classic is the default (`SDetailsView.cpp:35-39,1612-1619`). The screenshot matches Classic (no gap above categories).
- **Edit-condition checkbox** in the name column (`SDetailSingleItemRow.cpp:512-521`), the favorites star column and the override badges (`StarshipStyle.cpp:3202-3217`): not built. Each is optional and collapsed in the reference.
- **Dark and light themes**: the dev stylesheet carries only the dark token set.
