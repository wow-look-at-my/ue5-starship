# SpinBox

A dark numeric field that you drag to change. When it has a value range, a bar fills from the left in proportion to the value.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (SpinBox block, lines 593-627), abbreviated `SCS`. The drawing logic is in `Runtime/Slate/Public/Widgets/Input/SSpinBox.h`. The editor style adds no spin box of its own. Its `SpinBox.*` entries (`StarshipStyle.cpp:856-861`) are legacy textures and are not used by the `SpinBox` style.

## What the consumer provides

- The value, the optional minimum and maximum slider values, and the delta. The fill bar appears only when a slider range exists (`SSpinBox.h:370`).
- A width. The style gives none.
- For the vector form in the Details panel: the axis colour strip. It comes from `SNumericEntryBox`, not from the spin box style.

## Metrics

Slate unit = 1px. The 16px text line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Background fill | `--input` | `SCS:598` |
| Radius | 4px | `SCS:598`, `CoreStyle.h:117` |
| Outline normal | 1px `--input-outline` | `SCS:598`, `CoreStyle.h:118` |
| Outline hovered | 1px `--hover` | `SCS:599` |
| Outline active (dragging or text entry) | 1px `--primary` | `SCS:600`; `SSpinBox.h:343-346` |
| Fill colour inactive | `--dropdown` | `SCS:603` |
| Fill colour hovered | `--hover` | `SCS:602` |
| Fill colour active (dragging) | `--primary` | `SCS:601` |
| Fill radius | 4px, no outline colour | `SCS:601-603` |
| Fill rectangle | width = fraction x box width, minus 2; height = box height, minus 2; offset 1,1 | `SCS:607` (`InsetPadding` 1); `SSpinBox.h:394-401` |
| Fill hidden | while the text field is open | `SSpinBox.h:396` |
| Text colour | `--foreground-hover` (white) | `SCS:605` |
| Text padding | 7 left/right, 2.5 top/bottom | `SCS:606`; slots in `SSpinBox.h:293-298` |
| Outer content padding | 2 left/right, 1 top/bottom | `SSpinBox.h:92`, `290` |
| Font | Normal: 10pt Regular = 13.33px | `SSpinBox.h:91` |
| Text alignment | left | `SSpinBox.h:98` |
| Arrows image | none | `SCS:604` |
| Resulting height | 23px: 1 + 2.5 + 16 + 2.5 + 1 | derived |
| Disabled look | normal look at 45% alpha | `SlateElementPixelShader.usf:535` |
| Typed-text caret | white, 1.28px wide | `TextEditHelper.h:18` |

## Variants

| Style | Difference | Source |
|---|---|---|
| `NumericEntrySpinBox` | the same object as `SpinBox` | `SCS:612` |
| `NumericEntrySpinBox_Dark` | active fill `--hover`, inactive fill `--secondary`, text padding 0; no active background brush, so the hovered outline is used (`SSpinBox.h:276`) | `SCS:614-622` |
| `Menu.SpinBox` | outline `--secondary` normal, text padding 10 x 3.5 / 4, fills `--hover` and `--secondary` | `SCS:2290-2299` |

## Axis strip (SVectorInputBox, `bColorAxisLabels`)

`SNumericEntryBox` overlays a 2px-wide strip on the left of the box (`SNumericEntryBox.h:451-456`). The strip sits 3px from the edges (`SVectorInputBox.h:454`, `LabelPadding` 3). The brush `NarrowDecorator` is a 2x16 SVG (`SCS:626`), tinted with the axis colour.

| Axis | Linear value in source | sRGB used in `preview.html` | Source |
|---|---|---|---|
| X | 0.594, 0.0197, 0 | `#cb2600` | `SNumericEntryBox.h:813` |
| Y | 0.1349, 0.3959, 0 | `#67a900` | `SNumericEntryBox.h:816` |
| Z | 0.0251, 0.207, 0.85 | `#2c7eed` | `SNumericEntryBox.h:819` |

The strip height is the box height minus 6 (3px padding top and bottom). This follows from the overlay slot with fill alignment. It is derived, not measured.

## Markup contract

One `<ue-spin-box>` wraps exactly one `.spinbox`. The CSS lives in `src/SpinBox/SpinBox.css`. The element renders the value, so the text in the markup is only the first paint.

```html
<ue-spin-box>
	<div class="spinbox" tabindex="0" role="spinbutton" data-value="40" data-min="0" data-max="100" data-delta="1">
		<span class="spinbox__fill"></span>
		<span class="spinbox__text">40.0</span>
	</div>
</ue-spin-box>
```

| Attribute on `.spinbox` | Meaning |
|---|---|
| `data-value` | The current value |
| `data-min`, `data-max` | The range. With both set the box is bounded: it shows the fill bar, clamps and drags by a share of the range. With either missing it is unbounded: no fill bar, no clamp, and a drag changes the value by a share of its size |
| `data-delta` or `data-step` | The step of the arrow keys and the snap after a drag. Zero means no stepping |
| `data-unit` | A unit suffix such as `cm`. The element adds `<span class="spinbox__unit">` after the text |
| `aria-disabled="true"` | Disabled |

An axis colour strip goes first inside `.spinbox`: `<span class="spinbox__axis spinbox__axis--x"></span>`, with `--y` or `--z`. The strips use the `--axis-x`, `--axis-y` and `--axis-z` tokens. A vector input is three of these boxes.

Input: a drag past 5px changes the value. Escape during a drag restores the start value. A click without a drag opens text entry, where Enter commits (clamped), Escape cancels and a blur commits. Up and Right add the step, Down and Left subtract it, and Enter opens text entry.

Add `spinbox--small` for a value in a Details row. It sets the Small 8pt font (10.667px) that `ComponentTransformDetails.cpp:422,491` uses. Nothing else changes.

Data API: `el.value` reads the number. Setting it redraws the box and fires no `ue-spin-change`, because the owner that sets it already knows. Set it only after the element is upgraded, for example in an event handler.

Forced state classes for pinned specimens: `spinbox--hover`, `spinbox--active`, `spinbox--text`, `spinbox--disabled`.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-spin-change` | `{ value, text }` | The value changes by a drag, a key, typed entry or the Escape restore. `text` is the formatted value with the unit |

## Do

- Show the fill only for a bounded range. An unbounded box has no bar.
- Change fill and outline together: `--hover` on hover, `--primary` while dragging.
- Keep the value white at all times.

## Don't

- Do not draw arrows or steppers. The arrows image is empty.
- Do not keep the fill while the text field is open.
- Do not use the `--primary` fill for the idle state. It only shows while dragging.
