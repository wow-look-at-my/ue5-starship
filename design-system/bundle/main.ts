// Importing the modules above defines every ue-* element.

import '../src/AssetPicker/AssetPicker.ts';
import '../src/AssetSearchBar/AssetSearchBar.ts';
import '../src/AssetTile/AssetTile.ts';
import '../src/Button/Button.ts';
import '../src/Checkbox/Checkbox.ts';
import '../src/ComboButton/ComboButton.ts';
import '../src/ContentBrowser/ContentBrowser.ts';
import '../src/ContentToolbar/ContentToolbar.ts';
import '../src/DetailsCategory/DetailsCategory.ts';
import '../src/DetailsHeader/DetailsHeader.ts';
import '../src/DetailsSearchRow/DetailsSearchRow.ts';
import '../src/DockTab/DockTab.ts';
import '../src/ExpandableArea/ExpandableArea.ts';
import '../src/FilterPills/FilterPills.ts';
import '../src/HeaderRow/HeaderRow.ts';
import '../src/MenuBar/MenuBar.ts';
import '../src/Notification/Notification.ts';
import '../src/PlaceActorsPanel/PlaceActorsPanel.ts';
import '../src/PopupMenu/PopupMenu.ts';
import '../src/SceneOutliner/SceneOutliner.ts';
import '../src/Scrollbar/Scrollbar.ts';
import '../src/SegmentedControl/SegmentedControl.ts';
import '../src/Slider/Slider.ts';
import '../src/SourcePanel/SourcePanel.ts';
import '../src/SpinBox/SpinBox.ts';
import '../src/Splitter/Splitter.ts';
import '../src/StatusBar/StatusBar.ts';
import '../src/TabWell/TabWell.ts';
import '../src/TextInput/TextInput.ts';
import '../src/ToolBar/ToolBar.ts';
import '../src/Tooltip/Tooltip.ts';
import '../src/TreeRow/TreeRow.ts';
import '../src/VectorInput/VectorInput.ts';
import '../src/WindowChrome/WindowChrome.ts';

// Importing the modules above defines every ue-* element. The design system page preloads this file into each preview.
(window as unknown as { UEStarship: { elements: string[] } }).UEStarship = {
	elements: Array.from(new Set(Array.from(document.querySelectorAll('*')).map((el) => el.localName).filter((tag) => tag.startsWith('ue-')))),
};
