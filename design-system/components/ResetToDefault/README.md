# ResetToDefault

The small circular arrow to the right of a property value. It shows only while the value differs from its default. When the value equals the default the arrow is invisible but keeps its slot, so the reset column of a details panel stays aligned.

Source of truth: the glyph is `PropertyWindow.DiffersFromDefault`, an Icon16x16 `Starship/Common/ResetToDefault` SVG (`Editor/EditorStyle/Private/StarshipStyle.cpp:3120`), abbreviated `SS`. The button style is `DetailsView.ExtensionToolBar.Button` (`SS:3277-3283`). The idle slot is in `Editor/PropertyEditor/Private/SDetailSingleItemRow.cpp:636-650`, abbreviated `SDS`. The SVG is not available, so `preview.html` draws an approximation.

## Metrics

Slate unit = 1px.

| Property | Value | Source |
|---|---|---|
| Glyph | 16x16, tinted by the foreground | `SS:3120` |
| Button padding normal | 2 on every side, so the button is 20x20 | `SS:3282` |
| Button padding pressed | 2 left/right, 3 top, 1 bottom: the glyph drops 1px | `SS:3283` |
| Foreground normal | `--foreground` | `SS:3278` |
| Foreground hovered and pressed | `--foreground-hover` | `SS:3279-3280` |
| Idle state | the button is disabled, shows no brush and keeps its width | `SDS:636-650` |
| Tooltip | "Reset this property to its default value." | set by the consumer as `title` |
| Keyboard focus ring | 1px `--primary` outline, radius 4 | `StarshipCoreStyle.cpp:218` |

## Markup contract

One `<ue-reset-to-default>` wraps exactly one `button.resettodefault`. The CSS lives in `src/ResetToDefault/ResetToDefault.css`.

```html
<ue-reset-to-default differs>
	<button class="resettodefault" type="button" title="Reset this property to its default value." aria-label="Reset to default">
		<svg class="resettodefault__glyph" viewBox="0 0 16 16"><path d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H7"/></svg>
	</button>
</ue-reset-to-default>
```

| State | How |
|---|---|
| Value differs from the default | the `differs` attribute on the host. The arrow is visible and clickable |
| Value equals the default (idle) | no `differs` attribute. The element adds `resettodefault--idle` (`visibility: hidden`) and `disabled` to the button. The slot stays |

The owner of the value sets or removes `differs`, for example `el.toggleAttribute('differs', value !== defaultValue)`. The element does not change it after a click. The owner resets the value and then removes `differs`.

Forced state classes for pinned specimens: `resettodefault--hover`, `resettodefault--pressed`, `resettodefault--idle`.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-reset` | `{}` | The user clicks the arrow while `differs` is set. An idle arrow cannot fire it |

## Do

- Put it in a fixed 20px column at the right end of the row. Do this so every row has the same width.
- Give the button a `title` and an `aria-label`.

## Don't

- Do not remove the element when the value equals the default. Toggle `differs`, so the slot stays.
- Do not tint the arrow with Primary. It uses the foreground colours.
