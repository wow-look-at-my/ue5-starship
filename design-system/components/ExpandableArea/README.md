# ExpandableArea

A collapsible section: a flat header row with a caret and a bold small title, above a body, all on one rounded `--panel` surface.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (ExpandableArea block, lines 561-569), abbreviated `SCS`. This also covers layout in `Runtime/Slate/Public/Widgets/Layout/SExpandableArea.h` and `Private/Widgets/Layout/SExpandableArea.cpp`. The editor style adds only palette-specific variants (`StarshipStyle.cpp:1663-1664`).

## What the consumer provides

- The title text (or a header widget) and the body content.
- The initial state. The widget collapses and expands on a header click.
- The Starship caret SVGs (`caret-right`, `caret-down`) are not available. `preview.html` draws filled triangles as approximations.

## Metrics

Slate unit = 1px. The 13px title line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Surface fill and radius (`ExpandableArea.Border`) | `--panel`, radius 4, no outline | `SCS:568` |
| Caret images | 16x16, `caret-right` collapsed and `caret-down` expanded | `SCS:564-565` |
| Caret colour | `--foreground` | `SCS:564-565` (brush tint `DefaultForeground`) |
| Gap between caret and title | 3 | `SExpandableArea.h:40` (`AreaTitlePadding`) |
| Title font (`ExpandableArea.TitleFont`) | SmallBold: 8pt Bold = 10.67px | `SCS:567`, `1182` |
| Title colour | white: the inherited default foreground; nothing sets it | `SExpandableArea.cpp:74` (`UseForeground`), `WidgetStyle.h:21` (derived) |
| Header padding | 4 left/right, 2 top/bottom | `SExpandableArea.h:41` |
| Header button | `NoBorder`: no fill in any state, padding 0 | `SExpandableArea.cpp:72`; `SCS:233-241` |
| Header height | 20px = 16px caret + 2 + 2 | derived |
| Body padding | 1 | `SExpandableArea.h:42` |
| Rollout animation | 0.1 seconds, cubic ease out | `SlateTypes.cpp:402`; `SExpandableArea.cpp:27` |
| Optional separate body brush | the area then draws the header and body as two borders | `SExpandableArea.cpp:47-54` |

## Markup contract

One `<ue-expandable-area>` wraps exactly one `.expandablearea`. The CSS lives in `src/ExpandableArea/ExpandableArea.css`.

```html
<ue-expandable-area>
	<div class="expandablearea">
		<div class="expandablearea__header" role="button" tabindex="0" aria-expanded="false">
			<svg class="expandablearea__caret" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4z"/></svg>
			<span class="expandablearea__title">Advanced</span>
		</div>
		<div class="expandablearea__body" hidden>...</div>
	</div>
</ue-expandable-area>
```

`aria-expanded` on the header is the state. The element shows or hides the body to match it, so an area that starts expanded has `aria-expanded="true"` and a body without `hidden`. The caret is always the right-pointing triangle, and CSS turns it many degrees while expanded. A pinned specimen draws its own down triangle.

The header may hold other controls, such as a `ue-button` or a `ue-checkbox` on the right. A click on a control inside the header. That click is on any `ue-*` element or on anything with its own `tabindex`, `role` or native control behavior does not fold the area. Enter and Space fold the area only while the header itself has the focus. A `ue-expandable-area` inside the body is independent.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-expand-toggle` | `{ expanded }` | The user folds or unfolds the area. The initial state does not fire it |

## Do

- Keep the header and body on one surface unless the consumer sets a body brush.
- Swap only the caret on expand. The title does not change.
- Give the body its own padding. The widget adds only 1px.

## Don't

- Do not add a hover fill to the header. `NoBorder` has none.
- Do not draw an outline around the area.
- Do not use a regular-weight title. The style is bold small.
