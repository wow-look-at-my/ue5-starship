# Slider

A thin dark track with a small round thumb that brightens on hover. There is no filled progress segment.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (Slider block, lines 571-581), abbreviated `SCS`. This also covers geometry in `Runtime/Slate/Private/Widgets/Input/SSlider.cpp`. `VolumeControl` reuses the same slider style (`SCS:583-590`). The editor style does not override it.

## What the consumer provides

- The value, the step size and the width. The style gives none. The widget minimum is 16 wide.
- Orientation. The vertical slider is the same drawing turned many degrees (`SSlider.cpp:98-110`).

## Metrics

Slate unit = 1px.

| Property | Value | Source |
|---|---|---|
| Bar thickness | 4px | `SCS:580` |
| Bar fill | `--input` | `SCS:574-575` |
| Bar outline | 1px `--input`, the same colour as the fill | `SCS:574-575` |
| Bar radius | 2px | `SCS:574-576` |
| Disabled bar outline | 1px `--recessed` | `SCS:576` |
| Thumb size | 8 x 8 | `SCS:577-579` (`Icon8x8`) |
| Thumb shape | circle: the brush has no radius, so it rounds to half its height | `SCS:577`; `SlateRoundedBoxBrush.h` (size-only constructor) |
| Thumb colour normal | `--foreground` | `SCS:577` |
| Thumb colour hovered | `--foreground-hover` | `SCS:578` |
| Thumb colour disabled | `--foreground` | `SCS:579` |
| Widget desired height | 8px: the larger of the bar thickness and the thumb height | `SSlider.cpp:151-159` |
| Widget minimum size | 16 x 16 before the style is applied | `SSlider.cpp:144-148` |
| Bar extent | from 4px (half the thumb) to width minus 4px | `SSlider.cpp:93-94`, `114-115` |
| Thumb travel | the thumb centre runs from 8px to width minus 8px, because the handle is indented by its own width | `SSlider.cpp:84-91`; `SSlider.h:29` (`IndentHandle` true) |
| Bar and thumb vertical position | centred in the widget | `SSlider.cpp:88` |
| Disabled look | whole slider at 45% alpha | `SlateElementPixelShader.usf:535` |

## Markup contract

One `<ue-slider>` wraps exactly one `.slider`. The CSS lives in `src/Slider/Slider.css`.

```html
<ue-slider>
	<div class="slider" role="slider" tabindex="0" aria-label="Opacity" data-min="0" data-max="1" data-step="0.01" data-value="0.5">
		<span class="slider__bar"></span><span class="slider__thumb"></span>
	</div>
</ue-slider>
```

| Attribute on `.slider` | Meaning |
|---|---|
| `data-min`, `data-max` | The range. Defaults 0 and 1 |
| `data-step` | The snap step. Zero or missing means continuous. The arrow keys use a hundredth of the range then |
| `data-value` | The current value |
| `aria-disabled="true"` | Disabled |

The element writes `--slider-value` (the fraction), `aria-valuenow`, `aria-valuemin` and `aria-valuemax`. Pointer: a press jumps the thumb to the pointer and a drag follows it. Keys: arrows step, Page Up and Page Down step by ten, Home and End go to the ends.

A value readout is an optional `<ue-event-status event="ue-slider-change" template="{text}">` inside the `ue-slider`.

Forced state classes for pinned specimens: `slider--hover`, `slider--disabled`.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-slider-change` | `{ value, text }` | The value changes by pointer or key. `text` is the value with two decimals when the step is below one, else the plain number |

## Do

- Place the slider on `--panel` or `--background`. The bar is `--input`. It reads as a dark slot.
- Brighten only the thumb on hover. The bar does not change.
- Let the thumb centre stop 8px from each end of the bar.

## Don't

- Do not draw a filled segment behind the thumb. The style has none.
- Do not tint the thumb with Primary. The thumb is a foreground colour.
- Do not enlarge the thumb on hover. Hover swaps the colour only.
