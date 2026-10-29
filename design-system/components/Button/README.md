# Button

A rounded, outlined push button in multiple tints: `Button` (also `SecondaryButton`), `PrimaryButton`, `SimpleButton` and the label-and-icon variants of each.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (`SetupButtonStyles`, lines 1353-1465), abbreviated `SCS` below. Margins and radii come from `Runtime/SlateCore/Public/Styling/CoreStyle.h` (`CoreStyleConstants`), abbreviated `CS.h`. The editor style (`Editor/EditorStyle/Private/StarshipStyle.cpp`) adds no Starship button. It only copies `Button` (`StarshipStyle.cpp:175`) and defines legacy texture buttons (see "Not rebuilt").

## What the consumer provides

- The label (an `SButton` text uses `ButtonText`, which is `NormalText`: 10pt Regular, `SCS:1412`) or any content widget.
- Optionally a 16x16 icon. The gap between icon and label is the consumer's choice, the style defines none.
- `SButton` adds its own `ContentPadding` (4,2) on top of the style padding unless the consumer overrides it (`SButton.h:42`, summed in `SButton.cpp:159-164`). The padding column below is the style part. The total is style + (4,2).
- The Starship SVG icons are not available. `preview.html` draws approximations.

## Metrics

Slate unit = 1px. Font px = pt x 96/72. The 16px text line box is derived from Roboto metrics (about 1.17 em), it is not read from source.

| Property | Value | Source |
|---|---|---|
| Corner radius | 4px | `SCS:1357-1360`, `1373-1376` |
| Outline | 1px, colour `--input`, drawn inside the box | `SCS:1357`, `CS.h:118` (`InputFocusThickness`) |
| Button fill normal / hovered / pressed | `--secondary` / `--hover` / `--header` | `SCS:1373-1375` |
| PrimaryButton fill normal / hovered / pressed | `--primary` / `--primary-hover` / `--primary-press` | `SCS:1357-1359` |
| Disabled brush (style) | fill `--dropdown`, outline `--recessed` | `SCS:1360`, `1376` |
| Foreground normal / hovered / pressed | `--foreground-hover` (white) | `SCS:1361-1363`, `1377-1379` |
| Foreground disabled | `--foreground` | `SCS:1364`, `1380` |
| Normal padding (style) | 12 left/right, 1.5 top/bottom | `CS.h:110` (`ButtonMargins`) |
| Pressed padding (style) | 12, top 2.5, bottom 0.5 (label moves down 1px) | `CS.h:112` (`PressedButtonMargins`) |
| Total padding with default `SButton` content padding | 16 x 3.5 normal; 16, top 4.5, bottom 2.5 pressed | `SButton.h:42` + `CS.h:110-112` |
| Resulting height (16px text) | 23px | derived: 16 + 3.5 + 3.5 |
| PrimaryButtonLabelAndIcon padding | 4 x 1.5 normal; 4, top 2.5, bottom 0.5 pressed | `SCS:1368-1370` |
| Label font | NormalText, 10pt Regular = 13.33px | `SCS:1170`, `1412` |
| Bold label (`PrimaryButtonText`) | 10pt Bold, only where a consumer sets it | `SCS:1421` |
| SimpleButton fill | none normal; `--dropdown` r4 hovered and pressed, no outline | `SCS:1390-1392` |
| SimpleButton foreground | `--foreground` normal; `--foreground-hover` hovered and pressed | `SCS:1394-1396` |
| SimpleButtonLabelAndIcon padding | 4 x 1 normal; 4, top 2, bottom 0 pressed | `SCS:1402-1403` |
| SimpleButton (icon only) padding | 2 x 1 normal; 2, top 2, bottom 0 pressed | `SCS:1406-1407` |
| HoverOnlyButton | SimpleButton with no hover or pressed brush, padding 2,0 | `SCS:1450-1456` |
| ThinHoverOnlyButton | the same with padding 0 | `SCS:1458-1463` |
| InvisibleButton | no brush at all, white foreground, padding 0 | `SCS:1436-1448` |
| Keyboard focus ring (`FocusRectangle`) | transparent fill, 1px `--primary` outline, radius 4 | `SCS:218`; drawn by `SWidget.cpp:989-991` |
| Disabled look (engine default) | normal brush and text at 45% alpha | `SlateElementPixelShader.usf:535`; `SBorder.cpp:21` (`ShowDisabledEffect` true) |

`SecondaryButton` is the same object as `Button` (`SCS:1426`). `EditorUtilityButton` is `Button` with a 32x32 brush size (`SCS:1384-1387`), which only affects minimum size.

## Do

- Use `Button` for ordinary actions, `PrimaryButton` for the main action of a panel.
- Use `SimpleButton` for toolbar-like actions that must sit flat until hovered.
- Keep the fill, outline and radius as one unit: the outline is part of the fill brush. It is not a CSS border that adds size.
- Move the label down 1px while pressed, as the pressed padding does.

## Don't

- Do not draw a disabled button with the style's Disabled brush unless the widget turns the disabled effect off. The default look is the normal brush at 45% alpha.
- Do not add a drop shadow, gradient or hover scale. The source has none.
- Do not rely on `PrimaryButtonText` bold for every primary button. It is a separate text style.

## Markup contract

One `<ue-button>` wraps exactly one `.button`. The CSS lives in `src/Button/Button.css`. The markup works when pasted into any component. Glyphs are inline `svg` elements with a `viewBox`. No `symbol` reference is needed.

```html
<ue-button><button class="button button--primary">Create</button></ue-button>
<ue-button><button class="button button--simple"><svg class="button__icon" viewBox="0 0 16 16"><path d="M3 3h8l2 2v8H3z"/></svg>Save All</button></ue-button>
```

The element can be a `button` or any element with `role="button"` and `tabindex="0"`. A non-`button` element gets Enter and Space handling from `ue-button`.

| Class | Variant |
|---|---|
| `button` | Default (secondary): `--secondary` fill, `--input` outline |
| `button--primary` | `--primary` fill. Add `button--bold` for `PrimaryButtonText` |
| `button--simple` | Transparent, `--dropdown` on hover |
| `button--icon` | Icon-only: padding 4 x 3, radius 4. Combine with `button--simple` or `button--toggle`. The icon is `button__icon button__icon--solo` |
| `button--toggle` | A toggle with `aria-pressed="true\|false"`. Off looks like simple. On fills `--primary` (hover `--primary-hover`, pressed `--dropdown`). A click flips `aria-pressed` |
| `button--tight` | Combine with `button--simple`. Side padding 4 instead of 8, at rest and pressed. For a consumer that sets `ContentPadding(2)` in place of the `SButton` default (4,2), as the Content Browser toolbar does (`SContentBrowser.cpp:1839,1857`) |
| `button--small` | Fixed 22px height, padding 14 on both sides. For the Add button |
| `button--toolbar` | The slim toolbar button: padding 8 x 4 (pressed 8, 5, 8, 3), 20px icon. Combine with `button--simple` or `button--toggle`. A toggle has no pressed shift (`StarshipCoreStyle.cpp:2193-2194`, `:2217-2218`, `:2240`) |
| `button--plate` | A button on a backplate, as in the Play group. No fill, no padding, the foreground is inherited and a disabled one is not dimmed. The plate owns the fill, the foreground and the alpha. The icon is 20px (`StarshipStyle.cpp:5520-5578`) |
| `button--status` | The status bar drawer button: no fill, Foreground, ForegroundHover on hover and press, padding 4 (pressed 5, 4, 3). `aria-pressed="true"` shows the pressed look, the open drawer (`StarshipCoreStyle.cpp:1867-1870`) |
| disabled | the `disabled` attribute on a `button`, or `aria-disabled="true"` on any element |

The icon class `button__icon` has a 4px gap to the label. Forced state classes for pinned specimens: `button--hover`, `button--pressed`, `button--focus`, `button--disabled`, `button--disabled-brush`.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-button-click` | `{ label, pressed, count }` | The button is clicked, or Enter or Space presses it. A disabled button does not fire. `label` is the `aria-label` or the text. `pressed` is the new state of a toggle, else `null`. `count` is the clicks of this instance |

Holding Enter or Space adds `button--pressed` to this button until the key comes up or the focus leaves.

## Not rebuilt

- No `DangerButton` exists in the Starship styles. The only red buttons are the legacy `FlatButton.Danger` in `StarshipStyle.cpp:575` (linear colour 0.70117, 0.08464, 0.07593. Normal x0.8, hovered x1.0, pressed x0.6, `:559-567`). They use the texture `Common/FlatButton`, which is not available. They are not drawn. Computed sRGB values are `#c54a46`, `#da524e`, `#ae403c`.
- The editor `ToggleButton`, `RoundButton` and `FlatButton*` (`StarshipStyle.cpp:509-542`) also use textures and the user selection colour. They are legacy.
