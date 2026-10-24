# ContentToolbar

The top row of the Content Browser. Add / Import / Save All actions, history arrows, a breadcrumb path trail and a right-aligned Settings button, all on a Panel-coloured strip 32px high.

## What the consumer provides

- The three action labels and their handlers (Add opens a menu. Import and Save All are plain buttons).
- The breadcrumb crumbs (text per path element) and whether back / forward history is available (forward and back render at reduced opacity when disabled).
- The Settings menu content.

The row is: `[tool buttons] [back] [forward] [breadcrumb, fills the remaining width] [Settings]`. Lock and "Dock in Layout" buttons exist in source (`SContentBrowser.cpp:822-844`) but are hidden in the standard browser and are not drawn here.

## Metrics (px = Slate units at 100% DPI; 10pt text = 13.333px)

| Part | Value | Source |
|---|---|---|
| Row background / padding | `--panel` / 3px all sides | `SContentBrowser.cpp:764-766` |
| Tool strip left offset | 5px slot padding + 4px toolbar background padding left, 2px top/bottom | `SContentBrowser.cpp:772`, `StarshipStyle.cpp:6624` |
| Separator between tool buttons | 2px wide, no brush, 4px margin each side | `StarshipStyle.cpp:6622-6623`, `ToolBarStyle.cpp:25` |
| Add button | combo button, `--secondary` fill, 1px `--input` outline, radius 4, hover `--hover` | `StarshipCoreStyle.cpp:1372-1376`, `SContentBrowser.cpp:1799-1806` |
| Add content padding | 2px + 12px = 14px horizontal, 1.5px + 1.5px = 3px vertical; icon 16, gap 3, height 22 | `ToolWidgetsStylePrivate.h:22-28`, `ToolWidgetsStyle.cpp:57-62`, `CoreStyle.h:110`, `SButton.cpp:159-163` |
| Add icon colour | `--accent-green` plus icon | `ToolWidgetsStyle.cpp:76` |
| Import / Save All | `SimpleButton`: ContentPadding(2) + (2,1) = padding 3px 4px, icon 16, gap 3, hover `--dropdown` radius 4 | `StarshipCoreStyle.cpp:1389-1407`, `SContentBrowser.cpp:1839,1857`, `ContentBrowserAssetDataSource.cpp:3607` |
| Text | Normal 10pt Regular, `--foreground` | `StarshipCoreStyle.cpp:36,1170-1172` |
| Back / forward | `SimpleButton`, ContentPadding(1,0) + (2,1) = padding 1px 3px, icon 16 (22 x 18 hit box); back margin-left 10, forward margin-left 2 | `SContentBrowser.cpp:778-797` |
| Breadcrumb slot | fills; margin-left 2 | `SContentBrowser.cpp:816-820` |
| Crumb button | `SimpleButton` + ContentPadding(2,2) = padding 3px 4px, hover `--dropdown` | `SNavigationBar.h:43-45` |
| Crumb delimiter | `Icons.ChevronRight` 16px, button ContentPadding(3,0) + (2,1) = padding 1px 5px | `SNavigationBar.h:46`, `SBreadcrumbTrail.h:198-203` |
| Settings button | `SimpleComboButton`, no down arrow; button padding (4,1); icon slot and text slot Padding(4,0); slot margin-left 5 | `SContentBrowser.cpp:494-518,848`, `StarshipCoreStyle.cpp:1398-1400,1514-1521` |
| Row height | 22 (button) + 2 + 2 (toolbar padding) + 3 + 3 (row padding) = 32 | derived from the rows above |

## Do

- Keep every button on a 22px line box so the row stays 32px high.
- Draw disabled history arrows at reduced opacity (the preview uses 0.45, an approximation of Slate's DisabledEffect, `SlateElementPixelShader.usf:514`).
- Let the breadcrumb take all free width so Settings stays right-aligned.

## Don't

- Do not give the breadcrumb a box: source builds it inside a combo button. However, the reference screenshot shows no outline, and the preview follows the screenshot.
- Do not add an outline or fill to Import / Save All at rest. Only hover paints them.

## Icons

The Starship SVG files are not available. Icons in `preview.html` (plus, import, save-all, circle arrows, chevron, gear, folder) are simple stroke/fill approximations drawn to the 16px grid. Replace them with the real `Starship/Common/*.svg` assets. The leading folder glyph before the breadcrumb is present in the reference screenshot and was not found in the 5.5.3 `SNavigationBar` source.
