# SceneOutliner

The Outliner panel: a search row with folder-add and settings buttons, a column header. This also covers a tree of folders and actors with an eye column and a trailing Type column, and a one-line status footer (UE 5.5.3 `SSceneOutliner`).

## What the consumer provides

- The tree items: depth, folder or actor or world, icon, label, class name for the Type column, expanded state.
- The selection, the tree focus state, the hovered row, the visibility of each item.
- The status text. For no filter it is "N actors" or "N actors (M selected)".
- Whether a vertical scrollbar is needed.

Built from the other components, and nothing in it re-implements one:

- 1 `TextInput` (`textinput--search`) for the filter. The outliner sets the tree filter from its `ue-text-input` event.
- 2 `Button` (`button--simple button--icon`) for the folder-add and settings buttons.
- 1 `HeaderRow` (`grips="off"`) for the sortable header. The outliner sorts the rows from its `ue-sort` event with `TreeRow.sortChildren`, primary key then secondary key.
- 1 `TreeRow` (`select="multi"`) for the rows, the selection, the keyboard and the filter. The eye and Type columns are `.tr-cell` columns. The eye cell carries `data-tr-inert`, so a click on it toggles visibility and selects nothing.
- 1 `Scrollbar` around the tree. The outliner hides the header spacer from its `ue-scrollbar-visibility` event.

The outliner owns only the panel layout, the status line, the eye toggle (it cascades over the rows below a folder by `aria-level`) and the glue between these events. The eye is not a `Checkbox`: it has no box and no fill, so it stays a cell.

## Layout, top to bottom

| Part | Metrics | Source |
| --- | --- | --- |
| Panel fill | `--panel` #242424 (dock tab content) | frame provides; not set by `SSceneOutliner` |
| Toolbar | padding 8 8 4 8; search fills; buttons 4px apart | `Editor/SceneOutliner/Private/SSceneOutliner.cpp:183,220` |
| Search box | `--input` fill, 1px `--secondary` outline, fully rounded; padding 8 3 8 4; glass 14x14 with 4px left padding | `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp:1289,1303,1315-1316`, `Runtime/SlateCore/Public/Styling/CoreStyle.h:118`; filter box at `SSceneOutliner.cpp:64` |
| Search hover, focus | outline `--hover`, `--primary` | `StarshipCoreStyle.cpp:1304-1305` |
| Hint text | "Search...", text colour at alpha 0.35 | `SSceneOutliner.cpp:66`; `Runtime/Slate/Private/Widgets/Text/SlateEditableTextLayout.cpp:3563` |
| Toolbar buttons | icon 16x16 in `SimpleButton`, padding 2 1; hover fill `--dropdown`, radius 4 | `SSceneOutliner.cpp:185-213`; `StarshipCoreStyle.cpp:1391,1406` |
| Header | see `HeaderRow` | `SSceneOutliner.cpp:123-128` |
| Tree background | `--recessed` | `SSceneOutliner.cpp:260`; `Editor/EditorStyle/Private/StarshipStyle.cpp:827` |
| Scrollbar slot | 16px wide, thumb 8px | `Runtime/Slate/Private/Widgets/Views/STableViewBase.cpp:100` |
| Status footer | `--header` fill, padding 14 9, text `--foreground` | `SSceneOutliner.cpp:324-334`; `Editor/SceneOutliner/Private/ActorBrowsingMode.cpp:393` |
| Footer text, filter active | `--accent-red` when nothing matches, `--accent-green` when something matches | `ActorBrowsingMode.cpp:397,401` |

## Rows

| Property | Value | Source |
| --- | --- | --- |
| Row style | `SceneOutliner.TableViewRow` = `TableView.AlternatingRow` | `StarshipStyle.cpp:1146-1148`, `Editor/SceneOutliner/Private/SOutlinerTreeView.cpp:330` |
| Row height | min 20px | `Editor/SceneOutliner/Public/SceneOutlinerPublicTypes.h:222` |
| Parent highlight | on | `SSceneOutliner.cpp:307` |
| Label cell | arrow slot padding-left 6, indent 12 per level | `SOutlinerTreeView.cpp:304-306` |
| Label icon | 16x16, margin 0 6 0 1 -> `1px 6px 1px 0` | `SceneOutlinerPublicTypes.h:223-224`, `ActorTreeItem.cpp:77-88` |
| Folder icon | closed or open, `--accent-folder` tint; open only when expanded and has children | `StarshipStyle.cpp:1140-1141`, `ActorFolderTreeItem.cpp:119-135` |
| World icon | `SceneOutliner.World` | `StarshipStyle.cpp:1143` |
| Eye column | fixed 24px; eye visible only for a hovered or selected row, or an item that is hidden | `Editor/SceneOutliner/Private/SceneOutlinerGutter.cpp:238-257,323` |
| Pin column | fixed 24px, shown in world-partition worlds; same hover rule | `SceneOutlinerPinnedColumn.cpp:146-161,186`; `SceneOutlinerModule.cpp:255-258` |
| Label column | fill ratio 5 | `SceneOutlinerItemLabelColumn.cpp:33` |
| Type column | fill ratio 2; text at subdued foreground, padding-left 8 | `SceneOutlinerActorInfoColumn.cpp:91,117,122` |
| Overflowing text | clipped, no ellipsis | Slate default; not overridden in the label or type cells |

Selection, hover and parent colours are in the `TreeRow` README.

## Do

- Show the eye only on a hovered or selected row. A hidden item keeps its closed-eye icon.
- Show the status as "N actors (M selected)" while some are selected.
- Keep the header spacer in step with the scrollbar: 16px only while the bar shows.

## Don't

- Do not add a border around the tree or the panel.
- Do not tint the selected row differently for folders and actors.
- Do not align the Type column with a fixed width. The fill columns split the remaining width 5 to 2.

## Not covered

- The "Edit BP_..." class hyperlink in the Type column (blueprint actors). Its style is outside this component set.
- Filter bar, context menus, override badges (`SceneOutliner.Override*`), inline rename editing.
- The real actor-type icons. The preview draws approximate 16x16 stroke icons.

## Icons

The Starship SVG files (`visible`, `hidden`, `Pinned`, `folder-closed`, `folder-open`, `folder-plus`, `world`, `settings`, `search`, `caret-*`) are not available. All icons in the preview are approximations drawn for the card.
