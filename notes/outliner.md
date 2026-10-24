# Outliner, tree rows, header row, scrollbar: constants and gaps

Source tree: `/home/user/UE553/Engine/Source` (UE 5.5.3). Paths below are relative to it. No value came from the 5.8.1 checkout. `/home/user/unrealengine` showed `StarshipCoreStyle.cpp` there with the same `AlternatingRow` definition (checked, not used as a source).

## Constants used

| Name | Value | File:line |
| --- | --- | --- |
| Font Normal | Roboto Regular 10pt = 13.333px | Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp:36, :1170-1172 |
| TableView.Row even / odd | Recessed / Recessed | StarshipCoreStyle.cpp:2001, :2004 |
| TableView.AlternatingRow even / odd | Recessed / Background | StarshipCoreStyle.cpp:2068-2069 |
| SceneOutliner.TableViewRow | = AlternatingRow | Editor/EditorStyle/Private/StarshipStyle.cpp:1146-1148 |
| Row hovered fill (even and odd) | SelectHover | StarshipCoreStyle.cpp:2002, :2005 |
| Active selection | Select | StarshipCoreStyle.cpp:2009-2010 |
| Inactive selection | SelectInactive | StarshipCoreStyle.cpp:2012-2013 |
| Parent highlight | SelectParent | StarshipCoreStyle.cpp:2015-2016 |
| Row text / selected text | Foreground / ForegroundHover | StarshipCoreStyle.cpp:2018-2019 |
| Brush choice per state | selected+focus, selected, highlighted, even/odd | Runtime/Slate/Public/Widgets/Views/STableRow.h:967-1045 |
| Foreground per selection | TextColor / SelectedTextColor | STableRow.h:1185-1206 |
| Selector focus border | Common/Selector, margin 4/16, SelectorColor | StarshipCoreStyle.cpp:2007; STableRow.h:331-340 |
| SelectorColor default | linear (0.701, 0.225, 0.003) | StarshipCoreStyle.cpp:62 |
| SelectionColor default | #18A0FB | StarshipCoreStyle.cpp:63 |
| Drop indicators | margins 10/16 and 4/16, SelectionColor | StarshipCoreStyle.cpp:2021-2023 |
| TreeArrow brushes | caret-right / caret-down, 16x16, Foreground / ForegroundHover | StarshipCoreStyle.cpp:2072-2075 |
| Arrow colour in the widget | subdued foreground (alpha 0.6) | Runtime/Slate/Private/Widgets/Views/SExpanderArrow.cpp:47; Runtime/SlateCore/Private/Types/WidgetStyle.cpp:11 |
| Arrow button | NoBorder, content padding 0, center | SExpanderArrow.cpp:34-48 |
| Indent formula | depth x IndentAmount | SExpanderArrow.cpp:179-184 |
| Outliner IndentAmount | 12 | Editor/SceneOutliner/Private/SOutlinerTreeView.cpp:306 |
| Outliner label slot padding | (6, 0, 0, 0) | SOutlinerTreeView.cpp:304 |
| Outliner RowHeight / IconSize / IconPadding | 20 / 16 / (0, 1, 6, 1) | Editor/SceneOutliner/Public/SceneOutlinerPublicTypes.h:222-224 |
| Non-interactive label colour | linear (0.15, 0.15, 0.15) | Editor/SceneOutliner/Private/SceneOutlinerStandaloneTypes.cpp:18 |
| Parent highlight on | HighlightParentNodesForSelection(true) | Editor/SceneOutliner/Private/SSceneOutliner.cpp:307 |
| Parent highlight logic | all ancestors of selected | Runtime/Slate/Public/Widgets/Views/STreeView.h:512-539 |
| TreeView / ListView background (editor) | Recessed | StarshipStyle.cpp:823, :827 |
| Folder icons | AccentFolder tint, 16x16 | StarshipStyle.cpp:1140-1141 |
| World icon | Starship/Common/world, 16x16 | StarshipStyle.cpp:1143 |
| Folder open/closed | open when expanded with children | Editor/SceneOutliner/Private/ActorFolderTreeItem.cpp:119-135 |
| Icon tint | UseForeground | ActorTreeItem.cpp:86; ActorFolderTreeItem.cpp:70 |
| Header cell fill / hovered | Header / Dropdown | StarshipCoreStyle.cpp:2083-2084 |
| Header splitter handle | Recessed, size 1.0 | StarshipCoreStyle.cpp:2104-2106, :2112 |
| Header background / foreground | Recessed / Foreground | StarshipCoreStyle.cpp:2113-2114 |
| Header separator | Recessed, 2.0 thick | StarshipCoreStyle.cpp:2115-2116 |
| Sort arrow images | 12x12 SVG, 4 variants | StarshipCoreStyle.cpp:2079-2082 |
| Column menu image | 6x24 ellipsis | StarshipCoreStyle.cpp:2086 |
| Header cell title height | 24 | Runtime/Slate/Private/Widgets/Views/SHeaderRow.cpp:88 |
| Sort arrow gap | 4 left | SHeaderRow.cpp:127 |
| Header cell padding | (5 + 2) / 2 = 3.5 | SHeaderRow.cpp:716, :745, :769 |
| Header scrollbar spacer | 16 | SHeaderRow.cpp:734-741; Runtime/Slate/Private/Widgets/Views/STableViewBase.cpp:172 |
| Header hover only if sortable | SortMode bound | SHeaderRow.cpp:302-309 |
| Gutter column | fixed 24, left padding 4, eye 16 | Editor/SceneOutliner/Private/SceneOutlinerGutter.cpp:323-334 |
| Eye visibility rule | transparent unless row hovered, selected or item hidden | SceneOutlinerGutter.cpp:238-257 |
| Pinned column | fixed 24, centred, only partitioned worlds | SceneOutlinerPinnedColumn.cpp:186-187; Editor/SceneOutliner/Private/SceneOutlinerModule.cpp:255-258 |
| Label column | fill 5 | SceneOutlinerItemLabelColumn.cpp:33 |
| Type column | fill 2, subdued text, padding-left 8 | SceneOutlinerActorInfoColumn.cpp:91, :117, :122 |
| Column order priorities | gutter 0, pinned 5, label 10, type 20 | SceneOutlinerModule.cpp:55, :231, :232, :258 |
| Toolbar padding | (8, 8, 8, 4); 4 gap before buttons | SSceneOutliner.cpp:183, :220 |
| Status footer | Header fill, padding (14, 9) | SSceneOutliner.cpp:324-328 |
| Status colours | Foreground; AccentRed / AccentGreen when filtering | Editor/SceneOutliner/Private/ActorBrowsingMode.cpp:393-401 |
| Status strings | "{0} actors", "{0} actors ({1} selected)" | ActorBrowsingMode.cpp:367, :372 |
| SearchBox style | Input fill, Secondary / Hover / Primary outline, pill, glass 14x14 padding 4 | StarshipCoreStyle.cpp:1303-1316 |
| Edit-box padding | (8, 3, 8, 4) | StarshipCoreStyle.cpp:1289 |
| Input outline width / radius | 1.0 / 4.0 | Runtime/SlateCore/Public/Styling/CoreStyle.h:117-118 |
| Hint text alpha | 0.35 | Runtime/Slate/Private/Widgets/Text/SlateEditableTextLayout.cpp:3563 |
| SimpleButton | hover Dropdown radius 4; icon-only padding (2, 1) | StarshipCoreStyle.cpp:1391, :1406 |
| Scrollbar thumbs | Hover r4 / Hover2 r4 (dragged, hovered) | StarshipCoreStyle.cpp:189-191 |
| Scrollbar thickness | 8 | StarshipCoreStyle.cpp:192 |
| ScrollBox BarThickness | 8 | StarshipCoreStyle.cpp:725, :733 |
| Scrollbar track images | none | Runtime/SlateCore/Private/Styling/SlateTypes.cpp:362-373 |
| Scrollbar padding | 2 uniform | Runtime/Slate/Public/Widgets/Layout/SScrollBar.h:32, :48 |
| Min thumb length | 35 | Runtime/Slate/Private/Widgets/Layout/SScrollBarTrack.cpp:12 |
| Thumb length formula | 35 + (track - 35) x fraction | Runtime/Slate/Public/Widgets/Layout/SScrollBarTrack.h:57-62 |
| Table view scrollbar slot | 16 | STableViewBase.cpp:100 |
| ScrollBox slot | padding 2 around an 8px thumb | Runtime/Slate/Public/Widgets/Layout/SScrollBox.h:268-269; Private/Widgets/Layout/SScrollBox.cpp:194, :244 |
| Thumb opacity not on the thumb brush | child-only tint | Runtime/Slate/Private/Widgets/Layout/SBorder.cpp:115-127; SScrollBar.cpp:121-122, :270-294 |
| Scrollbar hides when not needed | Collapsed | SScrollBar.cpp:323-343; SScrollBar.h:195 |

## Derived, not read from source

- Arrow and folder tint: `color-mix(in srgb, token 75%, #000)`. Source gives brush tint x foreground in linear space (0.527 x 0.527 for the arrow). 75% is the sRGB equivalent. The folder sample from the reference screenshot (#876E50) matches.
- Search box height (about 25px): padding 3 + 4, line about 16, outline 1 + 1. The line height is a guess for Roboto 13.333px.
- Line height 16px for row text. The row is 20px. It does not change the layout.
- Header cells in the preview use a CSS grid. In Slate, the row cells use `FillWidth` and the header uses `SSplitter`. They differ by at most a few pixels.
- Thumb geometry in the SceneOutliner card (top 18, length 280): content 320px, viewport 300px, scrolled to the end. This also covers track 296 = 300 - 2 x 2. Length = 35 + 261 x 300/320.

## Found in the reference screenshot but not in 5.5.3 source

- Rows of both parities were #1A1A1A in the screenshot, while the source gives odd rows `Background` #151515. The preview follows the source.
- The world row is selected-parent tinted in the screenshot, as the source predicts.

## Not found or not covered

- Starship SVG icon files (`visible`, `hidden`, `Pinned`, `Unpinned`, `folder-*`, `world`, `sort-*`, `caret-*`, `settings`, `search`, `ellipsis-vertical-narrow`): the content tree is absent. Preview icons are drawn approximations.
- Actor-type class icons (`FClassIconFinder`): resolved at run time per class. This also covers not in style code.
- The hyperlink style of the "Edit BP_..." Type-column link (`FSceneOutlinerHelpers::GetClassHyperlink`): not read.
- Image of the Selector focus brush (`Common/Selector`), drop-indicator images and `Common/ScrollBoxShadow*` images: not present.
- The panel fill behind the toolbar: set by the dock tab, not by `SSceneOutliner`. The card uses `--panel`.
- The `Level.VisibleHighlightIcon16x` brush is the same image as `Level.VisibleIcon16x` (StarshipStyle.cpp:1939-1941). The hovered eye differs only by tint.
- By default and unused by the Outliner, wire drawing (`ShouldDrawWires`) is off, not rendered.
