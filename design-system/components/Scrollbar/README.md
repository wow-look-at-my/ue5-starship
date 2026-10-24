# Scrollbar

An 8px rounded. Thumb on a transparent track, grey at rest and lighter when the pointer is over the bar or the thumb is dragged (UE 5.5.3 Starship `Scrollbar`).

## What the consumer provides

- The orientation, the scroll offset fraction and the thumb size fraction (visible length divided by content length).
- The state: idle, pointer over the bar, or dragging.
- The slot: 16px for a table, list or tree view, 12px for a scroll box. The bar fills the slot cross-axis.

## Metrics

| Property | Value | Source |
| --- | --- | --- |
| Thumb thickness | 8px | `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp:192` (`SetThickness(8.0f)`) |
| Thumb radius | 4px (a full pill at 8px) | `StarshipCoreStyle.cpp:189-191` (`FSlateRoundedBoxBrush(..., 4.0f)`) |
| Thumb, normal | `--hover` #575757 | `StarshipCoreStyle.cpp:189` |
| Thumb, hovered | `--hover-2` #808080 | `StarshipCoreStyle.cpp:191` |
| Thumb, dragged | `--hover-2` #808080 | `StarshipCoreStyle.cpp:190` |
| Hover test | the whole scrollbar widget, not only the thumb | `Runtime/Slate/Private/Widgets/Layout/SScrollBar.cpp:307-321` |
| Track and end-slot images | none (transparent) | `FScrollBarStyle` defaults `FSlateNoResource`: `Runtime/SlateCore/Private/Styling/SlateTypes.cpp:362-373` |
| Minimum thumb length | 35px | `Runtime/Slate/Private/Widgets/Layout/SScrollBarTrack.cpp:12` |
| Thumb length | 35 + (track - 35) x thumb fraction | `Runtime/Slate/Public/Widgets/Layout/SScrollBarTrack.h:57-62` |
| Inner padding | 2px on every side | `Runtime/Slate/Public/Widgets/Layout/SScrollBar.h:32,48` |
| Table, list and tree slot | 16px wide (or 16px tall horizontal) | `Runtime/Slate/Private/Widgets/Views/STableViewBase.cpp:100,127,158` |
| Scroll box slot | 12px = thumb 8 + slot padding 2 + 2; bar padding 0 | `Runtime/Slate/Public/Widgets/Layout/SScrollBox.h:268-269`, `Runtime/Slate/Private/Widgets/Layout/SScrollBox.cpp:194,244-250`, `StarshipCoreStyle.cpp:725` |
| Thumb position in a 16px slot | 4px from each side (2 padding + 2 centring) | `SScrollBar.cpp:24-25,61-68` |
| Hidden when content fits | yes (collapsed) | `SScrollBar.cpp:323-343`, `SScrollBar.h:195` |
| Auto-hide while idle | off on desktop | `SScrollBar.h:40-44` (`PLATFORM_UI_HAS_MOBILE_SCROLLBARS`) |

## Opacity is not applied to the thumb

`SScrollBar::Tick` sets a 0.75 alpha for the idle thumb through `SetColorAndOpacity` (`SScrollBar.cpp:121-122`, `:270-294`). That call tints the border's child, a spacer, and never the border's own brush: `Runtime/Slate/Private/Widgets/Layout/SBorder.cpp:115-127` paints the brush with the border background colour only. The thumb therefore draws opaque `--hover`. A pixel sample of the reference screenshot confirms it (thumb #575757 on #1A1A1A). The preview uses opaque colours.

## Do

- Use `--hover` at rest and `--hover-2` for both hover and drag.
- Centre the thumb in the slot so it sits 4px from the view edge in a 16px slot.
- Keep a 35px minimum thumb however long the content is.
- Draw no track.

## Don't

- Do not draw arrows, steppers or a track fill.
- Do not fade the thumb at rest.
- Do not thicken the thumb on hover. Only the colour changes.
- Do not reserve the slot when the content fits, except that a table header keeps its 16px spacer only while the bar shows.
