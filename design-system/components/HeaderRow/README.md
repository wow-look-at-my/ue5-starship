# HeaderRow

A 24px column-header strip with `--header` cells, 1px `--recessed` splitters, a sort arrow beside the title and a 2px `--recessed` rule underneath (UE 5.5.3 `TableView.Header`).

One `<ue-header-row>` wraps exactly one `.hr-row`. It sorts, resizes and reports. It never reorders data.

## Markup contract

```html
<ue-header-row grips="on">   <!-- grips="off" hides and disables every .hr-grip -->
	<div class="hr-row">
		<div class="hr-cells">
			<div class="hr-cell is-gutter"><svg class="hr-icon" viewBox="0 0 16 16">...</svg></div>   <!-- fixed 24px -->
			<div class="hr-cell is-text" role="columnheader" tabindex="0" aria-sort="ascending" data-column="label" style="--hr-grow:5">
				Item Label
				<span class="hr-grip" role="separator" aria-orientation="vertical" aria-label="Resize Item Label" tabindex="0"></span>
			</div>
			<div class="hr-cell is-text" role="columnheader" tabindex="0" aria-sort="none" data-column="type" style="--hr-grow:2">Type</div>
			<div class="hr-spacer"></div>   <!-- 16px, only while the scrollbar below shows -->
		</div>
		<div class="hr-rule"></div>
	</div>
</ue-header-row>
```

- `.hr-cells` is a flex row with a 1px gap. A flexible cell grows by `--hr-grow` (default 1) from a zero basis, so `--hr-grow:5` and `--hr-grow:2` give 5 : 2. A cell with `is-fixed`, `is-gutter` or `is-pinned` keeps `--hr-fixed` (24px).
- A cell with `aria-sort` (`none`, `ascending` or `descending`) sorts. A cell without it is fixed content. `data-column` is the column id in events.
- The element draws the sort arrow itself: a 12x12 `<svg class="hr-sort">` it adds to every sortable cell, hidden while the cell is unsorted. Markup may carry its own `.hr-sort` with one `<path>`. The element only sets the path. A static specimen writes the arrow by hand: `M2 8l4-5 4 5z` up, `M2 4l4 5 4-5z` down, `M2 6.2l4-4 4 4zM2 10.5l4-4 4 4z` secondary up, `M2 1.5l4 4 4-4zM2 5.8l4 4 4-4z` secondary down.
- A `.hr-grip` inside a cell resizes that cell against the next cell. The scene-outliner header has no grips, so a header without any `.hr-grip` or with `grips="off"` is a plain sortable header.
- `.hr-spacer` is the 16px block above a table scrollbar. Set its `hidden` attribute from the `ue-scrollbar-visibility` event of the scroll box below (`detail.visible === false` hides it).

## Behaviour

- Click, Enter or Space on a sortable cell: an unsorted column becomes ascending, a sorted one flips (`SHeaderRow.cpp:392-430`). The new primary key clears the old primary key.
- Shift adds or flips a secondary key, drawn with the double arrow. A plain click on a secondary column makes it primary.
- A grip drags or answers Left and Right (8px a step). Both columns keep at least 20px and the two together keep their width. Every other flexible cell keeps its width. A click on a grip never sorts.

## Events

Both events bubble and are composed. A handler ignores an event from a nested `ue-header-row`.

| Event | `detail` | When |
|---|---|---|
| `ue-sort` | `{ column, mode, direction, priority }` | A cell was activated. `mode` and `direction` are `'ascending'`, `'descending'` or `'none'`. `priority` is `'primary'` or `'secondary'` |
| `ue-column-resize` | `{ column, width, nextColumn, nextWidth }` | A grip moved. Widths are pixels |

## What the consumer provides

- The column list: fixed-width icon columns or fill-width text columns, with their ratios (`--hr-grow`).
- The sort state per column: none, primary or secondary, ascending or descending.
- Whether a vertical scrollbar shows in the table below. If it is, the header shows a 16px spacer on the right.

## Metrics

| Property | Value | Source |
| --- | --- | --- |
| Cell height | 24px (title box `HeightOverride`) | `Runtime/Slate/Private/Widgets/Views/SHeaderRow.cpp:88` |
| Cell fill | `--header` #2F2F2F | `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp:2083` |
| Cell fill, hovered | `--dropdown` #383838, only for a column that can sort | `StarshipCoreStyle.cpp:2084`; `SHeaderRow.cpp:302-309` |
| Row background and splitter handle | `--recessed` #1A1A1A | `StarshipCoreStyle.cpp:2113`, `:2105-2106` |
| Splitter handle width | 1px | `StarshipCoreStyle.cpp:2112` |
| Splitter hit area | 5px (handle + 4) | `SHeaderRow.cpp:716` |
| Cell padding, default | 3.5px left and right, 0 vertical | `SHeaderRow.cpp:745,769` ((5 + 2) / 2) |
| Title text | Roboto Regular 10pt = 13.333px, `--foreground` #C0C0C0 | `SHeaderRow.cpp:93`, `StarshipCoreStyle.cpp:36`, `:2114` |
| Sort arrow size | 12x12 | `StarshipCoreStyle.cpp:2079-2082` (`Icon12x12`) |
| Sort arrow gap | 4px left of the arrow, after the title | `SHeaderRow.cpp:127` |
| Sort arrow tint | row foreground | `SHeaderRow.cpp:130` |
| Row rule | 2px `--recessed` under the cells | `StarshipCoreStyle.cpp:2115-2116`; `SHeaderRow.cpp:949-964` |
| Scrollbar spacer | 16px, only while the scrollbar shows | `SHeaderRow.cpp:734-741`; `Runtime/Slate/Private/Widgets/Views/STableViewBase.cpp:172` |
| Column menu button | 6x24 vertical ellipsis, 14px wide overlay, shown on hover | `StarshipCoreStyle.cpp:2086`; `SHeaderRow.cpp:149-192` |

The Scene Outliner columns, in header order:

| Column | Width | Padding and alignment | Source |
| --- | --- | --- | --- |
| Visibility (eye icon) | fixed 24px | left 4px, icon left-aligned | `Editor/SceneOutliner/Private/SceneOutlinerGutter.cpp:323,329,324` |
| Pinned (pin icon, world-partition worlds only) | fixed 24px | default padding, icon centred | `SceneOutlinerPinnedColumn.cpp:186-187`; `SceneOutlinerModule.cpp:255-258` |
| Item Label | fill, ratio 5 | default padding | `SceneOutlinerItemLabelColumn.cpp:33` |
| Type | fill, ratio 2 | default padding | `SceneOutlinerActorInfoColumn.cpp:91` |

Order comes from the priorities 0, 5, 10 and 20 in `SceneOutlinerModule.cpp:55,231,232,258`.

## Do

- Show the sort arrow only on the column that is sorted. The arrow sits after the title, not at the cell edge.
- Use the secondary arrows for a second sort key. They are a separate double-arrow icon.
- Apply the `--dropdown` hover only to a cell that can sort.
- Leave the 1px gap between cells empty. It shows the `--recessed` row behind.

## Don't

- Do not add a vertical divider colour. The splitter is the row background showing through.
- Do not use `--foreground-header` for titles. The table header style sets `--foreground` (`StarshipCoreStyle.cpp:2114`).
- Do not add padding above or below the title. The title box is exactly 24px.

## Icons

The Starship SVG files (`eye`, `Pinned`, `sort-up-arrow`, `sort-down-arrow`, `sort-up-arrows`, `sort-down-arrows`) are not available. The preview draws approximate filled triangles for the sort arrows and stroke icons for the eye and pin. The real sort arrow shapes may differ.
