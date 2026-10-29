# TabWell

A tab stack: a tab well of dock tabs on the `--background` ground, over a content area on the `--panel` ground, as built by `SDockingTabStack`.

One `<ue-tab-well>` wraps exactly one stack: one well of tabs over one content area. A composite puts one `ue-tab-well` per docked panel. `<ue-dock-tab>` is the same behaviour on the `dockTab-*` class names (see `DockTab`). Both draw the same pixels.

## Markup contract

```html
<ue-tab-well>
	<div class="tabWell-stack">
		<div class="tabWell-well" role="tablist" aria-label="Minor tabs">      <!-- add tabWell-well--major for a major stack -->
			<div class="tabWell-tab tabWell-tab--foreground tabWell-tab--active" role="tab" tabindex="0" aria-selected="true" data-tab="details">
				<span class="tabWell-icon"><svg viewBox="0 0 16 16"><path d="..."/></svg></span>
				<span class="tabWell-label">Details</span>
				<span class="tabWell-close" role="button" aria-label="Close tab"><svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7 M11.5 4.5l-7 7"/></svg></span>
			</div>
			<div class="tabWell-tab" role="tab" tabindex="-1" aria-selected="false" data-tab="outliner">...</div>
		</div>
		<div class="tabWell-content">                                              <!-- tabWell-content--major for a major stack -->
			<div role="tabpanel" data-panel="details">...</div>
			<div role="tabpanel" data-panel="outliner" hidden>...</div>
		</div>
	</div>
	<button class="tabWell-reset" type="button">Restore tabs</button>              <!-- optional -->
</ue-tab-well>
```

- A tab pairs with the panel whose `data-panel` equals its `data-tab`. `data-tab` is also the id in events.
- The element sets `tabWell-tab--foreground` (the selected tab of the stack), `tabWell-tab--active` (the one foreground tab of the focused stack on the page), `aria-selected`, `tabindex` (roving: the foreground tab is 0) and the `hidden` attribute of each panel. An author writes only the initial state.
- A glyph is inline `<svg viewBox="0 0 16 16">` with paths. The CSS strokes it with `currentColor`, width 1.25, no fill, round caps. No `<symbol>` is needed.
- A panel of a stack nested inside another stack never matches the outer stack. A panel pairs only with a tab of the stack that holds it.
- `.tabWell-reset` puts the markup back as it was when the element connected. It is optional.
- Keyboard on a focused tab: Left and Right move and select (wrapping), Home and End jump, Enter and Space select, Delete closes. A middle click closes. A click on a tab selects it. A right-click selects it too.
- Closing the foreground tab selects its left neighbour, or the new first tab (`SDockingTabWell.cpp:617-633`). An emptied well keeps its height.

## Variants

| Variant | Markup |
|---|---|
| Minor stack | `tabWell-well` (`--background`) over `tabWell-content` (`--panel`) |
| Major stack | `tabWell-well tabWell-well--major` (`--title`) over `tabWell-content tabWell-content--major` (`--background`), tabs carry `tabWell-tab--major`. A major tab never shows the active line |
| One major tab alone | `<div class="tabWell-well tabWell-well--major"><div class="tabWell-tab tabWell-tab--major tabWell-tab--foreground">icon, label, close</div></div>` with no element. This is the title-bar tab of the window chrome. The tab is 30.8px tall, white text, `--panel` fill, close button visible |

## Events

Both events bubble and are composed. A handler ignores an event from a nested stack.

| Event | `detail` | When |
|---|---|---|
| `ue-tab-activate` | `{ id, label }` | A tab became the foreground tab of its stack, by click, key, close, or `activateTab(id)`. Clicking the tab that is already foreground fires nothing |
| `ue-tab-close` | `{ id, label }` | A tab was removed, by its button, a middle click, Delete or `closeTab(id)`. It fires before the `ue-tab-activate` of the tab that takes over |

`id` is the `data-tab` of the tab. `label` is the text of `.tabWell-label`. The element has `activateTab(id)`, `closeTab(id)` and `tabs()`.

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
