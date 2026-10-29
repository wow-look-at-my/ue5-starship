# Splitter

The resize handle of an `SSplitter`, as used between docked panels: a 5px bar that is `--background` at rest and `--secondary` while hovered or dragged.

One `<ue-splitter>` wraps one `.splitter` box: panes and the handle between them. The handle resizes the pane before it and the pane after it takes the rest.

## Markup contract

```html
<ue-splitter data-min-start="120" data-min-end="200" data-step="5" data-step-shift="20">
	<div class="splitter splitter--col">     <!-- omit splitter--col for side-by-side panes -->
		<div class="splitter-pane">...</div>
		<div class="splitter-handle" role="separator" tabindex="0" aria-label="Resize start and end panes"></div>
		<div class="splitter-pane">...</div>
	</div>
</ue-splitter>
```

- `.splitter` is a flex box. It needs a size from its parent or from the page. `splitter--col` stacks the panes. The handle then moves the border between a top pane and a bottom pane. The element reads the orientation from the computed flex direction.
- `.splitter-pane` is `flex: 1 1 0` with `overflow: hidden`. The element sets the first pane to `flex: 0 0 <size>px` while it resizes.
- Attributes of `<ue-splitter>`: `data-min-start` and `data-min-end` are the smallest sizes of the pane before and the pane after the handle, in pixels (20 each). `data-step` is the arrow-key step (5) and `data-step-shift` the Shift step (20). Home goes to the start minimum and End to the end minimum.
- The handle takes `Left` and `Right` in a horizontal splitter and `Up` and `Down` in a vertical one. It publishes `aria-orientation`, `aria-valuemin`, `aria-valuemax` (total minus the end minimum) and `aria-valuenow` (the size of the pane before it). Pointer capture keeps a drag tracking outside the handle.

## Variants

| Class on `.splitter-handle` | Look |
|---|---|
| none | 5px, `--background`, `--secondary` while hovered, dragged or focused |
| `splitter-handle--line` | 2px visible line, with a hit area 3px wider on each side (the `::before` box). The Content Browser handle (`SContentBrowser.cpp:871`) |
| `splitter-handle--panelNormal` | `SplitterPanel` style: `--panel` at rest, `#606060` while hovered |
| `splitter-handle--highlight`, `splitter-handle--panelHighlight` | Forced highlight, for a pinned specimen or a drag |

## Events

| Event | `detail` | When |
|---|---|---|
| `ue-splitter-resize` | `{ size, total, orientation }` | The handle moved, by drag or key. `size` is the length of the pane before the handle in pixels, `total` the length of both panes, `orientation` is `'horizontal'` (side by side) or `'vertical'` (stacked) |

The event bubbles and is composed.

## What the consumer provides

- The panes on either side and the orientation. The handle fills the gap the splitter reserves between them.
- Nothing else. The docking splitter (`SDockingSplitter`) creates a plain `SSplitter` with only an orientation (`SDockingSplitter.cpp:15-17`). It takes every default below.

## Metrics

| Property | Value | Source |
|---|---|---|
| Handle thickness | 5 | `SSplitter.h:179` (`PhysicalSplitterHandleSize`), `SSplitter.cpp:286`, `:291` |
| Hit-test thickness | 5 | `SSplitter.h:180` (`HitDetectionSplitterHandleSize`) |
| Handle length | the full extent of the pane edge | `SSplitter.cpp:286`, `:291` |
| Handle fill, normal | `--background` | `StarshipCoreStyle.cpp:634` |
| Handle fill, highlight (hovered or dragged) | `--secondary` | `StarshipCoreStyle.cpp:635`, `SSplitter.cpp:295-304` |
| Style name | `Splitter` | `SSplitter.h:176` |
| Corner radius | none, flat colour brushes | `StarshipCoreStyle.cpp:634-635` |

### Variants

| Style | Normal | Highlight | Source |
|---|---|---|---|
| `SplitterPanel` | `--panel` | `#606060` (literal `FColor(96,96,96)`) | `StarshipCoreStyle.cpp:637-640` |
| `SplitterDark` (editor only) | `#202020` (literal) | `#606060` (literal) | `StarshipStyle.cpp:811-815` |

## How the brushes are used

`SSplitter::OnPaint` swaps the brushes and multiplies each by the other's tint (`SSplitter.cpp:295-316`). The renderer takes the colour from the tint argument and ignores the brush colour. The result is the intended one: the normal tint at rest, the highlight tint while hovered. A consumer that reuses the brushes elsewhere must not assume the brush colour is what the splitter draws.

## Do

- Use the default `Splitter` style between docked panels. A `--background` bar on `--panel` panes reads as a gap.
- Keep the 5px thickness. Pane sizes in a layout are saved as fractions and the handle space is subtracted before they are applied (`SSplitter.cpp:145`).
- Use `SplitterPanel` only where the panes sit directly on `--panel` and the bar must not show at rest.

## Don't

- Do not draw a border or a grip glyph on the handle.
- Do not make the default bar thinner and widen only the hit area. The editor uses the same value for both. The line variant is the exception and belongs to the Content Browser.
