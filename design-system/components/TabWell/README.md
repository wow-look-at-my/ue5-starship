# TabWell

A tab stack: a tab well of dock tabs on the `--background` ground, over a content area on the `--panel` ground, as built by `SDockingTabStack`.

## What the consumer provides

- The tabs (see `DockTab`) and the content widget of the foreground tab.
- Content padding, if any. `SDockTab` defaults `ContentPadding` to 0 (`SDockTab.h:77`), so the content fills the area edge to edge. The widget constructor sets 2 first (`SDockTab.cpp:392`), then replaces it with the argument (`SDockTab.cpp:586`).
- The stack kind. A small stack paints the well with `--background` and the content with `--panel`. A major stack under the window chrome paints the well with `--title` and the content with `--background`.

## Structure

```
+-----------------------------------------------+  tab well: Brushes.Background (minor) / Brushes.Title (major)
| [Details x][ Outliner ][ Content Browser ]    |  tabs bottom-aligned, 2px gap
+-----------------------------------------------+
|                                               |  content area: foreground tab ContentAreaBrush
|                  panel body                   |  clipped to bounds, padding = tab ContentPadding
+-----------------------------------------------+
```

## Metrics

| Property | Value | Source |
|---|---|---|
| Tab well fill, minor stack | `--background` | `SDockingTabStack.cpp:1235`, `StarshipCoreStyle.cpp:1122` |
| Tab well fill, stack under window chrome | `--title` | `SDockingTabStack.cpp:1234`, `StarshipCoreStyle.cpp:1117` |
| Tab well border padding | 0 | `SDockingTabStack.cpp:151` |
| Tab well brush image (`TabWellBrush`) | `--background`, zero image size, adds no height | `StarshipCoreStyle.cpp:1795`, `:1821`; `SDockingTabStack.cpp:160-165` |
| Content fill, minor | `--panel` | `StarshipCoreStyle.cpp:1794` |
| Content fill, major | `--background` | `StarshipCoreStyle.cpp:1820` |
| Content clipping | clip to bounds | `SDockingTabStack.cpp:181` |
| Content padding | 0 by default | `SDockTab.h:77`, `SDockingTabStack.cpp:975-981` |
| Tab pitch | tab width + 2 (overlap -2) | `StarshipCoreStyle.cpp:1799`; `SDockingTabWell.cpp:105` |
| Minor tab height | 25 | `SDockingTabWell.cpp:9` |
| Major tab height | about 30.8 (derived) | `StarshipCoreStyle.cpp:1823`, `:1832` |
| Tab separator | none | `SDockingTabWell.cpp:31` |
| Tab width rule | every tab gets an equal share of the well width, capped at the tab max size (160 x 25 minor, 210 x 50 major) | `SDockingTabWell.cpp:246-282` |

The active tab has the same `--panel` fill as the content area under it, so no seam shows between them. The well is `--background`, which is darker than `--panel`, so the inactive tabs read as sitting behind the selected one.

## Do

- Let the content area own its own padding. The stack adds none.
- Keep the stack's well and content on the grounds named above. They carry the depth cue.
- Hide the well by collapsing it (`GetTabWellVisibility`) and show the unhide control (`Docking.UnhideTabwellButton`, 8 x 8, `--primary`, `StarshipCoreStyle.cpp:1765-1771`) in the content corner.

## Don't

- Do not add a divider between the well and the content.
- Do not tint the well to mark focus. Focus is shown on the tab (the active line and the text colour).
- Do not paint a major stack's content with `--panel`. The major content area is `--background`.
