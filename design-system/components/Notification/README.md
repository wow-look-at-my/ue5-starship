# Notification

A grey-blue toast with a rounded black-outlined box, a faint ring watermark, a 32px status icon, a bold title. This also covers optional sub text and right-aligned buttons.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (NotificationList block, lines 680-703), abbreviated `SCS`. This also covers layout in `Runtime/Slate/Private/Widgets/Notifications/SNotificationList.cpp` (abbreviated `SNL`) and `SNotificationBackground.cpp`. This also covers defaults in `Runtime/Slate/Public/Widgets/Notifications/SNotificationList.h`. The editor adds only `NotificationList.Glow` (`StarshipStyle.cpp:1207`), a white colour brush used for the flash.

## What the consumer provides

- Title text, optional sub text, optional hyperlink, optional checkbox, and button definitions (`FNotificationButtonInfo`).
- The completion state: none, pending, success or failure. It picks the icon (`SNL:290-300`).
- Optionally a width. The default is 320 (`SNotificationList.h:146`).
- The throbber texture (`Starship/Notifications/Throbber`), the icon SVGs and the watermark SVG (`Starship/Common/unreal-circle-thin`) are not available. `preview.html` draws approximations. The watermark colour is computed from the source tint.

## Metrics

Slate unit = 1px. The 19px bold line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Fill (`NotificationList.ItemBackground_Border`) | `--notifications` | `SCS:686`; `SNotificationBackground.cpp:9` |
| Radius | 5px | `SCS:686` |
| Outline | 1px `--black` | `SCS:686` |
| Padding | 16 left/right, 8 top/bottom | `SNL:429` |
| Content width | 320 by default; text wraps at width minus 50 | `SNotificationList.h:146`; `SNL:457` |
| Watermark size | clamp(box height x 2.5, 130, 220) | `SNotificationBackground.cpp:34` |
| Watermark offset and clip | at (4,4); clipped 2px inside the box | `SNotificationBackground.cpp:45-50` |
| Watermark tint | `--notifications` x 1.15 in linear space, about `#4b5056` | `SNotificationBackground.cpp:13`; computed |
| Title font (`NotificationList.FontBold`) | Bold 12pt = 16px | `SCS:682`; `SNL:456` |
| Sub text | NormalText 10pt = 13.33px, padding 10 top and 2 bottom | `SNL:461` |
| Hyperlink and checkbox rows | `NotificationList.WidgetText` (NormalText, ellipsis); padding 10 top and 2 bottom | `SCS:700-701`; `SNL:473-503` |
| Icon size | 32 x 32 | `SNL:566` |
| Success icon | `Icons.SuccessWithColor.Large` in `--success` | `SNL:295`; `SCS:326` |
| Failure icon | `Icons.ErrorWithColor.Large` (alert triangle) in `--error` | `SNL:297`; `SCS:309` |
| Default icon | `UnrealCircle.Thick`, 32x32, `--foreground` | `SNL:814`; `SCS:288` |
| Throbber | 40 x 40 image turning once per cycle behind the icon; icon cell padding -6 left while pending | `SCS:689`; `SNL:274-283`, `262-271`, `555-558` |
| Gap between icon and text | 10 | `SNL:570` |
| Button row | right aligned, 5 above; each button has 4 on its right | `SNL:516`, `530-533` |
| Button style | default `Button` (see the Button component), text `NotificationList.WidgetText` | `SNL:518-521`; `SCS:700-701` |
| Text colour | white: the inherited default foreground; nothing sets it | `WidgetStyle.h:21` (derived) |
| Timing | fade in 0.5s, hold 1s, fade out 2s | `SNotificationList.h:140-142` |
| Window around the toast (`NotificationWindow`) | the `Window` style with corner radius 8 | `SCS:797-799` (not drawn) |
| Glow on completion | a 0-to-1 alpha flash in green (success) or red (failure) | `SNL:239-253` |

## Do

- Show the icon at 32px and the title bold. Put the sub text and buttons under the title, not beside it.
- Right-align buttons and leave 4px after the last one.
- Use the success and error colours for the icons only. The box stays grey-blue.

## Don't

- Do not draw a drop shadow on the toast. The source has none.
- Do not set the box colour per state. The glow is a separate overlay.
- Do not treat the watermark ring shape in `preview.html` as exact. It is an approximation.
